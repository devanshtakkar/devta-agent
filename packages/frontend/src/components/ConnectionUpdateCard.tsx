import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import {
  addConnectionEvent,
  connectionsKeys,
  createConnection,
  listConnections,
  type Connection,
  type ConnectionEventType,
  type ConnectionStatus,
  type ConnectionUpdateToolPart,
} from "@/lib/api";
import { EVENT_LABELS, stageLabel } from "@/lib/connection-meta";
import { formatDateTime } from "@/lib/time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface UpdateInput {
  action: "create" | "log";
  connectionName: string;
  connectionId?: string;
  stage?: ConnectionStatus;
  eventType?: ConnectionEventType;
  title?: string;
  details?: string;
  occurredAt?: string;
  location?: string;
  metLocation?: string;
  metAt?: string;
  metContext?: string;
  approachOpener?: string;
  nextMove?: string;
  notes?: string;
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-sm leading-snug">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

export function ConnectionUpdateCard({
  part,
  sessionId,
}: {
  part: ConnectionUpdateToolPart;
  sessionId?: string;
}) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<Connection | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const input = part.input as UpdateInput | undefined;

  const needsLookup =
    !!input && input.action === "log" && !input.connectionId && part.state !== "input-streaming";

  const listQuery = useQuery({
    queryKey: connectionsKeys.list(),
    queryFn: () => listConnections(),
    enabled: needsLookup,
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Connection> => {
      if (!input) throw new Error("Nothing to save");
      const name = input.connectionName?.trim();
      if (!name) throw new Error("Missing name");

      if (input.action === "create") {
        return createConnection({
          name,
          metLocation: input.metLocation,
          metAt: input.metAt,
          metContext: input.metContext,
          approachOpener: input.approachOpener,
          stage: input.stage,
          nextMove: input.nextMove,
          notes: input.notes,
          sessionId,
        });
      }

      const existing =
        (input.connectionId
          ? listQuery.data?.find((c) => c.uuid === input.connectionId)
          : undefined) ??
        listQuery.data?.find(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        );

      if (existing) {
        return addConnectionEvent(existing.uuid, {
          type: input.eventType ?? "note",
          title: input.title,
          details: input.details,
          occurredAt: input.occurredAt,
          location: input.location,
          stage: input.stage,
          sessionId,
        });
      }

      return createConnection({
        name,
        stage: input.stage,
        nextMove: input.nextMove,
        notes: input.notes,
        sessionId,
      });
    },
    onSuccess: (connection) => {
      setSaved(connection);
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
    },
  });

  if (part.state === "input-streaming" || !input) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Preparing tracker update">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          {part.errorText || "Couldn't prepare that tracker update."}
        </AlertDescription>
      </Alert>
    );
  }

  if (saved) {
    return (
      <Card size="sm" className="border-emerald-500/30">
        <CardHeader className="grid-cols-[auto_1fr] items-center gap-2">
          <CheckIcon className="size-5 text-emerald-500" />
          <CardTitle className="text-[15px]">
            Saved to tracker — {stageLabel(saved.stage)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link to="/connections/$uuid" params={{ uuid: saved.uuid }} />}
          >
            Open {saved.name}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (dismissed) {
    return (
      <p className="text-muted-foreground text-sm">Tracker update dismissed.</p>
    );
  }

  const isCreate = input.action === "create";
  const occurredLabel = input.occurredAt
    ? formatDateTime(input.occurredAt)
    : undefined;

  return (
    <Card size="sm">
      <CardHeader className="grid-cols-[auto_1fr] items-center gap-2">
        {isCreate ? (
          <PlusCircleIcon className="text-primary size-5" />
        ) : (
          <RefreshCwIcon className="text-primary size-5" />
        )}
        <CardTitle className="text-[15px]">
          {isCreate ? "Save her to your tracker?" : `Update ${input.connectionName}?`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <Row label="Name" value={input.connectionName} />
        <Row label="Stage" value={input.stage ? stageLabel(input.stage) : undefined} />
        <Row
          label="Event"
          value={input.eventType ? EVENT_LABELS[input.eventType] : undefined}
        />
        <Row label="When" value={occurredLabel} />
        <Row label="Where" value={input.location ?? input.metLocation} />
        <Row label="Opener" value={input.approachOpener} />
        <Row label="Next move" value={input.nextMove} />
        <Row label="Details" value={input.details} />
        <Row label="Notes" value={input.notes} />
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (needsLookup && listQuery.isPending)}
          >
            {mutation.isPending
              ? "Saving…"
              : needsLookup && listQuery.isPending
                ? "Checking…"
                : "Confirm & save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            disabled={mutation.isPending}
          >
            Dismiss
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-destructive text-xs">Couldn&apos;t save — try again.</p>
        )}
      </CardContent>
    </Card>
  );
}
