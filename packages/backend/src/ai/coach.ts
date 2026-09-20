import { tool } from "ai";
import { z } from "zod";
import {
  CONNECTION_STATUSES,
  EVENT_TYPES,
} from "../models/Connection.js";
import { GLOBAL_PRINCIPLES, STAGE_PLAYBOOK } from "./playbook.js";

export const SYSTEM_PROMPT = `You are Devta, a respectful, consent-first dating wingman whose end goal is to help the user build genuine, consensual relationships that can grow into something serious and, eventually, marriage.

Your coaching:
- Respectful and consent-first, always. You may bend social convention slightly in the user's favour, but never cross into creepy, manipulative, deceptive, or pushy territory. Never suggest negging, deception, guilt-tripping, or persistence after clear disinterest.
- Ground advice in real courtship psychology: attraction, tension, playful teasing, warmth, leading with intent, and confident framing that stirs romantic feelings rather than friendly-only rapport.
- Actively keep the user out of the friendzone and avoid "nice guy" patterns. Coach him to signal romantic interest clearly instead of playing safe, over-giving, or seeking approval.
- No explicit, sexual, or objectifying content. Keep everything clean and appropriate for strangers in public.
- Assume the other person may not be interested, and that is completely fine.
- Always include a graceful exit: every next move you suggest must let the user bow out kindly and keep his dignity, whatever the response.
- The user is often in a live moment and needs something actionable in seconds. Be concise and skimmable: lead with the exact thing to say or do, then a short why. Prefer short paragraphs or tight bullets over long essays.
- Talk like a supportive wingman in a normal chat. Ask one short clarifying question when the scene is missing key detail (who, where, what's happening) instead of guessing.
- Do not format every reply as a list of options. Only produce a set of distinct approaches when the user explicitly asks for approach options.

Coaching model — always move the connection forward without pressure:
${GLOBAL_PRINCIPLES.map((p) => `- ${p}`).join("\n")}

Stage ladder and the default next move at each stage:
${STAGE_PLAYBOOK.map(
  (s) => `- ${s.label} (${s.stage}): ${s.intent} Next move: ${s.nextMove}`,
).join("\n")}

Tracking:
- The user tracks each girl as a "connection" with a stage and a timeline.
- When the user reports a real-world outcome (opener sent, she replied, number exchanged, date planned or done, intimacy, relationship progress, rejection, ghosting) or asks to save/update a girl, call proposeConnectionUpdate with the details you actually know.
- Never invent names, places, times or events. If a key detail is missing, ask one short question first.
- proposeConnectionUpdate only proposes; the user confirms in the app, so keep fields factual and concise.`;

export const SYSTEM_PROMPT_WITH_DOSSIER = (dossier?: string) =>
  dossier
    ? `${SYSTEM_PROMPT}\n\n---\nCurrent tracker context (real data — use it to pick up where you left off, do not repeat it back verbatim):\n${dossier}`
    : SYSTEM_PROMPT;

const approachSchema = z.object({
  id: z.string().describe("Short unique id, e.g. 's1'."),
  title: z.string().describe("Short label for this approach."),
  openerLine: z.string().describe("The exact first line the user can say."),
  why: z.string().describe("One short sentence on why this fits the situation."),
  risk: z.enum(["low", "medium", "high"]),
  nextMove: z
    .string()
    .describe("The exact follow-up if they respond positively."),
  gracefulExit: z
    .string()
    .describe(
      "A short, kind line the user can use to bow out gracefully if the other person is not interested.",
    ),
});

export const starterSchema = z.object({
  overview: z.string().describe("One or two sentence read of the situation."),
  starters: z.array(approachSchema).min(4).max(5),
});

export const proposeApproaches = tool({
  description:
    "Compose 4-5 distinct, ready-to-use approaches the user can act on right now. Use this only when the user asks for approach options.",
  inputSchema: starterSchema,
  execute: async (input) => input,
});

const branchScenarioSchema = z.object({
  id: z.string().describe("Short unique id, e.g. 'b1'."),
  reaction: z
    .string()
    .describe("Short label of how she might react, e.g. 'She smiles and leans in'."),
  read: z
    .string()
    .describe("One short line on what her reaction signals and how to read it."),
  move: z
    .string()
    .describe("The exact thing the user says or does next in this branch."),
  outcome: z
    .string()
    .describe("Where this branch can lead if it keeps going well."),
});

export const branchesSchema = z.object({
  opener: z.string().describe("The opener being branched from."),
  branches: z.array(branchScenarioSchema).min(2).max(4),
});

export const proposeBranches = tool({
  description:
    "Given an opener the user is about to use, brainstorm 2-4 ways the conversation could branch out based on how she reacts, so the user is prepared in advance. Use this only when the user asks how the conversation could branch out.",
  inputSchema: branchesSchema,
  execute: async (input) => input,
});

const connectionUpdateSchema = z.object({
  action: z
    .enum(["create", "log"])
    .describe("create a new connection, or log an event on an existing one."),
  connectionName: z.string().describe("Her name or a short label for her."),
  connectionId: z
    .string()
    .optional()
    .describe("Existing connection uuid, when known."),
  stage: z
    .enum(CONNECTION_STATUSES)
    .optional()
    .describe("New stage, if the outcome changes it."),
  eventType: z.enum(EVENT_TYPES).optional().describe("Kind of event that happened."),
  title: z.string().optional().describe("Short summary title for the event."),
  details: z.string().optional().describe("What happened, in the user's words."),
  occurredAt: z.string().optional().describe("ISO date/time it happened, if known."),
  location: z.string().optional().describe("Where it happened."),
  metLocation: z.string().optional().describe("Where they met (create only)."),
  metAt: z.string().optional().describe("When they met (create only)."),
  metContext: z.string().optional().describe("Scene/context when they met."),
  approachOpener: z.string().optional().describe("The opener used, if known."),
  nextMove: z.string().optional().describe("The agreed next move."),
  notes: z.string().optional().describe("Freeform notes."),
});

export type ConnectionUpdateInput = z.infer<typeof connectionUpdateSchema>;

export const proposeConnectionUpdate = tool({
  description:
    "Propose creating or updating a tracked connection (a girl) with a real-world outcome. Use when the user reports what happened or asks to save/update a girl. This only proposes — the user confirms in the app. Never invent details.",
  inputSchema: connectionUpdateSchema,
  execute: async (input) => input,
});

export const chatTools = { proposeApproaches, proposeBranches, proposeConnectionUpdate };

export type StarterOutput = z.infer<typeof starterSchema>;
export type BranchesOutput = z.infer<typeof branchesSchema>;
