import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth.js";
import { getCurrentModelInfo } from "../services/model-info.js";

const router: Router = Router();

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
