import mongoose, { Schema } from "mongoose";

const messageSubSchema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    parts: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const usageSubSchema = new Schema(
  {
    model: { type: String },
    contextLength: { type: Number },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    totalTokens: { type: Number },
  },
  { _id: false },
);

const chatSessionSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, default: "New chat" },
    messages: { type: [messageSubSchema], default: [] },
    usage: { type: usageSubSchema, default: undefined },
  },
  { timestamps: true },
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export type ChatSessionDoc = mongoose.InferSchemaType<typeof chatSessionSchema>;

export const ChatSession =
  mongoose.models.ChatSession ??
  mongoose.model("ChatSession", chatSessionSchema);
