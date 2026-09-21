import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlusIcon } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import {
  connectionsKeys,
  listConnections,
  STAGE_LABELS,
  type Connection,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const Route = createFileRoute("/connections/")({
  loader: () =>
    queryClient.ensureQueryData({
      queryKey: connectionsKeys.list(),
      queryFn: () => listConnections(),
    }),
  component: ConnectionsView,
});

function stageVariant(stage: Connection["stage"]) {
  if (stage === "failed" || stage === "ghosted") return "destructive" as const;
  if (stage === "married" || stage === "engaged" || stage === "relationship")
    return "default" as const;
  return "secondary" as const;
}

function ConnectionsView() {
  const connections = Route.useLoaderData();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-4">
      <h1 className="font-heading mb-1 text-2xl font-semibold tracking-tight">
        Connections
      </h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Everyone you're tracking, newest first.
      </p>

      {connections.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserPlusIcon />
            </EmptyMedia>
            <EmptyTitle>No connections yet</EmptyTitle>
            <EmptyDescription>
              In a chat, tell your wingman how an approach went or tap + → Save
              approach. Saved connections show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mt-2 flex flex-col gap-3 pb-4">
          {connections.map((c) => (
            <Link
              key={c.uuid}
              to="/connections/$connectionId"
              params={{ connectionId: c.uuid }}
            >
              <Card>
                <CardHeader>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant={stageVariant(c.stage)}>
                      {STAGE_LABELS[c.stage]}
                    </Badge>
                    {c.metLocation && <span className="truncate">{c.metLocation}</span>}
                  </CardDescription>
                  <CardTitle>{c.name}</CardTitle>
                  {(c.summary || c.events.length > 0) && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {c.summary || c.events[c.events.length - 1]?.title}
                    </p>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
