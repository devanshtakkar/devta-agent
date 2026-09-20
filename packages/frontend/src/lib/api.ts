import { DefaultChatTransport, type UIMessage } from "ai";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export type ChatMessage = UIMessage;

export interface Starter {
  id: string;
  title: string;
  openerLine: string;
  why: string;
  risk: "low" | "medium" | "high";
  nextMove: string;
  gracefulExit: string;
}

export interface ApproachInput {
  overview: string;
  starters: Starter[];
}

/** Shape of the `tool-proposeApproaches` UI part while streaming/completed. */
export interface ApproachToolPart {
  type: "tool-proposeApproaches";
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Partial<ApproachInput>;
  output?: unknown;
  errorText?: string;
}

export interface BranchScenario {
  id: string;
  reaction: string;
  read: string;
  move: string;
  outcome: string;
}

export interface BranchesInput {
  opener: string;
  branches: BranchScenario[];
}

/** Shape of the `tool-proposeBranches` UI part while streaming/completed. */
export interface BranchToolPart {
  type: "tool-proposeBranches";
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Partial<BranchesInput>;
  output?: unknown;
  errorText?: string;
}

export interface SessionListItem {
  uuid: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  preview: string;
}

export interface ChatSessionDetail {
  uuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
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

/** Chat transport backed by the streaming `/api/sessions/:uuid/chat` endpoint. */
export function chatTransport(uuid: string) {
  return new DefaultChatTransport({
    api: `${API_URL}/api/sessions/${uuid}/chat`,
    credentials: "include",
  });
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
