import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import {
  CONNECTION_STATUSES,
  EVENT_TYPES,
} from "../models/Connection.js";
import {
  addEvent,
  createConnection,
  deleteConnection,
  getConnection,
  listConnections,
  linkSession,
  overview,
  updateConnection,
} from "../services/connections.js";
import {
  EVENT_TYPE_META,
  GLOBAL_PRINCIPLES,
  STAGE_PLAYBOOK,
} from "../ai/playbook.js";

const router: Router = Router();

const stageEnum = z.enum(CONNECTION_STATUSES);
const eventTypeEnum = z.enum(EVENT_TYPES);

const uuidParamSchema = z.object({ uuid: z.string().uuid("invalid connection id") });

const createSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  metLocation: z.string().trim().max(200).optional(),
  metAt: z.string().optional(),
  metContext: z.string().max(2000).optional(),
  approachOpener: z.string().max(1000).optional(),
  approachRisk: z.enum(["low", "medium", "high"]).optional(),
  stage: stageEnum.optional(),
  nextMove: z.string().max(1000).optional(),
  notes: z.string().max(4000).optional(),
  rating: z.number().min(0).max(5).optional(),
  milestones: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  closedReason: z.string().max(1000).optional(),
});

const eventSchema = z.object({
  type: eventTypeEnum,
  title: z.string().max(200).optional(),
  details: z.string().max(4000).optional(),
  occurredAt: z.string().optional(),
  location: z.string().max(200).optional(),
  stage: stageEnum.optional(),
  sessionId: z.string().optional(),
});

function getUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown; _id?: unknown } }).user;
  const id = user?.id ?? user?._id;
  return String(id ?? "");
}

function strip(doc: unknown) {
  if (!doc || typeof doc !== "object") return doc;
  const { _id, __v, ...rest } = doc as Record<string, unknown>;
  return rest;
}

// NOTE: static paths must be declared before `/:uuid`.
router.get("/playbook", requireAuth, (_req: Request, res: Response) => {
  return res.json({
    stages: STAGE_PLAYBOOK,
    eventTypes: EVENT_TYPES.map((t) => EVENT_TYPE_META[t]),
    principles: GLOBAL_PRINCIPLES,
  });
});

router.get("/overview", requireAuth, async (req: Request, res: Response) => {
  try {
    return res.json(await overview(getUserId(req)));
  } catch (err) {
    console.error("GET /api/connections/overview failed:", err);
    return res.status(500).json({ error: "Failed to load overview" });
  }
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  try {
    const connections = await listConnections(getUserId(req), { stage, q });
    return res.json({ connections: connections.map((c) => strip(c)) });
  } catch (err) {
    console.error("GET /api/connections failed:", err);
    return res.status(500).json({ error: "Failed to load connections" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const { sessionId, ...input } = parsed.data;
  try {
    const created = await createConnection(getUserId(req), input);
    if (sessionId) {
      await linkSession(getUserId(req), created.uuid, sessionId);
    }
    return res.status(201).json(strip(created));
  } catch (err) {
    console.error("POST /api/connections failed:", err);
    return res.status(500).json({ error: "Failed to create connection" });
  }
});

router.get("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid connection id" });
  const doc = await getConnection(getUserId(req), parsed.data.uuid);
  if (!doc) return res.status(404).json({ error: "Connection not found" });
  return res.json(strip(doc));
});

router.patch("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid connection id" });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  try {
    const updated = await updateConnection(
      getUserId(req),
      parsedParam.data.uuid,
      parsed.data,
    );
    if (!updated) return res.status(404).json({ error: "Connection not found" });
    return res.json(strip(updated));
  } catch (err) {
    console.error("PATCH /api/connections/:uuid failed:", err);
    return res.status(500).json({ error: "Failed to update connection" });
  }
});

router.delete("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid connection id" });
  const removed = await deleteConnection(getUserId(req), parsed.data.uuid);
  if (!removed) return res.status(404).json({ error: "Connection not found" });
  return res.status(204).end();
});

router.post("/:uuid/events", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid connection id" });
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  try {
    const updated = await addEvent(
      getUserId(req),
      parsedParam.data.uuid,
      parsed.data,
    );
    if (!updated) return res.status(404).json({ error: "Connection not found" });
    return res.status(201).json(strip(updated));
  } catch (err) {
    console.error("POST /api/connections/:uuid/events failed:", err);
    return res.status(500).json({ error: "Failed to log event" });
  }
});

export default router;
