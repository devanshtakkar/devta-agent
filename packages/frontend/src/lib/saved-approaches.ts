import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listSavedApproaches as fetchSavedApproaches,
  savedApproachesKeys,
  type SavedApproach,
  type Starter,
} from "@/lib/api";

/**
 * Saved approaches are server-authoritative. The last synced list is cached in
 * localStorage so `/saved` still renders when the device is offline; writes
 * require a connection.
 */

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

/** Last synced list + when it was fetched. */
const CACHE_KEY = "devta-saved-approaches-cache";

/**
 * Coerce a stored starter into a complete `Starter`. Older records may be
 * missing fields (`gracefulExit`, `risk`, …), so we fill defaults.
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

function normalizeCached(value: unknown): SavedApproach | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SavedApproach>;
  const starter = normalizeStarter(v.starter);
  if (!starter || typeof v.uuid !== "string" || typeof v.savedAt !== "string") {
    return null;
  }
  const scenario =
    typeof v.scenario === "string" && v.scenario.trim()
      ? v.scenario.trim()
      : DEFAULT_SCENARIO;
  return {
    uuid: v.uuid,
    starter,
    scenario,
    overview: typeof v.overview === "string" ? v.overview : undefined,
    sessionId: typeof v.sessionId === "string" ? v.sessionId : undefined,
    savedAt: v.savedAt,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : v.savedAt,
  };
}

/** The cached list plus the time it was fetched (for staleness). */
export function readSavedApproachCache(): {
  list: SavedApproach[];
  at: number;
} {
  if (typeof localStorage === "undefined") return { list: [], at: 0 };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { list: [], at: 0 };
    const parsed = JSON.parse(raw) as { list?: unknown; at?: unknown };
    const list = Array.isArray(parsed.list)
      ? parsed.list
          .map(normalizeCached)
          .filter((entry): entry is SavedApproach => entry !== null)
      : [];
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    return { list, at };
  } catch {
    return { list: [], at: 0 };
  }
}

function writeSavedApproachCache(list: SavedApproach[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ list, at: Date.now() }));
  } catch {
    // Quota/privacy errors shouldn't take the UI down.
  }
}

/** Drop the cached list, e.g. on sign out so another user can't see it. */
export function clearSavedApproachCache() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
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

/**
 * The signed-in user's saved approaches. Served from the offline cache while
 * the network is unavailable, refreshed from the server otherwise.
 */
export function useSavedApproaches(): SavedApproach[] {
  const initial = useMemo(() => readSavedApproachCache(), []);
  const { data } = useQuery({
    queryKey: savedApproachesKeys.list,
    queryFn: fetchSavedApproaches,
    // Only seed from cache when it has content, so a cold start still fetches.
    initialData: initial.list.length > 0 ? initial.list : undefined,
    initialDataUpdatedAt: initial.at || undefined,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) writeSavedApproachCache(data);
  }, [data]);

  return data ?? [];
}
