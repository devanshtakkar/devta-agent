import { useSyncExternalStore } from "react";
import type { Starter } from "@/lib/api";

/**
 * An approach option the user bookmarked for later. Kept entirely on-device
 * (localStorage) so it survives offline and needs no account or network.
 */
export interface SavedApproach {
  id: string;
  starter: Starter;
  /** Scenario the user filed it under, e.g. "Gym", "Cafe". */
  scenario: string;
  /** The agent's read of the situation this option came from, if any. */
  overview?: string;
  /** The chat it was saved from, so we can offer a jump back. */
  sessionId?: string;
  savedAt: string;
}

export interface SaveApproachContext {
  scenario: string;
  overview?: string;
  sessionId?: string;
}

/** Fallback group for entries saved before scenarios existed. */
export const DEFAULT_SCENARIO = "Unsorted";

/** Common scenarios offered before the user has saved anything. */
export const SCENARIO_PRESETS = [
  "Gym",
  "Cafe",
  "Restaurant",
  "Bar",
  "Street",
  "Party",
  "Campus",
  "Library",
  "Work",
] as const;

const STORAGE_KEY = "devta-saved-approaches";

let cache: SavedApproach[] | null = null;
const listeners = new Set<() => void>();

/**
 * Coerce a stored starter into a complete `Starter`. Tool output from older
 * chats may be missing fields (`gracefulExit`, `risk`, …), so we fill defaults
 * instead of discarding the saved option.
 */
function normalizeStarter(value: unknown): Starter | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<Starter>;
  const openerLine = typeof s.openerLine === "string" ? s.openerLine.trim() : "";
  const title = typeof s.title === "string" ? s.title.trim() : "";
  if (!openerLine && !title) return null;
  return {
    id:
      typeof s.id === "string" && s.id
        ? s.id
        : `starter-${Math.random().toString(36).slice(2)}`,
    title: title || openerLine.slice(0, 60),
    openerLine: openerLine || title,
    why: typeof s.why === "string" ? s.why : "",
    risk: s.risk === "medium" || s.risk === "high" ? s.risk : "low",
    nextMove: typeof s.nextMove === "string" ? s.nextMove : "",
    gracefulExit: typeof s.gracefulExit === "string" ? s.gracefulExit : "",
  };
}

/** Accepts legacy entries without a scenario and files them under the default. */
function normalizeEntry(value: unknown): SavedApproach | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SavedApproach>;
  const starter = normalizeStarter(v.starter);
  if (!starter || typeof v.id !== "string" || typeof v.savedAt !== "string") {
    return null;
  }
  const scenario =
    typeof v.scenario === "string" && v.scenario.trim()
      ? v.scenario.trim()
      : DEFAULT_SCENARIO;
  return {
    id: v.id,
    starter,
    scenario,
    overview: typeof v.overview === "string" ? v.overview : undefined,
    sessionId: typeof v.sessionId === "string" ? v.sessionId : undefined,
    savedAt: v.savedAt,
  };
}

function readStorage(): SavedApproach[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is SavedApproach => entry !== null);
  } catch {
    // Corrupt or unavailable storage — start empty rather than crash.
    return [];
  }
}

/** Snapshot reader. Stable identity between writes keeps React happy. */
function getSnapshot(): SavedApproach[] {
  if (cache === null) cache = readStorage();
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function persist(next: SavedApproach[]) {
  cache = next;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota/privacy errors shouldn't take the UI down.
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") {
  // Keep multiple tabs in sync; the in-tab `emit` covers same-tab writes.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = readStorage();
    emit();
  });
  // A page restored from the back-forward cache keeps stale module state.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    cache = readStorage();
    emit();
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function listSavedApproaches(): SavedApproach[] {
  return getSnapshot();
}

/** Match by opener line so re-saving the same option never duplicates it. */
export function findSavedApproach(starter: Starter): SavedApproach | undefined {
  return getSnapshot().find((s) => s.starter.openerLine === starter.openerLine);
}

export function isApproachSaved(starter: Starter): boolean {
  return findSavedApproach(starter) !== undefined;
}

/** Existing scenario labels, most recently used first. */
export function listScenarios(): string[] {
  const seen = new Set<string>();
  const scenarios: string[] = [];
  for (const item of getSnapshot()) {
    if (seen.has(item.scenario)) continue;
    seen.add(item.scenario);
    scenarios.push(item.scenario);
  }
  return scenarios;
}

/**
 * Save the starter under a scenario. If the same opener was already saved,
 * move it into the new scenario instead of duplicating it.
 */
export function saveApproach(
  starter: Starter,
  context: SaveApproachContext,
): SavedApproach {
  const scenario = context.scenario.trim() || DEFAULT_SCENARIO;
  const existing = findSavedApproach(starter);
  const entry: SavedApproach = {
    id: existing?.id ?? newId(),
    starter: normalizeStarter(starter) ?? starter,
    scenario,
    overview: context.overview,
    sessionId: context.sessionId,
    savedAt: new Date().toISOString(),
  };
  persist([entry, ...getSnapshot().filter((s) => s.id !== entry.id)]);
  return entry;
}

export function removeSavedApproach(id: string) {
  persist(getSnapshot().filter((s) => s.id !== id));
}

export interface ScenarioGroup {
  scenario: string;
  items: SavedApproach[];
}

/** Group saved options by scenario; groups ordered by most recent save. */
export function groupSavedApproaches(items: SavedApproach[]): ScenarioGroup[] {
  const groups = new Map<string, SavedApproach[]>();
  for (const item of items) {
    const group = groups.get(item.scenario);
    if (group) group.push(item);
    else groups.set(item.scenario, [item]);
  }
  // `items` is newest-first, so group insertion order is already by recency.
  return [...groups.entries()].map(([scenario, groupItems]) => ({
    scenario,
    items: groupItems,
  }));
}

/** Reactive list; re-renders the caller whenever saved options change. */
export function useSavedApproaches(): SavedApproach[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
