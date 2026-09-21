import { randomUUID } from "node:crypto";
import {
  Connection,
  type ConnectionEventType,
  type ConnectionStage,
} from "../models/Connection.js";

export interface EventInput {
  type: ConnectionEventType;
  title: string;
  details?: string;
  occurredAt?: string | Date;
  location?: string;
  sessionId?: string;
  toolCallId?: string;
}

export interface CreateConnectionInput {
  originSessionId?: string;
  name: string;
  stage?: ConnectionStage;
  summary?: string;
  metLocation?: string;
  metAt?: string | Date;
  approachOpener?: string;
  notes?: string;
  rating?: number;
  event?: EventInput;
  toolCallId?: string;
}

interface StoredEvent {
  id: string;
  type: ConnectionEventType;
  title: string;
  details?: string;
  occurredAt: Date;
  location?: string;
  sessionId?: string;
  toolCallId?: string;
}

function toDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function buildEvent(input: EventInput): StoredEvent {
  return {
    id: randomUUID(),
    type: input.type,
    title: input.title,
    details: input.details,
    occurredAt: toDate(input.occurredAt) ?? new Date(),
    location: input.location,
    sessionId: input.sessionId,
    toolCallId: input.toolCallId,
  };
}

/** Apply a stage change, recording a `stage_change` event when it moves. */
function applyStage(
  conn: { stage: ConnectionStage; events: unknown[] },
  stage: ConnectionStage | undefined,
  sessionId: string | undefined,
  toolCallId: string | undefined,
) {
  if (!stage || stage === conn.stage) return;
  const previous = conn.stage;
  conn.stage = stage;
  conn.events.push(
    buildEvent({
      type: "stage_change",
      title: `Moved to ${stage}`,
      details: `Previously ${previous}.`,
      sessionId,
      toolCallId,
    }) as never,
  );
}

/**
 * Create the connection for a chat session, or log onto the one it already
 * owns. A session has at most one connection, so re-saving from the same chat
 * appends an event instead of creating a duplicate.
 */
export async function saveConnection(userId: string, input: CreateConnectionInput) {
  if (input.originSessionId) {
    const existing = await Connection.findOne({
      userId,
      originSessionId: input.originSessionId,
    });
    if (existing) {
      if (input.event) {
        existing.events.push(buildEvent(input.event) as never);
      }
      applyStage(existing, input.stage, input.originSessionId, input.toolCallId);
      if (input.toolCallId) existing.savedToolCallIds.push(input.toolCallId);
      await existing.save();
      return { doc: existing, created: false };
    }
  }

  const doc = await Connection.create({
    uuid: randomUUID(),
    userId,
    originSessionId: input.originSessionId,
    name: input.name,
    stage: input.stage ?? "approached",
    summary: input.summary,
    metLocation: input.metLocation,
    metAt: toDate(input.metAt),
    approachOpener: input.approachOpener,
    notes: input.notes,
    rating: input.rating,
    events: input.event ? [buildEvent(input.event)] : [],
    savedToolCallIds: input.toolCallId ? [input.toolCallId] : [],
  });
  return { doc, created: true };
}

/**
 * Append an interaction to a connection. When `stage` is supplied it becomes
 * the connection's current stage and a matching `stage_change` event is
 * recorded so the timeline keeps the full history.
 */
export async function appendEvent(
  userId: string,
  uuid: string,
  input: EventInput & { stage?: ConnectionStage },
) {
  const conn = await Connection.findOne({ uuid, userId });
  if (!conn) return null;

  conn.events.push(buildEvent(input) as never);
  applyStage(conn, input.stage, input.sessionId, input.toolCallId);
  if (input.toolCallId) conn.savedToolCallIds.push(input.toolCallId);

  await conn.save();
  return conn;
}

/** Remove a single event from a connection's timeline. */
export async function deleteEvent(userId: string, uuid: string, eventId: string) {
  const conn = await Connection.findOne({ uuid, userId });
  if (!conn) return null;
  const index = conn.events.findIndex((e: { id: string }) => e.id === eventId);
  if (index === -1) return conn;
  conn.events.splice(index, 1);
  await conn.save();
  return conn;
}
