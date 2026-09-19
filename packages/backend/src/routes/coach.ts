import { Router, type Request, type Response } from "express";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { getConfig } from "../services/config.js";
import {
  SYSTEM_PROMPT,
  branchSchema,
  starterSchema,
} from "../ai/coach.js";

const router: Router = Router();

const ideasBodySchema = z.object({
  situation: z.string().min(1, "situation is required").max(2000),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "must be a data:image/...;base64 URL")
    .optional(),
});

const branchBodySchema = z.object({
  situation: z.string().min(1, "situation is required").max(2000),
  starter: z.string().min(1, "starter is required").max(1000),
  herResponse: z.string().max(1000).optional(),
});

async function resolveModel() {
  try {
    return await getConfig("OPENROUTER_MODEL");
  } catch {
    return env.OPENROUTER_MODEL;
  }
}

router.post(
  "/ideas",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = ideasBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { situation, imageDataUrl } = parsed.data;
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
      return res.json(object);
    } catch (err) {
      console.error("POST /api/coach/ideas failed:", err);
      return res.status(502).json({ error: "AI request failed" });
    }
  },
);

router.post(
  "/branch",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = branchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { situation, starter, herResponse } = parsed.data;
    const prompt = herResponse
      ? `Situation: ${situation}\nChosen opener: ${starter}\nShe responded: ${herResponse}\nSuggest 3 ways this could go next, plus a graceful exit line.`
      : `Situation: ${situation}\nChosen opener: ${starter}\nSuggest 3 plausible ways she might respond and what to say next, plus a graceful exit line.`;
    try {
      const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
      const { object } = await generateObject({
        model: openrouter(await resolveModel()),
        schema: branchSchema,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [{ type: "text" as const, text: prompt }] }],
      });
      return res.json(object);
    } catch (err) {
      console.error("POST /api/coach/branch failed:", err);
      return res.status(502).json({ error: "AI request failed" });
    }
  },
);

export default router;
