import { env } from "../env.js";
import { getConfig } from "./config.js";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_CONTEXT_LENGTH = 128_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface OpenRouterModel {
  id?: string;
  context_length?: number;
}

let cache: { expiresAt: number; lengths: Map<string, number> } | null = null;

async function loadContextLengths(): Promise<Map<string, number>> {
  if (cache && cache.expiresAt > Date.now()) return cache.lengths;
  const res = await fetch(MODELS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter models request failed: ${res.status}`);
  }
  const body = (await res.json()) as { data?: OpenRouterModel[] };
  const lengths = new Map<string, number>();
  for (const model of body.data ?? []) {
    if (model.id && typeof model.context_length === "number") {
      lengths.set(model.id, model.context_length);
    }
  }
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, lengths };
  return lengths;
}

/** Context length for a model id, falling back to a sane default. */
export async function getContextLength(modelId: string): Promise<number> {
  try {
    const lengths = await loadContextLengths();
    return lengths.get(modelId) ?? DEFAULT_CONTEXT_LENGTH;
  } catch (err) {
    console.error("Failed to fetch model context lengths:", err);
    return DEFAULT_CONTEXT_LENGTH;
  }
}

/** The configured OpenRouter model, preferring the DB value over env. */
export async function resolveModel(): Promise<string> {
  try {
    return await getConfig("OPENROUTER_MODEL");
  } catch {
    return env.OPENROUTER_MODEL;
  }
}

export async function getCurrentModelInfo(): Promise<{
  model: string;
  contextLength: number;
}> {
  const model = await resolveModel();
  const contextLength = await getContextLength(model);
  return { model, contextLength };
}
