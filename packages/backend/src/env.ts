import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.string().optional().default("development"),
  FRONTEND_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemini-2.5-flash"),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
