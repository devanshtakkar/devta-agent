import {
  CalendarCheckIcon,
  CalendarClockIcon,
  HeartIcon,
  MessageCircleIcon,
  PhoneIcon,
  SparklesIcon,
  StickyNoteIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";
import type { ConnectionEvent, ConnectionEventType } from "@/lib/api";
import { EVENT_LABELS } from "@/lib/connection-meta";
import { formatDateTime } from "@/lib/time";

const ICONS: Record<ConnectionEventType, typeof SparklesIcon> = {
  approach: SparklesIcon,
  reply: MessageCircleIcon,
  number: PhoneIcon,
  date_planned: CalendarClockIcon,
  date_done: CalendarCheckIcon,
  intimate: HeartIcon,
  stage_change: TrendingUpIcon,
  failure: XCircleIcon,
  note: StickyNoteIcon,
};

export function ConnectionTimeline({ events }: { events: ConnectionEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Nothing logged yet — tell the wingman what happened, or log it manually.
      </p>
    );
  }

  const ordered = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <ol className="flex flex-col gap-1">
      {ordered.map((event) => {
        const Icon = ICONS[event.type] ?? StickyNoteIcon;
        return (
          <li key={event.id} className="flex gap-3 py-2">
            <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {event.title || EVENT_LABELS[event.type] || event.type}
                </p>
                <time className="text-muted-foreground shrink-0 text-xs">
                  {formatDateTime(event.occurredAt)}
                </time>
              </div>
              {event.details && (
                <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                  {event.details}
                </p>
              )}
              {event.location && (
                <p className="text-muted-foreground mt-0.5 text-xs">{event.location}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
