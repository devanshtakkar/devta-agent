import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { getConfig } from "../services/config.js";
import { SYSTEM_PROMPT, branchSchema, starterSchema } from "../ai/coach.js";
import { ChatSession } from "../models/ChatSession.js";

const router: Router = Router();

const uuidParamSchema = z.object({ uuid: z.string().uuid("invalid session id") });

const renameBodySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(80),
});

const turnBodySchema = z.object({
  situation: z.string().trim().min(1, "situation is required").max(2000),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "must be a data:image/...;base64 URL")
    .optional(),
});

const branchBodySchema = z.object({
  turnIndex: z.number().int().min(0),
  starter: z.union([
    z.string().min(1).max(1000),
    z
      .object({ id: z.string().optional(), openerLine: z.string().min(1).max(1000) })
      .passthrough(),
  ]),
  herResponse: z.string().max(1000).optional(),
});

const titleSchema = z.object({
  title: z.string().describe("Short chat title, 5 words max, no quotes or emoji."),
});

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

interface LeanListTurn {
  situation: string;
}

interface LeanListDoc {
  uuid: string;
  title: string;
  turns: LeanListTurn[];
  updatedAt: Date;
  createdAt: Date;
}

interface LeanDetailStarter {
  id: string;
  title: string;
  openerLine: string;
  why: string;
  risk: "low" | "medium" | "high";
  nextMove: string;
}

interface LeanDetailBranch {
  starterId?: string;
  scenarios: { herResponse: string; yourReply: string; tip: string }[];
  exitLine: string;
  createdAt: Date;
}

interface LeanDetailTurn {
  situation: string;
  overview: string;
  starters: LeanDetailStarter[];
  branches: LeanDetailBranch[];
  error?: string;
  createdAt: Date;
}

interface LeanDetailDoc {
  uuid: string;
  title: string;
  turns: LeanDetailTurn[];
  createdAt: Date;
  updatedAt: Date;
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function toListItem(doc: LeanListDoc) {
  const last = doc.turns[doc.turns.length - 1];
  return {
    uuid: doc.uuid,
    title: doc.title,
    updatedAt: iso(doc.updatedAt),
    createdAt: iso(doc.createdAt),
    turnCount: doc.turns.length,
    preview: last ? last.situation.slice(0, 80) : "",
  };
}

/** Fire-and-forget AI title for the first turn; never throws. */
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
  const doc = await ChatSession.create({ uuid: randomUUID(), userId, title: "New chat", turns: [] });
  return res.status(201).json({
    uuid: doc.uuid,
    title: doc.title,
    turnCount: 0,
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
    .lean<LeanListDoc[]>();
  return res.json({ sessions: docs.map(toListItem) });
});

router.get("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid session id" });
  const doc = await ChatSession.findOne({ uuid: parsed.data.uuid, userId: getUserId(req) }).lean<LeanDetailDoc | null>();
  if (!doc) return res.status(404).json({ error: "Session not found" });
  return res.json({
    uuid: doc.uuid,
    title: doc.title,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    turns: doc.turns.map((t) => ({
      situation: t.situation,
      overview: t.overview,
      starters: t.starters,
      branches: (t.branches ?? []).map((b) => ({
        starterId: b.starterId,
        scenarios: b.scenarios,
        exitLine: b.exitLine,
        createdAt: iso(b.createdAt),
      })),
      error: t.error,
      createdAt: iso(t.createdAt),
    })),
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
  const result = await ChatSession.deleteOne({ uuid: parsed.data.uuid, userId: getUserId(req) });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Session not found" });
  return res.status(204).end();
});

router.post("/:uuid/turns", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid session id" });
  const parsedBody = turnBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }
  const session = await ChatSession.findOne({
    uuid: parsedParam.data.uuid,
    userId: getUserId(req),
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.turns.length >= 50) {
    return res.status(400).json({ error: "Session is full (50 turns max)" });
  }

  const { situation, imageDataUrl } = parsedBody.data;
  try {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const { object } = await generateObject({
      model: openrouter(await resolveModel()),
      schema: starterSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: imageDataUrl
            ? [
                { type: "text" as const, text: situation },
                { type: "image" as const, image: imageDataUrl },
              ]
            : [{ type: "text" as const, text: situation }],
        },
      ],
    });
    // Images are ephemeral context only — never persisted.
    session.turns.push({
      situation,
      overview: object.overview,
      starters: object.starters,
      branches: [],
    });
    await session.save();
    if (session.turns.length === 1) refreshTitleIfDefault(session._id, situation);
    const turn = session.turns[session.turns.length - 1];
    return res.status(201).json({
      turnIndex: session.turns.length - 1,
      turn: {
        situation: turn.situation,
        overview: turn.overview,
        starters: turn.starters,
        branches: [],
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/sessions/:uuid/turns failed:", err);
    return res.status(502).json({ error: "AI request failed" });
  }
});

router.post("/:uuid/branches", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid session id" });
  const parsedBody = branchBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }
  const session = await ChatSession.findOne({
    uuid: parsedParam.data.uuid,
    userId: getUserId(req),
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  const turn = session.turns[parsedBody.data.turnIndex];
  if (!turn) return res.status(404).json({ error: "Turn not found" });

  const starter = parsedBody.data.starter;
  const starterLine = typeof starter === "string" ? starter : starter.openerLine;
  const starterId = typeof starter === "string" ? undefined : starter.id;
  const { herResponse } = parsedBody.data;
  const prompt = herResponse
    ? `Situation: ${turn.situation}\nChosen opener: ${starterLine}\nShe responded: ${herResponse}\nSuggest 3 ways this could go next, plus a graceful exit line.`
    : `Situation: ${turn.situation}\nChosen opener: ${starterLine}\nSuggest 3 plausible ways she might respond and what to say next, plus a graceful exit line.`;
  try {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const { object } = await generateObject({
      model: openrouter(await resolveModel()),
      schema: branchSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text" as const, text: prompt }] }],
    });
    turn.branches.push({
      starterId,
      scenarios: object.scenarios,
      exitLine: object.exitLine,
      createdAt: new Date(),
    });
    await session.save();
    return res.status(201).json(object);
  } catch (err) {
    console.error("POST /api/sessions/:uuid/branches failed:", err);
    return res.status(502).json({ error: "AI request failed" });
  }
});

export default router;
