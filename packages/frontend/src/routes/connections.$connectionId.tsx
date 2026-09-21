import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, MapPinIcon } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import {
  connectionsKeys,
  getConnection,
  STAGE_LABELS,
  type Connection,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/connections/$connectionId")({
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: connectionsKeys.detail(params.connectionId),
      queryFn: () => getConnection(params.connectionId),
    }),
  component: ConnectionView,
});

function stageVariant(stage: Connection["stage"]) {
  if (stage === "failed" || stage === "ghosted") return "destructive" as const;
  if (stage === "married" || stage === "engaged" || stage === "relationship")
    return "default" as const;
  return "secondary" as const;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ConnectionView() {
  const connection = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-4">
      <Button
        size="sm"
        variant="ghost"
        className="mb-2 -ml-2 self-start"
        onClick={() => void navigate({ to: "/connections" })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Connections
      </Button>

      <div className="mb-1 flex items-center gap-2">
        <Badge variant={stageVariant(connection.stage)}>
          {STAGE_LABELS[connection.stage]}
        </Badge>
        {connection.metLocation && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPinIcon className="size-3" />
            {connection.metLocation}
          </span>
        )}
      </div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {connection.name}
      </h1>
      {connection.summary && (
        <p className="text-muted-foreground mt-1 text-sm">{connection.summary}</p>
      )}

      {connection.approachOpener && (
        <div className="border-border/60 bg-muted/50 mt-4 rounded-xl border px-3.5 py-2.5">
          <p className="text-muted-foreground text-xs font-medium">Opener used</p>
          <p className="text-[15px] leading-snug">“{connection.approachOpener}”</p>
        </div>
      )}

      <h2 className="font-heading section-heading text-sm font-medium tracking-tight">
        Timeline
      </h2>
      {connection.events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events logged yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5 pb-4">
          {[...connection.events].reverse().map((e) => (
            <Card key={e.id} size="sm">
              <CardHeader>
                <CardDescription>{formatDate(e.occurredAt)}</CardDescription>
                <CardTitle>{e.title}</CardTitle>
              </CardHeader>
              {e.details && (
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-snug">
                    {e.details}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-2 pb-4 text-xs">
        Started from a chat.{" "}
        <Link className="underline" to="/connections">
          View all connections
        </Link>
      </p>
    </div>
  );
}
