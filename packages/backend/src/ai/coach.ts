import { tool } from "ai";
import { z } from "zod";
import { CONNECTION_STAGES } from "../models/Connection.js";

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
- Do not format every reply as a list of options. Only produce a set of distinct approaches when the user explicitly asks for approach options.`;

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

/**
 * Draft a tracked connection from the current conversation. This only proposes
 * a structured summary — nothing is saved until the user reviews and confirms
 * it in the app. Use it when the user reports meeting someone or tells you how
 * an approach or interaction went, or when the user asks to save an approach.
 */
const connectionDraftSchema = z.object({
  name: z
    .string()
    .describe("The person's name or a short nickname. Required — ask if unknown."),
  stage: z
    .enum(CONNECTION_STAGES)
    .describe(
      "Your read of where this stands now: approached, talking, contact, dating, intimate, relationship, engaged, married, failed or ghosted.",
    ),
  summary: z
    .string()
    .describe("1-2 sentence summary of the situation and where it stands."),
  whatHappened: z
    .string()
    .describe(
      "Close summary of the interaction so far: what the user said, how she responded, and how it went.",
    ),
  metLocation: z.string().optional().describe("Where they met, if known."),
  metAt: z
    .string()
    .optional()
    .describe("When they met, as an ISO date/time if known."),
  approachOpener: z
    .string()
    .optional()
    .describe("The exact opener / first line the user used, if known."),
  nextMove: z
    .string()
    .optional()
    .describe("Your suggested next move to advance the connection."),
  contact: z
    .object({
      type: z.enum(["number", "social", "none"]),
      value: z.string().optional(),
    })
    .optional()
    .describe("Whether contact details were exchanged."),
  targetConnectionId: z
    .string()
    .optional()
    .describe(
      "Set only when logging onto an EXISTING connection the user already told you about; include its uuid. Leave empty to propose a brand-new connection.",
    ),
});

export const proposeConnection = tool({
  description:
    "Propose (do not save) a tracked connection summarizing who the user met and how it went. Use when the user reports meeting someone, describes how an approach or interaction went, or asks to save/log an approach. Nothing is persisted until the user confirms.",
  inputSchema: connectionDraftSchema,
  execute: async (input) => input,
});

export const chatTools = { proposeApproaches, proposeBranches, proposeConnection };

export type StarterOutput = z.infer<typeof starterSchema>;
export type BranchesOutput = z.infer<typeof branchesSchema>;
export type ConnectionDraftOutput = z.infer<typeof connectionDraftSchema>;
