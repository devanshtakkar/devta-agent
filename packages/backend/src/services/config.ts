import { z } from "zod";
import { env } from "../env.js";
import { AppConfig, CONFIG_KEYS, type ConfigKey } from "../models/AppConfig.js";

const CACHE_TTL_MS = 60_000;

const cache = new Map<ConfigKey, { value: string; expiresAt: number }>();

const valueSchema = z.string().min(1, "value must be a non-empty string");

function envFallback(key: ConfigKey): string | undefined {
  if (key === "OPENROUTER_MODEL") return env.OPENROUTER_MODEL;
  if (key === "OPENROUTER_MODELS") return JSON.stringify([env.OPENROUTER_MODEL]);
  return undefined;
}

export function isConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key);
}

export async function getConfig(key: ConfigKey): Promise<string> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const doc = await AppConfig.findOne({ key }).lean<{ value: string } | null>();
  const value = doc?.value ?? envFallback(key);
  if (value === undefined) {
    throw new Error(`Missing config for key: ${key}`);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function setConfig(key: ConfigKey, rawValue: unknown) {
  const value = valueSchema.parse(rawValue);
  await AppConfig.findOneAndUpdate(
    { key },
    { $set: { key, value } },
    { upsert: true, new: true },
  );
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function seedDefaults(): Promise<void> {
  const defaults: Record<ConfigKey, string> = {
    OPENROUTER_MODEL: env.OPENROUTER_MODEL,
    OPENROUTER_MODELS: JSON.stringify([env.OPENROUTER_MODEL]),
  };
  for (const key of CONFIG_KEYS) {
    await AppConfig.updateOne(
      { key },
      { $setOnInsert: { key, value: defaults[key] } },
      { upsert: true },
    );
  }
}
