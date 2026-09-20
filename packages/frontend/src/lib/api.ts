const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export interface Starter {
  id: string;
  title: string;
  openerLine: string;
  why: string;
  risk: "low" | "medium" | "high";
  nextMove: string;
}

export interface IdeasResponse {
  overview: string;
  starters: Starter[];
}

export interface BranchScenario {
  herResponse: string;
  yourReply: string;
  tip: string;
}

export interface BranchResponse {
  scenarios: BranchScenario[];
  exitLine: string;
}

export interface PersistedBranch extends BranchResponse {
  starterId?: string;
  createdAt: string;
}

export interface PersistedTurn {
  situation: string;
  overview: string;
  starters: Starter[];
  branches: PersistedBranch[];
  error?: string;
  createdAt: string;
}

export interface SessionListItem {
  uuid: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  turnCount: number;
  preview: string;
}

export interface ChatSessionDetail {
  uuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: PersistedTurn[];
}

export const sessionsKeys = {
  all: ["sessions"] as const,
  list: ["sessions", "list"] as const,
  detail: (uuid: string) => ["sessions", "detail", uuid] as const,
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listSessions() {
  return apiFetch<{ sessions: SessionListItem[] }>("/api/sessions").then((d) => d.sessions);
}

export function getSession(uuid: string) {
  return apiFetch<ChatSessionDetail>(`/api/sessions/${uuid}`);
}

export function createSession() {
  return apiFetch<SessionListItem>("/api/sessions", { method: "POST" });
}

export function renameSession(uuid: string, title: string) {
  return apiFetch<{ uuid: string; title: string }>(`/api/sessions/${uuid}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteSession(uuid: string) {
  return apiFetch<void>(`/api/sessions/${uuid}`, { method: "DELETE" });
}

export function postTurn(uuid: string, situation: string, imageDataUrl?: string) {
  return apiFetch<{ turnIndex: number; turn: PersistedTurn }>(`/api/sessions/${uuid}/turns`, {
    method: "POST",
    body: JSON.stringify({ situation, imageDataUrl }),
  });
}

export function postBranch(
  uuid: string,
  turnIndex: number,
  starter: Starter | string,
  herResponse?: string,
) {
  return apiFetch<BranchResponse>(`/api/sessions/${uuid}/branches`, {
    method: "POST",
    body: JSON.stringify({ turnIndex, starter, herResponse }),
  });
}

/** Downscale an image file to a compact JPEG data URL for AI context. */
export function fileToDataUrl(file: File, maxDim = 1024, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
