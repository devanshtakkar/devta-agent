import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, MapPinIcon } from "lucide-react";
import type { Connection } from "@/lib/api";
import { StageBadge } from "@/components/StageBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";

export function ConnectionCard({ connection }: { connection: Connection }) {
  const c = connection;
  return (
    <Link
      to="/connections/$uuid"
      params={{ uuid: c.uuid }}
      className="block rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <Card size="sm" className="transition-colors hover:bg-muted/40">
        <CardHeader className="grid-cols-[1fr_auto] items-start gap-2">
          <CardTitle className="truncate text-[17px]">{c.name}</CardTitle>
          <StageBadge stage={c.stage} />
          <p className="text-muted-foreground col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {c.metLocation && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3" />
                {c.metLocation}
              </span>
            )}
            {c.lastContactAt && <span>· active {timeAgo(c.lastContactAt)}</span>}
            <span>· {c.events.length} logged</span>
          </p>
        </CardHeader>
        <CardContent className="flex items-start gap-2">
          <p className="text-muted-foreground min-w-0 flex-1 text-sm leading-snug">
            {c.nextMove ? (
              <>
                <span className="text-foreground font-medium">Next: </span>
                {c.nextMove}
              </>
            ) : (
              "No next move set yet."
            )}
          </p>
          <ArrowRightIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
