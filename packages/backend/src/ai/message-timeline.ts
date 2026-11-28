import type { UIMessage } from "ai";
import { z } from "zod";

const timeZoneSchema = z.string().max(100).refine((timeZone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
});

export const messageTimeSchema = z.object({
  sentAt: z.string().datetime().optional().catch(undefined),
  timeZone: timeZoneSchema.optional().catch(undefined),
});

type MessageTime = z.infer<typeof messageTimeSchema>;
type TimelineMessage = {
  id?: string;
  role: UIMessage["role"];
  metadata?: unknown;
};

function messageMetadata(message: TimelineMessage): Record<string, unknown> {
  return typeof message.metadata === "object" && message.metadata !== null
    ? { ...message.metadata }
    : {};
}

/** Keep the first recorded send time and time zone across retries and reloads. */
export function timestampUserMessages<T extends TimelineMessage>(
  incoming: T[],
  persisted: TimelineMessage[],
  receivedAt: Date,
): T[] {
  const previous = new Map(
    persisted
      .filter((message) => message.role === "user")
      .map((message) => [message.id, message]),
  );

  return incoming.map((message) => {
    if (message.role !== "user") return message;
    const existing = previous.get(message.id);
    const metadata = messageMetadata(message);
    const time = messageTimeSchema.parse(existing ? messageMetadata(existing) : metadata);
    return {
      ...message,
      metadata: {
        ...metadata,
        sentAt: time.sentAt ?? (existing ? undefined : receivedAt.toISOString()),
        timeZone: time.timeZone,
      },
    };
  });
}

/** Human-readable elapsed time between updates, without rounding away long gaps. */
function elapsedSince(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remaining = minutes % 60;
    return `${hours} hour${hours === 1 ? "" : "s"}${remaining ? ` ${remaining} minute${remaining === 1 ? "" : "s"}` : ""}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    const remainingHours = hours % 24;
    return `${days} day${days === 1 ? "" : "s"}${remainingHours ? ` ${remainingHours} hour${remainingHours === 1 ? "" : "s"}` : ""}`;
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return `${weeks} week${weeks === 1 ? "" : "s"}${remainingDays ? ` ${remainingDays} day${remainingDays === 1 ? "" : "s"}` : ""}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return `${months} month${months === 1 ? "" : "s"}${remainingDays ? ` ${remainingDays} day${remainingDays === 1 ? "" : "s"}` : ""}`;
  }
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  return `${years} year${years === 1 ? "" : "s"}${remainingDays ? ` ${remainingDays} day${remainingDays === 1 ? "" : "s"}` : ""}`;
}

function formatTime(time: number, timeZone?: string): string {
  if (!timeZone) return new Date(time).toISOString();
  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "longOffset",
  }).format(time);
  return `${localTime} (${timeZone})`;
}

export function messageTimeline(
  messages: TimelineMessage[],
  receivedAt: Date,
  clientTime?: MessageTime,
): string {
  const currentTime = clientTime?.sentAt ? Date.parse(clientTime.sentAt) : receivedAt.getTime();
  const timeZone = clientTime?.timeZone;
  const current = timeZone
    ? `User's local time at this request: ${formatTime(currentTime, timeZone)}.`
    : `Current time in UTC (user's local time zone unavailable): ${formatTime(currentTime)}.`;

  const userMessages = messages.filter((message) => message.role === "user").slice(-20);
  let previousTime: number | undefined;
  const timeline = userMessages.map((message, index) => {
    const { sentAt, timeZone } = messageTimeSchema.parse(messageMetadata(message));
    if (!sentAt) {
      return `- User update ${index + 1}: timestamp unavailable (legacy message).`;
    }
    const time = Date.parse(sentAt);
    const gap =
      previousTime === undefined
        ? "first timestamped update"
        : `${elapsedSince(time - previousTime)} since the previous timestamped update`;
    previousTime = time;
    return `- User update ${index + 1}: ${formatTime(time, timeZone)} (${gap}).`;
  });
  return [
    current,
    "These timestamps show when the user sent updates. Entries without a recorded local time zone are shown in UTC.",
    ...timeline,
  ].join("\n");
}
