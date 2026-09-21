import { useSyncExternalStore } from "react";
import type { Starter } from "@/lib/api";

/**
 * An approach option the user bookmarked for later. Kept entirely on-device
 * (localStorage) so it survives offline and needs no account or network.
 */
export interface SavedApproach {
  id: string;
  starter: Starter;
  /** The agent's read of the situation this option came from, if any. */
  overview?: string;
  /** The chat it was saved from, so we can offer a jump back. */
  sessionId?: string;
  savedAt: string;
}

const STORAGE_KEY = "devta-saved-approaches";

export interface SaveApproachContext {
  overview?: string;
  sessionId?: string;
}

let cache: SavedApproach[] | null = null;
const listeners = new Set<() => void>();

function isStarter(value: unknown): value is Starter {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Starter>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.openerLine === "string" &&
    typeof s.why === "string" &&
    typeof s.nextMove === "string" &&
    typeof s.gracefulExit === "string"
  );
}

function isSavedApproach(value: unknown): value is SavedApproach {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SavedApproach>;
  return (
    typeof v.id === "string" &&
    typeof v.savedAt === "string" &&
    isStarter(v.starter)
  );
}

function readStorage(): SavedApproach[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedApproach);
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

export function saveApproach(
  starter: Starter,
  context: SaveApproachContext = {},
): SavedApproach {
  const existing = findSavedApproach(starter);
  if (existing) return existing;
  const entry: SavedApproach = {
    id: newId(),
    starter,
    overview: context.overview,
    sessionId: context.sessionId,
    savedAt: new Date().toISOString(),
  };
  persist([entry, ...getSnapshot()]);
  return entry;
}

export function removeSavedApproach(id: string) {
  persist(getSnapshot().filter((s) => s.id !== id));
}

/** Reactive list; re-renders the caller whenever saved options change. */
export function useSavedApproaches(): SavedApproach[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
