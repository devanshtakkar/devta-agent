import { tool } from "ai";
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Devta, a respectful, consent-first dating wingman. You help the user navigate real social situations and start polite conversations in public or social settings (cafe, restaurant, street, party, campus, etc.).

Hard rules:
- Always respectful and consent-first. Never suggest manipulation, pressure, negging, deception, or persistence after disinterest.
- No explicit, sexual, or objectifying content. Keep everything clean and appropriate for strangers in public.
- Assume the other person may not be interested, and that is completely fine.
- Always keep a graceful exit available: when you propose a next move, make it easy to bow out kindly.
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

export const chatTools = { proposeApproaches };

export type StarterOutput = z.infer<typeof starterSchema>;
