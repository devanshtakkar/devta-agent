import mongoose, { Schema } from "mongoose";

/** Stage ladder a connection moves through. Terminal: failed / ghosted. */
export const CONNECTION_STAGES = [
  "approached",
  "talking",
  "contact",
  "dating",
  "intimate",
  "relationship",
  "engaged",
  "married",
  "failed",
  "ghosted",
] as const;

export type ConnectionStage = (typeof CONNECTION_STAGES)[number];

export const CONNECTION_EVENT_TYPES = [
  "approach",
  "reply",
  "number",
  "date_planned",
  "date_done",
  "intimacy",
  "stage_change",
  "failure",
  "note",
] as const;

export type ConnectionEventType = (typeof CONNECTION_EVENT_TYPES)[number];

const eventSubSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: CONNECTION_EVENT_TYPES, required: true },
    title: { type: String, required: true },
    details: { type: String },
    occurredAt: { type: Date, required: true },
    location: { type: String },
    /** Chat session this event was logged from, if any. */
    sessionId: { type: String },
    /** Chat tool call that produced this event, if any. */
    toolCallId: { type: String },
  },
  { _id: false },
);

const connectionSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    /**
     * The chat session this connection belongs to. A session owns at most one
     * connection (enforced by the partial unique index below); the connection
     * remembers which chat it came from.
     */
    originSessionId: { type: String, index: true },
    name: { type: String, required: true },
    stage: { type: String, enum: CONNECTION_STAGES, required: true, default: "approached" },
    summary: { type: String },
    metLocation: { type: String },
    metAt: { type: Date },
    approachOpener: { type: String },
    closedReason: { type: String },
    notes: { type: String },
    rating: { type: Number, min: 1, max: 10 },
    events: { type: [eventSubSchema], default: [] },
    /** Chat tool calls whose proposals have already been saved. */
    savedToolCallIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

connectionSchema.index({ userId: 1, updatedAt: -1 });
connectionSchema.index(
  { userId: 1, originSessionId: 1 },
  { unique: true, partialFilterExpression: { originSessionId: { $type: "string" } } },
);

export type ConnectionDoc = mongoose.InferSchemaType<typeof connectionSchema>;

export const Connection =
  mongoose.models.Connection ?? mongoose.model("Connection", connectionSchema);
