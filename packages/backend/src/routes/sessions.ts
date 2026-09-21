import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  convertToModelMessages,
  generateObject,
  streamText,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { getContextLength, resolveModel } from "../services/model-info.js";
import { SYSTEM_PROMPT, chatTools } from "../ai/coach.js";
import { ChatSession } from "../models/ChatSession.js";
import { Connection } from "../models/Connection.js";

const router: Router = Router();

const uuidParamSchema = z.object({ uuid: z.string().uuid("invalid session id") });

/** Typed override required to delete a chat that is linked to a connection. */
const DELETE_CONFIRMATION = "CONFIRM";

const renameBodySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(80),
});

const messagePartSchema = z.object({ type: z.string() }).passthrough();

const uiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(messagePartSchema),
  metadata: z.unknown().optional(),
});

const chatBodySchema = z.object({
  messages: z.array(uiMessageSchema).min(1, "messages are required"),
  intent: z.enum(["approaches", "branches", "capture"]).optional(),
});

const titleSchema = z.object({
  title: z.string().describe("Short chat title, 5 words max, no quotes or emoji."),
});

const MAX_MESSAGES = 100;

/** Decoded-size ceiling for a single attached image (1 MB), mirrored client-side. */
const MAX_IMAGE_BYTES = 1_000_000;
/** Total decoded image bytes kept per session (stays under Mongo's 16 MB doc cap). */
const MAX_STORED_IMAGE_BYTES = 8_000_000;

type StoredMessage = z.infer<typeof uiMessageSchema>;
type MessagePart = StoredMessage["parts"][number];

interface FilePartLike {
  type: string;
  mediaType?: unknown;
  url?: unknown;
}

/** A `file` part carrying an image data URL (base64 payload). */
function isImagePart(part: { type: string }): boolean {
  const p = part as FilePartLike;
  return (
    p.type === "file" &&
    typeof p.mediaType === "string" &&
    p.mediaType.startsWith("image/") &&
    typeof p.url === "string" &&
    p.url.startsWith("data:")
  );
}

/** Byte size of a data URL's base64 payload (without decoding it). */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function imageBytes(part: { type: string }): number {
  const url = (part as FilePartLike).url;
  return typeof url === "string" ? dataUrlBytes(url) : 0;
}

/**
 * Keep the newest image parts within a per-session byte budget, dropping the
 * oldest images so a long chat can never overflow the Mongo document limit.
 */
function capStoredImages(messages: StoredMessage[]): StoredMessage[] {
  let budget = MAX_STORED_IMAGE_BYTES;
  const out = [...messages];
  for (let i = out.length - 1; i >= 0; i--) {
    const message = out[i];
    const parts = message.parts ?? [];
    let dropped = false;
    const kept: MessagePart[] = [];
    for (const part of parts) {
      if (!isImagePart(part)) {
        kept.push(part);
        continue;
      }
      const bytes = imageBytes(part);
      if (bytes <= budget) {
        budget -= bytes;
        kept.push(part);
      } else {
        dropped = true;
      }
    }
    if (dropped) out[i] = { ...message, parts: kept };
  }
  return out;
}

interface TokenUsage {
  model?: string;
  contextLength?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

function getUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown; _id?: unknown } }).user;
  const id = user?.id ?? user?._id;
  return String(id ?? "");
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/** Stored/streamed messages need a stable, non-empty id. */
function normalizeMessages(messages: StoredMessage[]): StoredMessage[] {
  const seen = new Set<string>();
  return messages.map((m) => {
    const id = (m.id ?? "").trim();
    const next = id && !seen.has(id) ? id : `m-${randomUUID()}`;
    seen.add(next);
    return { ...m, id: next };
  });
}

function messageText(message: Pick<StoredMessage, "parts">): string {
  return (message.parts ?? [])
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => String((p as { text?: unknown }).text ?? ""))
    .join(" ")
    .trim();
}

/**
 * Persist the turn. Image parts are kept as base64 data URLs so screenshots
 * survive reloads; reasoning is transient and oversized/other files are dropped.
 */
function toStoredMessage(message: UIMessage): StoredMessage {
  return {
    id: message.id,
    role: message.role,
    parts: (message.parts ?? []).filter((p) => {
      if (p.type === "reasoning") return false;
      if (p.type === "file") return isImagePart(p) && imageBytes(p) <= MAX_IMAGE_BYTES;
      return true;
    }),
    metadata: message.metadata,
  };
}

