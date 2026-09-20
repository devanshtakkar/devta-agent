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
  connectionId?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export const sessionsKeys = {
  all: ["sessions"] as const,
  list: ["sessions", "list"] as const,
  detail: (uuid: string) => ["sessions", "detail", uuid] as const,
};

/* -------------------------------------------------------------------------- */
/*                             Connections tracker                            */
/* -------------------------------------------------------------------------- */

export const CONNECTION_STAGES = [
  "approached",
  "talking",
  "contact",
  "dating",
  "intimate",
  "relationship",
  "engaged",
  "married",
] as const;

export const CONNECTION_TERMINAL = ["failed", "ghosted"] as const;

export type ConnectionStage = (typeof CONNECTION_STAGES)[number];
export type ConnectionTerminal = (typeof CONNECTION_TERMINAL)[number];
export type ConnectionStatus = ConnectionStage | ConnectionTerminal;

export const EVENT_TYPES = [
  "approach",
  "reply",
  "number",
  "date_planned",
  "date_done",
  "intimate",
  "stage_change",
  "failure",
  "note",
] as const;

export type ConnectionEventType = (typeof EVENT_TYPES)[number];

export interface ConnectionEvent {
  id: string;
  type: ConnectionEventType;
  title: string;
  details: string;
  occurredAt: string;
  location?: string;
  stage?: ConnectionStatus;
  sessionId?: string;
}

export interface Connection {
  uuid: string;
  name: string;
  metLocation: string;
  metAt?: string;
  metContext: string;
  approachOpener: string;
  approachRisk?: "low" | "medium" | "high";
  stage: ConnectionStatus;
  milestones: string[];
  nextMove: string;
  closedReason: string;
  notes: string;
  rating?: number;
  lastContactAt?: string;
  events: ConnectionEvent[];
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionInput {
  name: string;
  metLocation?: string;
  metAt?: string;
  metContext?: string;
  approachOpener?: string;
  approachRisk?: "low" | "medium" | "high";
  stage?: ConnectionStatus;
  milestones?: string[];
  nextMove?: string;
  notes?: string;
  rating?: number;
  closedReason?: string;
  sessionId?: string;
}

export interface ConnectionEventInput {
  type: ConnectionEventType;
  title?: string;
  details?: string;
  occurredAt?: string;
  location?: string;
  stage?: ConnectionStatus;
  sessionId?: string;
}

export interface ConnectionsOverview {
  total: number;
  active: number;
  closed: number;
  byStage: Record<string, number>;
  funnel: { stage: string; label: string; reached: number }[];
}

export interface PlaybookStage {
  stage: ConnectionStage;
  label: string;
  order: number;
  intent: string;
  nextMove: string;
  milestones: { key: string; label: string }[];
  traps: string[];
}

export interface Playbook {
  stages: PlaybookStage[];
  eventTypes: { type: ConnectionEventType; label: string; advancesTo?: ConnectionStage }[];
  principles: string[];
}

/** Shape of the `tool-proposeConnectionUpdate` UI part while streaming/done. */
export interface ConnectionUpdateToolPart {
  type: "tool-proposeConnectionUpdate";
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

export const connectionsKeys = {
  all: ["connections"] as const,
  list: (stage?: string) => ["connections", "list", stage ?? "all"] as const,
  detail: (uuid: string) => ["connections", "detail", uuid] as const,
  overview: ["connections", "overview"] as const,
  playbook: ["connections", "playbook"] as const,
};

export function listConnections(stage?: string) {
  const qs = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  return apiFetch<{ connections: Connection[] }>(`/api/connections${qs}`).then(
    (d) => d.connections,
  );
}

export function getConnection(uuid: string) {
  return apiFetch<Connection>(`/api/connections/${uuid}`);
}

export function createConnection(input: ConnectionInput) {
  return apiFetch<Connection>("/api/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateConnection(uuid: string, input: Partial<ConnectionInput>) {
  return apiFetch<Connection>(`/api/connections/${uuid}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteConnection(uuid: string) {
  return apiFetch<void>(`/api/connections/${uuid}`, { method: "DELETE" });
}

export function addConnectionEvent(uuid: string, input: ConnectionEventInput) {
  return apiFetch<Connection>(`/api/connections/${uuid}/events`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getConnectionsOverview() {
  return apiFetch<ConnectionsOverview>("/api/connections/overview");
}

export function getPlaybook() {
  return apiFetch<Playbook>("/api/connections/playbook");
}

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

export function createSession(connectionId?: string) {
  return apiFetch<SessionListItem>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(connectionId ? { connectionId } : {}),
  });
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
