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
import { getConfig } from "../services/config.js";
import { SYSTEM_PROMPT, chatTools } from "../ai/coach.js";
import { ChatSession } from "../models/ChatSession.js";

const router: Router = Router();

const uuidParamSchema = z.object({ uuid: z.string().uuid("invalid session id") });

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
  intent: z.enum(["approaches", "branches"]).optional(),
});

const titleSchema = z.object({
  title: z.string().describe("Short chat title, 5 words max, no quotes or emoji."),
});

const MAX_MESSAGES = 100;

type StoredMessage = z.infer<typeof uiMessageSchema>;

function getUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown; _id?: unknown } }).user;
  const id = user?.id ?? user?._id;
  return String(id ?? "");
}

async function resolveModel(): Promise<string> {
  try {
    return await getConfig("OPENROUTER_MODEL");
  } catch {
    return env.OPENROUTER_MODEL;
  }
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

/** Persist without ephemeral parts (images are context-only; reasoning is transient). */
function toStoredMessage(message: UIMessage): StoredMessage {
  return {
    id: message.id,
    role: message.role,
    parts: (message.parts ?? []).filter(
      (p) => p.type !== "file" && p.type !== "reasoning",
    ),
    metadata: message.metadata,
  };
}

/**
 * Reasoning is turn-local, so drop it before the model call. Doing so can
 * leave a tool-only assistant turn empty (tool parts with no result are also
 * dropped during conversion), which providers reject — so drop those too.
 */
function forModel(messages: UIMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") {
      out.push(message);
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
  }).lean<{ uuid: string; title: string; messages: StoredMessage[]; createdAt: Date; updatedAt: Date } | null>();
  if (!doc) return res.status(404).json({ error: "Session not found" });
  return res.json({
    uuid: doc.uuid,
    title: doc.title,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    messages: normalizeMessages(doc.messages ?? []),
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
  const result = await ChatSession.deleteOne({
    uuid: parsed.data.uuid,
    userId: getUserId(req),
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

  try {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const result = streamText({
      model: openrouter(await resolveModel()),
      system: SYSTEM_PROMPT,
      tools: chatTools,
      toolChoice:
        intent === "approaches"
          ? { type: "tool", toolName: "proposeApproaches" }
          : intent === "branches"
            ? { type: "tool", toolName: "proposeBranches" }
            : "none",
      messages: convertToModelMessages(forModel(incoming)),
      providerOptions: { openrouter: { reasoning: { enabled: true } } },
    });

    result.pipeUIMessageStreamToResponse(res, {
      originalMessages: incoming,
      sendReasoning: true,
      onFinish: async ({ messages }) => {
        try {
          const stored = messages.map(toStoredMessage);
          await ChatSession.updateOne(
            { _id: session._id },
            { $set: { messages: stored } },
          );
        } catch (err) {
          console.error("Failed to persist chat messages:", err);
        }
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
