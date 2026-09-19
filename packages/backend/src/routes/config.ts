import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getConfig, isConfigKey, setConfig } from "../services/config.js";

const router: Router = Router();

const putBodySchema = z.object({
  value: z.string().min(1, "value is required").max(500),
});

router.get("/:key", requireAuth, async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!isConfigKey(key)) {
    return res.status(404).json({ error: "Unknown config key" });
  }
  try {
    const value = await getConfig(key);
    return res.json({ key, value });
  } catch (err) {
    console.error(`GET /api/config/${key} failed:`, err);
    return res.status(500).json({ error: "Failed to read config" });
  }
});

router.put("/:key", requireAuth, async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!isConfigKey(key)) {
    return res.status(404).json({ error: "Unknown config key" });
  }
  const parsed = putBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  try {
    const value = await setConfig(key, parsed.data.value);
    return res.json({ key, value });
  } catch (err) {
    console.error(`PUT /api/config/${key} failed:`, err);
    return res.status(400).json({ error: "Failed to update config" });
  }
});

export default router;