/**
 * Reasoning is turn-local, so drop it before the model call. Doing so can
 * leave a tool-only assistant turn empty (tool parts with no result are also
 * dropped during conversion), which providers reject — so drop those too.
 *
 * Only the most recent screenshot is sent as image context; older images stay
 * stored for history but are stripped from the model prompt to bound tokens.
 */
function forModel(messages: UIMessage[]): UIMessage[] {
  let lastImageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i].parts ?? []).some(isImagePart)) {
      lastImageIndex = i;
      break;
    }
  }

  const out: UIMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== "assistant") {
      const parts = (message.parts ?? []).filter(
        (p) => p.type !== "file" || (i === lastImageIndex && isImagePart(p)),
      );
      if (parts.length > 0) out.push({ ...message, parts });
      continue;
    }
    const parts = (message.parts ?? []).filter((p) => p.type !== "reasoning");
    const hasContent = parts.some((p) => {
      if (p.type === "text") return Boolean((p as { text?: string }).text?.trim());
      if (p.type === "file") return true;
      const tool = p as { type: string; state?: string };
      if (tool.type === "dynamic-tool" || tool.type.startsWith("tool-")) {
        return tool.state === "output-available" || tool.state === "output-error";
      }
      return false;
    });
    if (hasContent) out.push({ ...message, parts });
  }
  return out;
}

function toListItem(doc: {
  uuid: string;
  title: string;
  messages: StoredMessage[];
  updatedAt: Date;
  createdAt: Date;
}) {
  const messages = doc.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return {
    uuid: doc.uuid,
    title: doc.title,
    updatedAt: iso(doc.updatedAt),
    createdAt: iso(doc.createdAt),
    messageCount: messages.length,
    preview: lastUser ? messageText(lastUser).slice(0, 80) : "",
  };
}

/** Fire-and-forget AI title for the first message; never throws. */
function refreshTitleIfDefault(sessionId: unknown, situation: string) {
  void (async () => {
    try {
      const session = await ChatSession.findById(sessionId).lean<{
        title: string;
      } | null>();
      if (!session || session.title !== "New chat") return;
      const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
      const { object } = await generateObject({
        model: openrouter(await resolveModel()),
        schema: titleSchema,
        system:
          "Generate a very short chat title (5 words max, plain text, no quotes, no emoji) summarising the user's request.",
        messages: [{ role: "user", content: [{ type: "text" as const, text: situation }] }],
      });
      const title = object.title.trim().slice(0, 80);
      if (!title) return;
      await ChatSession.updateOne(
        { _id: sessionId, title: "New chat" },
        { $set: { title } },
      );
    } catch (err) {
      console.error("AI title generation failed:", err);
    }
  })();
}

/** Persist the model + token accounting for the turn; never throws. */
async function persistUsage(
  sessionId: unknown,
  modelId: string,
  result: {
    usage: Promise<{
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }>;
  },
) {
  try {
    const [usage, contextLength] = await Promise.all([
      result.usage,
      getContextLength(modelId),
    ]);
    await ChatSession.updateOne(
      { _id: sessionId },
      {
        $set: {
          usage: {
            model: modelId,
            contextLength,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
          },
        },
      },
    );
  } catch (err) {
    console.error("Failed to persist token usage:", err);
  }
}

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const doc = await ChatSession.create({
    uuid: randomUUID(),
    userId,
    title: "New chat",
    messages: [],
  });
  return res.status(201).json({
    uuid: doc.uuid,
    title: doc.title,
    messageCount: 0,
    preview: "",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const docs = await ChatSession.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean<
      {
        uuid: string;
        title: string;
        messages: StoredMessage[];
        updatedAt: Date;
        createdAt: Date;
      }[]
    >();
  return res.json({ sessions: docs.map(toListItem) });
});

router.get("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid session id" });
  const doc = await ChatSession.findOne({
    uuid: parsed.data.uuid,
    userId: getUserId(req),
  }).lean<{
    uuid: string;
    title: string;
    messages: StoredMessage[];
    createdAt: Date;
    updatedAt: Date;
    usage?: TokenUsage | null;
  } | null>();
  if (!doc) return res.status(404).json({ error: "Session not found" });
  return res.json({
    uuid: doc.uuid,
    title: doc.title,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    messages: normalizeMessages(doc.messages ?? []),
    usage: doc.usage
      ? {
          model: doc.usage.model ?? "",
          contextLength: doc.usage.contextLength ?? 0,
          inputTokens: doc.usage.inputTokens ?? 0,
          outputTokens: doc.usage.outputTokens ?? 0,
          totalTokens: doc.usage.totalTokens ?? 0,
        }
      : null,
  });
});

