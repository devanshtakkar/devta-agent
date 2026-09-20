import {
  CONNECTION_STAGES,
  EVENT_TYPES,
  type ConnectionEventType,
  type ConnectionStage,
} from "../models/Connection.js";

export interface Milestone {
  key: string;
  label: string;
}

export interface StagePlaybook {
  stage: ConnectionStage;
  label: string;
  order: number;
  /** What this stage is for. */
  intent: string;
  /** The default next move that advances the connection out of this stage. */
  nextMove: string;
  milestones: Milestone[];
  /** Failure modes to avoid at this stage. */
  traps: string[];
}

/**
 * The stage ladder the agent coaches against. Keeping it in one place means
 * the system prompt and the in-app playbook never drift apart.
 */
export const STAGE_PLAYBOOK: StagePlaybook[] = [
  {
    stage: "approached",
    label: "Approached",
    order: 0,
    intent:
      "You opened the conversation politely. Read whether she is open to talking and give her an easy way to continue or bow out.",
    nextMove:
      "Escalate gently: react to something real she said, share a quick bit about you, and look for a hook worth continuing.",
    milestones: [
      { key: "opener_delivered", label: "Opener delivered" },
      { key: "positive_signal", label: "She gave a positive signal" },
      { key: "two_way", label: "Became a two-way exchange" },
    ],
    traps: ["Talking at her instead of with her", "Ignoring a polite no"],
  },
  {
    stage: "talking",
    label: "Talking",
    order: 1,
    intent:
      "Build rapport, humour and genuine attraction — she should feel interesting and interested, not interviewed.",
    nextMove:
      "Create playful tension and find a reason to continue the conversation somewhere less public or at a set time.",
    milestones: [
      { key: "rapport", label: "Rapport and banter flowing" },
      { key: "common_ground", label: "Found common ground" },
      { key: "attraction_spark", label: "Attraction spark felt" },
    ],
    traps: [
      "Interview mode (question after question)",
      "Seeking approval or over-complimenting",
      "Being the 'nice guy' who never shows intent",
    ],
  },
  {
    stage: "contact",
    label: "Contact",
    order: 2,
    intent:
      "Move the connection onto a private channel and agree on a concrete plan.",
    nextMove:
      "Lock a specific time and place for a date, then confirm it warmly.",
    milestones: [
      { key: "number_exchanged", label: "Number / socials exchanged" },
      { key: "first_text", label: "First message sent" },
      { key: "date_set", label: "Specific date set (time + place)" },
    ],
    traps: ["Endless texting with no plan", "Vague 'we should hang out'"],
  },
  {
    stage: "dating",
    label: "Dating",
    order: 3,
    intent:
      "Spend real time together, lead the date, build emotional connection and escalate physically with consent.",
    nextMove:
      "Plan the next date, calibrate touch gradually, and make your romantic intent clear without pressure.",
    milestones: [
      { key: "first_date", label: "First date happened" },
      { key: "second_date", label: "Second date happened" },
      { key: "physical_escalation", label: "Consensual physical escalation" },
      { key: "emotional_connection", label: "Emotional connection deepened" },
    ],
    traps: [
      "Becoming a friend / free therapist",
      "Never making a move",
      "Moving faster than she is comfortable with",
    ],
  },
  {
    stage: "intimate",
    label: "Intimate",
    order: 4,
    intent:
      "Consensual intimacy has happened. Deepen trust and connection rather than treating it as a finish line.",
    nextMove:
      "Stay consistent, keep emotional connection strong, and talk about what you both want next.",
    milestones: [
      { key: "intimacy", label: "Consensual intimacy" },
      { key: "aftercare", label: "Warmth and aftercare" },
      { key: "bond_deepened", label: "Bond deepened" },
    ],
    traps: ["Disappearing the next day", "Letting momentum stall"],
  },
  {
    stage: "relationship",
    label: "Relationship",
    order: 5,
    intent:
      "She is your partner. Sustain effort, exclusivity and shared direction.",
    nextMove:
      "Define the relationship explicitly and keep showing up consistently.",
    milestones: [
      { key: "exclusivity_talk", label: "Exclusivity discussed" },
      { key: "consistency", label: "Consistent effort maintained" },
      { key: "integrated", label: "Integrated into each other's lives" },
    ],
    traps: ["Taking her for granted", "Coasting on early chemistry"],
  },
  {
    stage: "engaged",
    label: "Engaged",
    order: 6,
    intent: "Committed and planning a life together.",
    nextMove: "Plan the next milestone together and keep the connection a priority.",
    milestones: [
      { key: "proposal", label: "Proposal made and accepted" },
      { key: "planning", label: "Planning the future together" },
    ],
    traps: ["Letting planning replace connection"],
  },
  {
    stage: "married",
    label: "Married",
    order: 7,
    intent: "Long-term partnership.",
    nextMove: "Keep investing in the relationship deliberately.",
    milestones: [
      { key: "married", label: "Married" },
    ],
    traps: ["Complacency"],
  },
];

export const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  STAGE_PLAYBOOK.map((s) => [s.stage, s.order]),
);

export function stageLabel(stage: string): string {
  if (stage === "failed") return "Failed";
  if (stage === "ghosted") return "Ghosted";
  return STAGE_PLAYBOOK.find((s) => s.stage === stage)?.label ?? stage;
}

export interface EventTypeMeta {
  type: ConnectionEventType;
  label: string;
  /** Whether this event normally advances the stage to the given value. */
  advancesTo?: ConnectionStage;
}

export const EVENT_TYPE_META: Record<ConnectionEventType, EventTypeMeta> = {
  approach: { type: "approach", label: "Approach" },
  reply: { type: "reply", label: "Reply" },
  number: { type: "number", label: "Number / socials", advancesTo: "contact" },
  date_planned: { type: "date_planned", label: "Date planned" },
  date_done: { type: "date_done", label: "Date happened", advancesTo: "dating" },
  intimate: { type: "intimate", label: "Intimacy", advancesTo: "intimate" },
  stage_change: { type: "stage_change", label: "Stage change" },
  failure: { type: "failure", label: "Failed / rejected" },
  note: { type: "note", label: "Note" },
};

/** Always-active principles the agent must apply at every stage. */
export const GLOBAL_PRINCIPLES = [
  "Consent-first: read interest and back off gracefully the moment it is not there.",
  "Always give the user a graceful exit.",
  "Never suggest manipulation, pressure, deception or persistence after disinterest.",
  "Avoid the friendzone and the 'nice guy' trap by showing clear, respectful romantic intent.",
  "Lead with confidence, playful tension, emotional connection and calibrated physical escalation.",
  "Keep every reply short and actionable: the exact thing to say or do, then a one-line why.",
];

export { CONNECTION_STAGES, EVENT_TYPES };
export type { ConnectionEventType, ConnectionStage };
