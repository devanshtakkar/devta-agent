import { env } from "../env.js";
import { getConfig, setConfig } from "./config.js";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_CONTEXT_LENGTH = 128_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Most models a user can keep in the picker. */
export const MAX_AVAILABLE_MODELS = 50;
const MAX_MODEL_ID_LENGTH = 160;

/**
 * OpenRouter model ids look like `vendor/model` and may carry a `~` prefix or
 * routing suffixes (`:free`, `:nitro`, ...). Keep the check loose: no
 * whitespace, a vendor segment, and a sane length.
 */
export function isValidModelId(value: string): boolean {
  const id = value.trim();
  return (
    id.length > 0 &&
    id.length <= MAX_MODEL_ID_LENGTH &&
    !/\s/.test(id) &&
    /^~?[^\s/]+\/[^\s]+$/.test(id)
  );
}

/** Trim, drop invalid ids and remove duplicates while keeping order. */
export function normalizeModelIds(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const id = raw.trim();
    if (!isValidModelId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

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

/**
 * OpenRouter model ids may carry routing/feature suffixes (`:nitro`, `:floor`,
 * `:free`, `:batch`, ...) and a `~` prefix, which are not part of the base
 * model id listed in the models endpoint. Strip them for lookup.
 */
function baseModelId(modelId: string): string {
  return modelId.replace(/^~/, "").split(":")[0];
}

/** Context length for a model id, falling back to a sane default. */
export async function getContextLength(modelId: string): Promise<number> {
  try {
    const lengths = await loadContextLengths();
    return (
      lengths.get(modelId) ??
      lengths.get(baseModelId(modelId)) ??
      DEFAULT_CONTEXT_LENGTH
    );
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

/** The model ids offered in the in-chat picker. */
export async function getAvailableModels(): Promise<string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await getConfig("OPENROUTER_MODELS"));
  } catch {
    parsed = undefined;
  }
  const models = normalizeModelIds(
    Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
  );
  return models.length > 0 ? models : [env.OPENROUTER_MODEL];
}

export async function setAvailableModels(models: string[]): Promise<string[]> {
  const normalized = normalizeModelIds(models);
  if (normalized.length === 0) {
    throw new Error("At least one valid model id is required");
  }
  await setConfig("OPENROUTER_MODELS", JSON.stringify(normalized));
  return normalized;
}

/** Available models plus the default used for new chats. */
export async function getModelSettings(): Promise<{
  models: string[];
  defaultModel: string;
}> {
  const [models, defaultModel] = await Promise.all([
    getAvailableModels(),
    resolveModel(),
  ]);
  return {
    models: models.includes(defaultModel) ? models : [defaultModel, ...models],
    defaultModel,
  };
}
