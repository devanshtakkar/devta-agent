export interface PendingDraft {
  text: string;
  imageDataUrl?: string;
  intent?: "approaches" | "capture";
  /** Model picked for the first message of the new chat. */
  model?: string;
}

/**
 * A brand-new chat is created and routed to as soon as the user sends the
 * first message. This transient holder bridges that message across the route
 * change so the session view can fire it into `useChat` on mount.
 */
let pending: PendingDraft | null = null;

export function setPendingDraft(draft: PendingDraft) {
  pending = draft;
}

export function takePendingDraft(): PendingDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
