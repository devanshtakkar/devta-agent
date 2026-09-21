import { useSyncExternalStore } from "react";

/**
 * Remembers on-device that this device has signed in before, so the app shell
 * (and the locally saved approaches) stays reachable when the network is gone.
 * It never grants API access: the server still authenticates every request.
 */
const STORAGE_KEY = "devta-auth";

let cache: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (cache === null) cache = read();
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
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
    cache = read();
    emit();
  });
}

export function setCachedAuth(value: boolean) {
  cache = value;
  if (typeof localStorage !== "undefined") {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Quota/privacy errors shouldn't take the UI down.
    }
  }
  emit();
}

export function clearCachedAuth() {
  setCachedAuth(false);
}

/** True when this device has signed in before. */
export function useCachedAuth(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
