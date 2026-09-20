import {
  CONNECTION_STAGES,
  CONNECTION_TERMINAL,
  type ConnectionEventType,
  type ConnectionStage,
  type ConnectionStatus,
  type ConnectionTerminal,
} from "@/lib/api";

/**
 * UI labels/order for tracker stages. The canonical coaching copy lives in the
 * backend playbook (`/api/connections/playbook`); this is only for compact
 * display.
 */
export const STAGE_LABELS: Record<ConnectionStatus, string> = {
  approached: "Approached",
  talking: "Talking",
  contact: "Contact",
  dating: "Dating",
  intimate: "Intimate",
  relationship: "Relationship",
  engaged: "Engaged",
  married: "Married",
  failed: "Failed",
  ghosted: "Ghosted",
};

export const STAGE_ORDER: Record<ConnectionStage, number> = Object.fromEntries(
  CONNECTION_STAGES.map((stage, i) => [stage, i]),
) as Record<ConnectionStage, number>;

export const EVENT_LABELS: Record<ConnectionEventType, string> = {
  approach: "Approach",
  reply: "Reply",
  number: "Number / socials",
  date_planned: "Date planned",
  date_done: "Date happened",
  intimate: "Intimacy",
  stage_change: "Stage change",
  failure: "Failed / rejected",
  note: "Note",
};

export const STAGE_ACCENT: Record<ConnectionStatus, string> = {
  approached: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  talking: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  contact: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  dating: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  intimate: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  relationship: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  engaged: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  married: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
  ghosted: "bg-muted text-muted-foreground",
};

export function isTerminalStage(
  stage: ConnectionStatus,
): stage is ConnectionTerminal {
  return (CONNECTION_TERMINAL as readonly string[]).includes(stage);
}

export function isActiveStage(stage: ConnectionStatus): stage is ConnectionStage {
  return (CONNECTION_STAGES as readonly string[]).includes(stage);
}

export function stageLabel(stage: ConnectionStatus): string {
  return STAGE_LABELS[stage] ?? stage;
}
