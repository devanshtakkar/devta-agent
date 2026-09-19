import { z } from "zod";

export const SYSTEM_PROMPT = `You are a respectful, consent-first dating wingman. Your job is to help the user start a polite conversation in a public or social scenario.

Hard rules:
- Always respectful and consent-first. Never suggest manipulation, pressure, negging, deception, or persistence after disinterest.
- No explicit, sexual, or objectifying content. Keep every suggestion clean and appropriate for strangers in public.
- Assume the other person may not be interested, and that is completely fine.
- Every response must include a graceful-exit option so the user can bow out kindly at any time.
- Keep language short, skimmable, and actionable: the user is in a live moment and needs an idea in seconds.`;

const starterSchema = z.object({
  overview: z.string().describe("One or two sentence read of the situation."),
  starters: z
    .array(
      z.object({
        id: z.string().describe("Short unique id, e.g. 's1'."),
        title: z.string().describe("Short label for this approach."),
        openerLine: z
          .string()
          .describe("The exact first line the user can say."),
        why: z
          .string()
          .describe("One short sentence on why this fits the situation."),
        risk: z.enum(["low", "medium", "high"]),
        nextMove: z
          .string()
          .describe("The exact follow-up if they respond positively."),
      }),
    )
    .min(4)
    .max(5),
});

const branchSchema = z.object({
  scenarios: z
    .array(
      z.object({
        herResponse: z
          .string()
          .describe("A plausible way she might respond."),
        yourReply: z
          .string()
          .describe("The exact reply the user can say next."),
        tip: z.string().describe("One short tip for reading the moment."),
      }),
    )
    .length(3),
  exitLine: z
    .string()
    .describe("A polite graceful-exit line to leave the conversation kindly."),
});

export { starterSchema, branchSchema };
export type StarterOutput = z.infer<typeof starterSchema>;
export type BranchOutput = z.infer<typeof branchSchema>;
