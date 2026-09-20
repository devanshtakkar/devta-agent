import mongoose, { Schema, type InferSchemaType } from "mongoose";

const starterSubSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    openerLine: { type: String, required: true },
    why: { type: String, required: true },
    risk: { type: String, enum: ["low", "medium", "high"], required: true },
    nextMove: { type: String, required: true },
  },
  { _id: false },
);

const branchScenarioSubSchema = new Schema(
  {
    herResponse: { type: String, required: true },
    yourReply: { type: String, required: true },
    tip: { type: String, required: true },
  },
  { _id: false },
);

const branchSubSchema = new Schema(
  {
    starterId: { type: String },
    scenarios: { type: [branchScenarioSubSchema], required: true },
    exitLine: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const turnSubSchema = new Schema(
  {
    situation: { type: String, required: true },
    overview: { type: String, required: true },
    starters: { type: [starterSubSchema], required: true },
    branches: { type: [branchSubSchema], default: [] },
    error: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSessionSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, default: "New chat" },
    turns: { type: [turnSubSchema], default: [] },
  },
  { timestamps: true },
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export type ChatSessionDoc = InferSchemaType<typeof chatSessionSchema>;

export const ChatSession =
  mongoose.models.ChatSession ??
  mongoose.model("ChatSession", chatSessionSchema);
