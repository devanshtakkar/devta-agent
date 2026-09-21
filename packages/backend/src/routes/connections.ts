import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import {
  CONNECTION_EVENT_TYPES,
  CONNECTION_STAGES,
  Connection,
  type ConnectionEventType,
  type ConnectionStage,
} from "../models/Connection.js";
import { appendEvent, deleteEvent, saveConnection } from "../services/connections.js";

const router: Router = Router();

const uuidParamSchema = z.object({ uuid: z.string().uuid("invalid connection id") });

const stageSchema = z.enum(CONNECTION_STAGES);
const eventTypeSchema = z.enum(CONNECTION_EVENT_TYPES);

const eventBodySchema = z.object({
  type: eventTypeSchema,
  title: z.string().trim().min(1, "title is required").max(200),
  details: z.string().max(4000).optional(),
  occurredAt: z.string().optional(),
  location: z.string().max(200).optional(),
  sessionId: z.string().optional(),
  toolCallId: z.string().optional(),
  stage: stageSchema.optional(),
});

const createBodySchema = z.object({
  originSessionId: z.string().optional(),
  name: z.string().trim().min(1, "name is required").max(120),
  stage: stageSchema.optional(),
  summary: z.string().max(2000).optional(),
  metLocation: z.string().max(200).optional(),
  metAt: z.string().optional(),
  approachOpener: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  rating: z.number().int().min(1).max(10).optional(),
  event: eventBodySchema.optional(),
  toolCallId: z.string().optional(),
});

const patchBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  stage: stageSchema.optional(),
  summary: z.string().max(2000).nullable().optional(),
  metLocation: z.string().max(200).nullable().optional(),
  metAt: z.string().nullable().optional(),
  approachOpener: z.string().max(2000).nullable().optional(),
  closedReason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
});

type LeanConnection = {
  uuid: string;
  originSessionId?: string;
  name: string;
  stage: ConnectionStage;
  summary?: string;
  metLocation?: string;
  metAt?: Date;
  approachOpener?: string;
  closedReason?: string;
  notes?: string;
  rating?: number;
  events: {
    id: string;
    type: ConnectionEventType;
    title: string;
    details?: string;
    occurredAt: Date;
    location?: string;
    sessionId?: string;
    toolCallId?: string;
  }[];
  savedToolCallIds?: string[];
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

function toDTO(doc: LeanConnection) {
  return {
    uuid: doc.uuid,
    originSessionId: doc.originSessionId,
    name: doc.name,
    stage: doc.stage,
    summary: doc.summary,
    metLocation: doc.metLocation,
    metAt: doc.metAt ? iso(doc.metAt) : undefined,
    approachOpener: doc.approachOpener,
    closedReason: doc.closedReason,
    notes: doc.notes,
    rating: doc.rating,
    events: (doc.events ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      details: e.details,
      occurredAt: iso(e.occurredAt),
      location: e.location,
      sessionId: e.sessionId,
      toolCallId: e.toolCallId,
    })),
    savedToolCallIds: doc.savedToolCallIds ?? [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const filter: Record<string, unknown> = { userId };
  if (sessionId) filter.originSessionId = sessionId;
  const docs = await Connection.find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean<LeanConnection[]>();
  return res.json({ connections: docs.map(toDTO) });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  try {
    const { doc, created } = await saveConnection(getUserId(req), parsed.data);
    return res
      .status(created ? 201 : 200)
      .json(toDTO(doc.toObject() as LeanConnection));
  } catch (err) {
    console.error("POST /api/connections failed:", err);
    return res.status(500).json({ error: "Failed to save connection" });
  }
});

router.get("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid connection id" });
  const doc = await Connection.findOne({
    uuid: parsed.data.uuid,
    userId: getUserId(req),
  }).lean<LeanConnection | null>();
  if (!doc) return res.status(404).json({ error: "Connection not found" });
  return res.json(toDTO(doc));
});

router.patch("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid connection id" });
  const parsedBody = patchBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }
  const patch: Record<string, unknown> = { ...parsedBody.data };
  if (parsedBody.data.metAt !== undefined) {
    const d = parsedBody.data.metAt ? new Date(parsedBody.data.metAt) : null;
    patch.metAt = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  const doc = await Connection.findOneAndUpdate(
    { uuid: parsedParam.data.uuid, userId: getUserId(req) },
    { $set: patch },
    { new: true },
  ).lean<LeanConnection | null>();
  if (!doc) return res.status(404).json({ error: "Connection not found" });
  return res.json(toDTO(doc));
});

router.post("/:uuid/events", requireAuth, async (req: Request, res: Response) => {
  const parsedParam = uuidParamSchema.safeParse(req.params);
  if (!parsedParam.success) return res.status(400).json({ error: "Invalid connection id" });
  const parsedBody = eventBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsedBody.error.flatten() });
  }
  const doc = await appendEvent(getUserId(req), parsedParam.data.uuid, parsedBody.data);
  if (!doc) return res.status(404).json({ error: "Connection not found" });
  return res.status(201).json(toDTO(doc.toObject() as LeanConnection));
});

router.delete(
  "/:uuid/events/:eventId",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = z
      .object({ uuid: z.string().uuid("invalid connection id"), eventId: z.string().min(1) })
      .safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const doc = await deleteEvent(getUserId(req), parsed.data.uuid, parsed.data.eventId);
    if (!doc) return res.status(404).json({ error: "Connection not found" });
    return res.json(toDTO(doc.toObject() as LeanConnection));
  },
);

router.delete("/:uuid", requireAuth, async (req: Request, res: Response) => {
  const parsed = uuidParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid connection id" });
  const result = await Connection.deleteOne({
    uuid: parsed.data.uuid,
    userId: getUserId(req),
  });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Connection not found" });
  return res.status(204).end();
});

export default router;
