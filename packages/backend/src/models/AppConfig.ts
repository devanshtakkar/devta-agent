import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const CONFIG_KEYS = ["OPENROUTER_MODEL", "EMAIL_FROM"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

const appConfigSchema = new Schema(
  {
    key: {
      type: String,
      enum: CONFIG_KEYS,
      unique: true,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export type AppConfigDoc = InferSchemaType<typeof appConfigSchema>;

export const AppConfig =
  mongoose.models.AppConfig ?? mongoose.model("AppConfig", appConfigSchema);
