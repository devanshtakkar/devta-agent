import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import {
  SAVED_APPROACH_RISKS,
  SavedApproach,
  type SavedApproachRisk,
} from "../models/SavedApproach.js";

const router: Router = Router();

const uuidParamSchema = z.object({
  uuid: z.string().uuid("invalid saved approach id"),
});

const starterSchema = z.object({
  id: z.string().max(100).optional().default(""),
  title: z.string().trim().max(120).optional().default(""),
  openerLine: z.string().trim().min(1, "openerLine is required").max(600),
  why: z.string().max(600).optional().default(""),
  risk: z.enum(SAVED_APPROACH_RISKS).optional().default("low"),
  nextMove: z.string().max(600).optional().default(""),
  gracefulExit: z.string().max(600).optional().default(""),
});

const saveBodySchema = z.object({
  starter: starterSchema,
  scenario: z.string().trim().min(1, "scenario is required").max(40),
  overview: z.string().max(1200).nullish(),
  sessionId: z.string().max(100).nullish(),
  savedAt: z.string().optional(),
});

type LeanSavedApproach = {
  uuid: string;
  openerKey: string;
  scenario: string;
  starter: {
    id?: string;
    title?: string;
    openerLine: string;
    why?: string;
    risk?: SavedApproachRisk;
    nextMove?: string;
    gracefulExit?: string;
  };
  overview?: string;
  sessionId?: string;
  savedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function getUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown; _id?: unknown } }).user;
  const id = user?.id ?? user?._id;
  return String(id ?? "");
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/** Trim + collapse whitespace so the same opener maps to one saved row. */
function openerKeyOf(openerLine: string): string {
  return openerLine.trim().replace(/\s+/g, " ");
}

function toDTO(doc: LeanSavedApproach) {
  return {
    uuid: doc.uuid,
    scenario: doc.scenario,
    starter: {
      id: doc.starter.id ?? "",
      title: doc.starter.title ?? "",
      openerLine: doc.starter.openerLine,
      why: doc.starter.why ?? "",
      risk: doc.starter.risk ?? "low",
      nextMove: doc.starter.nextMove ?? "",
      gracefulExit: doc.starter.gracefulExit ?? "",
    },
    overview: doc.overview,
    sessionId: doc.sessionId,
    savedAt: iso(doc.savedAt),
    updatedAt: iso(doc.updatedAt),
  };
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const docs = await SavedApproach.find({ userId: getUserId(req) })
    .sort({ savedAt: -1 })
    .limit(500)
    .lean<LeanSavedApproach[]>();
  return res.json({ approaches: docs.map(toDTO) });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = saveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const userId = getUserId(req);
  const body = parsed.data;
  const openerKey = openerKeyOf(body.starter.openerLine);
  const savedAt =
    body.savedAt && !Number.isNaN(Date.parse(body.savedAt))
      ? new Date(body.savedAt)
      : new Date();

  const fields = {
    openerKey,
    scenario: body.scenario,
    starter: body.starter,
    overview: body.overview ?? undefined,
    sessionId: body.sessionId ?? undefined,
    savedAt,
  };

  try {
    // Re-saving the same opener moves it to the chosen scenario instead of
    // creating a duplicate row.
    const existing = await SavedApproach.findOne({ userId, openerKey });
    if (existing) {
      existing.set(fields);
      await existing.save();
      return res.json(toDTO(existing.toObject() as LeanSavedApproach));
    }

    try {
      const doc = await SavedApproach.create({ uuid: randomUUID(), userId, ...fields });
      return res.status(201).json(toDTO(doc.toObject() as LeanSavedApproach));
    } catch (err) {
      // Concurrent create on the unique { userId, openerKey } index: update.
      if ((err as { code?: number }).code === 11000) {
        const doc = await SavedApproach.findOneAndUpdate(
          { userId, openerKey },
          { $set: fields },
          { new: true },
        ).lean<LeanSavedApproach | null>();
        if (doc) return res.json(toDTO(doc));
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/saved-approaches failed:", err);
    return res.status(500).json({ error: "Failed to save approach" });
  }
});

router.delete("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid saved approach id" });
  }
  const result = await SavedApproach.deleteOne({
    uuid: parsed.data.uuid,
    userId: getUserId(req),
  });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Saved approach not found" });
  }
  return res.status(204).end();
});

export default router;
