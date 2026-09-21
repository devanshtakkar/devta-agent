import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { setConfig } from "../services/config.js";
import {
  getCurrentModelInfo,
  getModelSettings,
  isValidModelId,
  MAX_AVAILABLE_MODELS,
  normalizeModelIds,
  setAvailableModels,
} from "../services/model-info.js";

const router: Router = Router();

router.get("/", requireAuth, async (_req: Request, res: Response) => {
  try {
    return res.json(await getModelSettings());
  } catch (err) {
    console.error("GET /api/models failed:", err);
    return res.status(500).json({ error: "Failed to read model settings" });
  }
});

const settingsBodySchema = z.object({
  models: z.array(z.string().min(1).max(160)).min(1).max(MAX_AVAILABLE_MODELS),
  defaultModel: z.string().min(1).max(160),
});

router.put("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = settingsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const models = normalizeModelIds(parsed.data.models);
  if (models.length !== parsed.data.models.length) {
    return res.status(400).json({ error: "Some model ids are invalid or duplicated" });
  }
  const defaultModel = parsed.data.defaultModel.trim();
  if (!isValidModelId(defaultModel)) {
    return res.status(400).json({ error: "Invalid default model id" });
  }
  if (!models.includes(defaultModel)) {
    return res.status(400).json({ error: "The default model must be in the list" });
  }
  try {
    await setAvailableModels(models);
    await setConfig("OPENROUTER_MODEL", defaultModel);
    return res.json({ models, defaultModel });
  } catch (err) {
    console.error("PUT /api/models failed:", err);
    return res.status(500).json({ error: "Failed to save model settings" });
  }
});

router.get("/current", requireAuth, async (_req: Request, res: Response) => {
  try {
    const info = await getCurrentModelInfo();
    return res.json(info);
  } catch (err) {
    console.error("GET /api/models/current failed:", err);
    return res.status(500).json({ error: "Failed to read model info" });
  }
});

export default router;
