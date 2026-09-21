import { Router, type Request, type Response } from "express";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { resolveModel } from "../services/model-info.js";
import { ChatSession } from "../models/ChatSession.js";

const router: Router = Router();

const bodySchema = z.object({
  starter: z.object({
    title: z.string().trim().min(1).max(120),
    openerLine: z.string().trim().min(1).max(600),
    why: z.string().trim().max(600).optional().default(""),
    nextMove: z.string().trim().max(600).optional().default(""),
    gracefulExit: z.string().trim().max(600).optional().default(""),
  }),
  overview: z.string().trim().max(1200).optional(),
  /** Source chat, so the suggestion can use the live conversation context. */
  sessionId: z.string().uuid().optional(),
  /** Scenario labels the user already has; the model should reuse one if it fits. */
  existing: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
});

const scenarioSchema = z.object({
  scenario: z
    .string()
    .describe(
      "Short scenario label, 1-3 words, Title Case, e.g. 'Gym', 'Cafe', 'Restaurant', 'Rooftop Party'.",
    ),
});

function getUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown; _id?: unknown } }).user;
  const id = user?.id ?? user?._id;
  return String(id ?? "");
}

function messageText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: string; text?: string } =>
        !!p && typeof p === "object" && (p as { type?: unknown }).type === "text",
    )
    .map((p) => p.text ?? "")
    .join(" ")
    .trim();
}

/** Last thing the user said in the source chat, as extra context. */
async function lastUserText(sessionId: string, userId: string): Promise<string> {
  const session = await ChatSession.findOne({ uuid: sessionId, userId }).lean<{
    messages?: { role: string; parts?: unknown }[];
  } | null>();
  if (!session) return "";
  const messages = session.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = messageText(message.parts);
    if (text) return text.slice(0, 1200);
  }
  return "";
}

const SYSTEM = `You label saved conversation openers with the real-life social scenario they belong to.
Reply with a short label of 1-3 words in Title Case, such as "Gym", "Cafe", "Restaurant", "Bookstore", "Rooftop Party", "Bus Stop".
Prefer one of the existing labels when it genuinely fits; otherwise invent a clear new one.
The label is a place/scenario category, never a person's name, an opener, or a sentence. No quotes, emoji, or trailing punctuation.`;

router.post("/suggest", requireAuth, async (req: Request, res: Response) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const { starter, overview, sessionId, existing } = parsed.data;
  const userId = getUserId(req);

  try {
    const context = sessionId ? await lastUserText(sessionId, userId) : "";
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const { object } = await generateObject({
      model: openrouter(await resolveModel()),
      schema: scenarioSchema,
      system: SYSTEM,
      prompt: [
        `Existing scenarios: ${existing?.length ? existing.join(", ") : "none yet"}.`,
        overview ? `Situation read: ${overview}` : "",
        context ? `User's own words from the conversation: ${context}` : "",
        `Opener: “${starter.openerLine}”`,
        `Approach title: ${starter.title}`,
        starter.why ? `Why it fits: ${starter.why}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const scenario = object.scenario
      .replace(/["'`.]+$/g, "")
      .trim()
      .slice(0, 40);
    if (!scenario) {
      return res.status(502).json({ error: "Could not suggest a scenario" });
    }
    return res.json({ scenario });
  } catch (err) {
    console.error("POST /api/scenarios/suggest failed:", err);
    return res.status(502).json({ error: "AI request failed" });
  }
});

export default router;
