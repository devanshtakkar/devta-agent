import mongoose, { Schema } from "mongoose";

const shift = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["sighting", "declared"], required: true },
    occurredOn: String,
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: String,
    note: String,
  },
  { _id: false },
);
const schema = new Schema(
  {
    uuid: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    venue: { type: String, required: true },
    venueType: {
      type: String,
      enum: ["cafe", "restaurant", "grocery", "other"],
      default: "other",
    },
    role: String,
    notes: String,
    status: {
      type: String,
      enum: ["watching", "approached", "paused"],
      default: "watching",
    },
    shifts: { type: [shift], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true },
);
schema.index({ userId: 1, updatedAt: -1 });
export const Regular =
  mongoose.models.Regular ?? mongoose.model("Regular", schema);
