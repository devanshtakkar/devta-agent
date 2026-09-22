import mongoose, { Schema } from "mongoose";

/** Risk levels a starter can carry, mirrored from the approach tool output. */
export const SAVED_APPROACH_RISKS = ["low", "medium", "high"] as const;

export type SavedApproachRisk = (typeof SAVED_APPROACH_RISKS)[number];

const starterSubSchema = new Schema(
  {
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    openerLine: { type: String, required: true },
    why: { type: String, default: "" },
    risk: { type: String, enum: SAVED_APPROACH_RISKS, default: "low" },
    nextMove: { type: String, default: "" },
    gracefulExit: { type: String, default: "" },
  },
  { _id: false },
);

const savedApproachSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    /** Normalized opener line — the dedup identity within a user's list. */
    openerKey: { type: String, required: true },
    scenario: { type: String, required: true },
    starter: { type: starterSubSchema, required: true },
    /** The agent's read of the situation this option came from, if any. */
    overview: { type: String },
    /** The chat it was saved from, if any. */
    sessionId: { type: String },
    /** Client-provided save time; the list is ordered by this. */
    savedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

savedApproachSchema.index({ userId: 1, openerKey: 1 }, { unique: true });
savedApproachSchema.index({ userId: 1, savedAt: -1 });

export type SavedApproachDoc = mongoose.InferSchemaType<typeof savedApproachSchema>;

export const SavedApproach =
  mongoose.models.SavedApproach ??
  mongoose.model("SavedApproach", savedApproachSchema);
