import mongoose, { Schema } from "mongoose";

/** Ordered progression of a connection, from first approach to marriage. */
export const CONNECTION_STAGES = [
  "approached",
  "talking",
  "contact",
  "dating",
  "intimate",
  "relationship",
  "engaged",
  "married",
] as const;

/** Ways a connection can end without progressing. */
export const CONNECTION_TERMINAL = ["failed", "ghosted"] as const;

export type ConnectionStage = (typeof CONNECTION_STAGES)[number];
export type ConnectionTerminal = (typeof CONNECTION_TERMINAL)[number];
export type ConnectionStatus = ConnectionStage | ConnectionTerminal;

export const CONNECTION_STATUSES = [
  ...CONNECTION_STAGES,
  ...CONNECTION_TERMINAL,
] as const;

/** Kinds of timeline events a connection can have. */
export const EVENT_TYPES = [
  "approach",
  "reply",
  "number",
  "date_planned",
  "date_done",
  "intimate",
  "stage_change",
  "failure",
  "note",
] as const;

export type ConnectionEventType = (typeof EVENT_TYPES)[number];

const eventSubSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    title: { type: String, default: "" },
    details: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
    location: { type: String, default: "" },
    stage: { type: String, enum: CONNECTION_STATUSES },
    sessionId: { type: String },
  },
  { _id: false },
);

const connectionSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    metLocation: { type: String, default: "" },
    metAt: { type: Date },
    metContext: { type: String, default: "" },
    approachOpener: { type: String, default: "" },
    approachRisk: { type: String, enum: ["low", "medium", "high"] },
    stage: {
      type: String,
      enum: CONNECTION_STATUSES,
      default: "approached",
      index: true,
    },
    milestones: { type: [String], default: [] },
    nextMove: { type: String, default: "" },
    closedReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5 },
    lastContactAt: { type: Date },
    events: { type: [eventSubSchema], default: [] },
    sessionIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

connectionSchema.index({ userId: 1, stage: 1, updatedAt: -1 });
connectionSchema.index({ userId: 1, updatedAt: -1 });

export type ConnectionDoc = mongoose.InferSchemaType<typeof connectionSchema>;

export const Connection =
  mongoose.models.Connection ??
  mongoose.model("Connection", connectionSchema);
