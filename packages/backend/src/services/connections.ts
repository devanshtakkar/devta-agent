import { randomUUID } from "node:crypto";
import {
  Connection,
  CONNECTION_STAGES,
  CONNECTION_TERMINAL,
  type ConnectionEventType,
  type ConnectionStatus,
} from "../models/Connection.js";
import { EVENT_TYPE_META, STAGE_ORDER, stageLabel } from "../ai/playbook.js";

export interface ConnectionInput {
  name: string;
  metLocation?: string;
  metAt?: string | Date;
  metContext?: string;
  approachOpener?: string;
  approachRisk?: "low" | "medium" | "high";
  stage?: ConnectionStatus;
  nextMove?: string;
  notes?: string;
  rating?: number;
  milestones?: string[];
}

export interface ConnectionUpdateInput extends Partial<ConnectionInput> {
  closedReason?: string;
  lastContactAt?: string | Date;
}

export interface ConnectionEventInput {
  type: ConnectionEventType;
  title?: string;
  details?: string;
  occurredAt?: string | Date;
  location?: string;
  stage?: ConnectionStatus;
  sessionId?: string;
}

function isTerminal(stage: string): boolean {
  return (CONNECTION_TERMINAL as readonly string[]).includes(stage);
}

function toDate(value: string | Date | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function clean<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export async function createConnection(userId: string, input: ConnectionInput) {
  const doc = await Connection.create({
    uuid: randomUUID(),
    userId,
    name: input.name.trim(),
    metLocation: input.metLocation ?? "",
    metAt: toDate(input.metAt),
    metContext: input.metContext ?? "",
    approachOpener: input.approachOpener ?? "",
    approachRisk: input.approachRisk,
    stage: input.stage ?? "approached",
    nextMove: input.nextMove ?? "",
    notes: input.notes ?? "",
    rating: input.rating,
    milestones: input.milestones ?? [],
    lastContactAt: new Date(),
  });
  return doc.toObject();
}

export async function listConnections(
  userId: string,
  opts: { stage?: string; q?: string } = {},
) {
  const filter: Record<string, unknown> = { userId };
  if (opts.stage) filter.stage = opts.stage;
  if (opts.q) {
    filter.name = { $regex: opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }
  return Connection.find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
}

export async function getConnection(userId: string, uuid: string) {
  return Connection.findOne({ uuid, userId }).lean();
}

export async function updateConnection(
  userId: string,
  uuid: string,
  input: ConnectionUpdateInput,
) {
  const existing = await Connection.findOne({ uuid, userId });
  if (!existing) return null;

  const patch = clean({
    name: input.name?.trim(),
    metLocation: input.metLocation,
    metAt: toDate(input.metAt),
    metContext: input.metContext,
    approachOpener: input.approachOpener,
    approachRisk: input.approachRisk,
    stage: input.stage,
    nextMove: input.nextMove,
    notes: input.notes,
    rating: input.rating,
    closedReason: input.closedReason,
    lastContactAt: toDate(input.lastContactAt),
    ...(input.milestones ? { milestones: input.milestones } : {}),
  });

  if (input.stage && input.stage !== existing.stage) {
    existing.events.push({
      id: randomUUID(),
      type: "stage_change",
      title: `Moved to ${stageLabel(input.stage)}`,
      details: "",
      occurredAt: new Date(),
    } as never);
  }

  Object.assign(existing, patch);
  existing.markModified("events");
  await existing.save();
  return existing.toObject();
}

export async function deleteConnection(userId: string, uuid: string) {
  const result = await Connection.deleteOne({ uuid, userId });
  return result.deletedCount > 0;
}

export async function addEvent(
  userId: string,
  uuid: string,
  input: ConnectionEventInput,
) {
  const existing = await Connection.findOne({ uuid, userId });
  if (!existing) return null;

  const occurredAt = toDate(input.occurredAt) ?? new Date();
  const meta = EVENT_TYPE_META[input.type];

  let nextStage: ConnectionStatus = input.stage ?? existing.stage;
  if (!input.stage) {
    if (input.type === "failure") {
      nextStage = "failed";
    } else if (meta?.advancesTo && !isTerminal(existing.stage)) {
      const current = STAGE_ORDER[existing.stage] ?? -1;
      const target = STAGE_ORDER[meta.advancesTo] ?? -1;
      if (target > current) nextStage = meta.advancesTo;
    }
  }

  existing.events.push({
    id: randomUUID(),
    type: input.type,
    title: input.title ?? meta?.label ?? input.type,
    details: input.details ?? "",
    occurredAt,
    location: input.location ?? "",
    stage: nextStage,
    sessionId: input.sessionId,
  } as never);

  existing.stage = nextStage;
  existing.lastContactAt = occurredAt;
  if (input.sessionId && !existing.sessionIds.includes(input.sessionId)) {
    existing.sessionIds.push(input.sessionId);
  }
  existing.markModified("events");
  await existing.save();
  return existing.toObject();
}

export async function linkSession(
  userId: string,
  uuid: string,
  sessionId: string,
) {
  await Connection.updateOne(
    { uuid, userId },
    { $addToSet: { sessionIds: sessionId } },
  );
}

export interface ConnectionsOverview {
  total: number;
  active: number;
  closed: number;
  byStage: Record<string, number>;
  funnel: { stage: string; label: string; reached: number }[];
}

export async function overview(userId: string): Promise<ConnectionsOverview> {
  const docs = await Connection.find({ userId })
    .select({ stage: 1, events: 1 })
    .lean<{ stage: string; events: { type: string; stage?: string }[] }[]>();

  const byStage: Record<string, number> = {};
  for (const stage of [...CONNECTION_STAGES, ...CONNECTION_TERMINAL]) {
    byStage[stage] = 0;
  }

  const reachedSets: Set<string>[] = [];

  for (const doc of docs) {
    byStage[doc.stage] = (byStage[doc.stage] ?? 0) + 1;
    const set = new Set<string>();
    if (!isTerminal(doc.stage)) set.add(doc.stage);
    for (const ev of doc.events ?? []) {
      if (ev.stage && !isTerminal(ev.stage)) set.add(ev.stage);
    }
    reachedSets.push(set);
  }

  const funnel = CONNECTION_STAGES.map((stage) => ({
    stage,
    label: stageLabel(stage),
    reached: reachedSets.filter((set) => {
      const maxReached = Math.max(
        ...[...set].map((s) => STAGE_ORDER[s] ?? -1),
        -1,
      );
      return maxReached >= (STAGE_ORDER[stage] ?? 0);
    }).length,
  }));

  const active = CONNECTION_STAGES.reduce((sum, s) => sum + (byStage[s] ?? 0), 0);
  const closed = CONNECTION_TERMINAL.reduce(
    (sum, s) => sum + (byStage[s] ?? 0),
    0,
  );

  return { total: docs.length, active, closed, byStage, funnel };
}