router.patch("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid session id" });
  const parsedBody = renameBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }
  const doc = await ChatSession.findOneAndUpdate(
    { uuid: parsedParam.data.uuid, userId: getUserId(req) },
    { $set: { title: parsedBody.data.title } },
    { new: true },
  ).lean<{ uuid: string; title: string } | null>();
  if (!doc) return res.status(404).json({ error: "Session not found" });
  return res.json({ uuid: doc.uuid, title: doc.title });
});

router.delete("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid session id" });
  const userId = getUserId(req);

  // A chat that led to a tracked connection carries its coaching history, so
  // deleting it is gated behind an explicit typed confirmation. The user must
  // pass `?confirm=CONFIRM` (the UI asks them to type it) to override.
  const connection = await Connection.findOne({
    userId,
    originSessionId: parsed.data.uuid,
  }).lean<{ uuid: string; name: string; stage: string } | null>();
  if (connection && req.query.confirm !== DELETE_CONFIRMATION) {
    return res.status(409).json({
      error: "This chat is linked to a connection and can't be deleted without confirmation",
      connection: {
        uuid: connection.uuid,
        name: connection.name,
        stage: connection.stage,
      },
    });
  }

  const result = await ChatSession.deleteOne({
    uuid: parsed.data.uuid,
    userId,
  });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Session not found" });
  return res.status(204).end();
});

router.post("/:uuid/chat", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid session id" });
  const parsedBody = chatBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    console.error("Invalid chat body:", JSON.stringify(parsedBody.error.flatten()));
    return res.status(400).json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }

  const session = await ChatSession.findOne({
    uuid: parsedParam.data.uuid,
    userId: getUserId(req),
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (parsedBody.data.messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Session is full (${MAX_MESSAGES} messages max)` });
  }

  const incoming = normalizeMessages(parsedBody.data.messages) as UIMessage[];
  const intent = parsedBody.data.intent;
  const isFirstUserMessage = (session.messages?.length ?? 0) === 0;

  const oversizedImage = incoming.some((m) =>
    (m.parts ?? []).some((p) => isImagePart(p) && imageBytes(p) > MAX_IMAGE_BYTES),
  );
  if (oversizedImage) {
    return res
      .status(413)
      .json({ error: "Image is too large. Screenshots must be under 1 MB." });
  }

  try {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const modelId = await resolveModel();
    const result = streamText({
      model: openrouter(modelId),
      system: SYSTEM_PROMPT,
      tools: chatTools,
      toolChoice:
        intent === "approaches"
          ? { type: "tool", toolName: "proposeApproaches" }
          : intent === "branches"
            ? { type: "tool", toolName: "proposeBranches" }
            : intent === "capture"
              ? { type: "tool", toolName: "proposeConnection" }
              : "auto",
      messages: convertToModelMessages(forModel(incoming)),
      providerOptions: { openrouter: { reasoning: { enabled: true } } },
    });

    result.pipeUIMessageStreamToResponse(res, {
      originalMessages: incoming,
      sendReasoning: true,
      onFinish: async ({ messages }) => {
        try {
          const stored = capStoredImages(messages.map(toStoredMessage));
          await ChatSession.updateOne(
            { _id: session._id },
            { $set: { messages: stored } },
          );
        } catch (err) {
          console.error("Failed to persist chat messages:", err);
        }
        // Usage settles slightly after the UI stream; persist separately so a
        // slow/absent usage report never blocks message persistence.
        void persistUsage(session._id, modelId, result);
      },
    });

    if (isFirstUserMessage) {
      const first = incoming.find((m) => m.role === "user");
      const text = first ? messageText(toStoredMessage(first)) : "";
      if (text) refreshTitleIfDefault(session._id, text);
    }
  } catch (err) {
    console.error("POST /api/sessions/:uuid/chat failed:", err);
    if (!res.headersSent) {
      return res.status(502).json({ error: "AI request failed" });
    }
  }
});

export default router;
