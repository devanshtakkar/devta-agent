import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, MapPinIcon, MessagesSquareIcon, Trash2Icon } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import {
  connectionsKeys,
  deleteConnection,
  deleteConnectionEvent,
  getConnection,
  STAGE_LABELS,
  type Connection,
  type ConnectionEvent,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
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

function TimelineEvent({
  connectionId,
  event,
}: {
  connectionId: string;
  event: ConnectionEvent;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteConnectionEvent(connectionId, event.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(connectionsKeys.detail(connectionId), updated);
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      setOpen(false);
    },
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{formatDate(event.occurredAt)}</CardDescription>
        <CardTitle>{event.title}</CardTitle>
        <CardAction>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete event: ${event.title}`}
                />
              }
            >
              <Trash2Icon />
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{event.title}” will be removed from the timeline. This can't be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
      {event.details && (
        <CardContent>
          <p className="text-muted-foreground text-sm leading-snug">{event.details}</p>
        </CardContent>
      )}
    </Card>
  );
}

function DeleteConnectionButton({
  connectionId,
  connectionName,
}: {
  connectionId: string;
  connectionName: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => deleteConnection(connectionId, { confirm: "CONFIRM" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      queryClient.removeQueries({ queryKey: connectionsKeys.detail(connectionId) });
      setOpen(false);
      setConfirmText("");
      void navigate({ to: "/connections" });
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirmText("");
      }}
    >
      <AlertDialogTrigger
        render={<Button size="sm" variant="outline" className="text-destructive" />}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete connection
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this connection?</AlertDialogTitle>
          <AlertDialogDescription>
            “{connectionName}” and its timeline will be removed. This can&apos;t be
            undone. The chat it came from is kept. Type{" "}
            <span className="font-medium">CONFIRM</span> to delete.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="CONFIRM"
          aria-label="Type CONFIRM to delete this connection"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={confirmText !== "CONFIRM" || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete connection
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConnectionView() {
  const { connectionId } = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = useNavigate();

  const { data: connection } = useQuery({
    queryKey: connectionsKeys.detail(connectionId),
    queryFn: () => getConnection(connectionId),
    initialData: initial,
    staleTime: 10_000,
  });

  const chatSessionId = connection.originSessionId;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2"
          onClick={() => void navigate({ to: "/connections" })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Connections
        </Button>
        {chatSessionId && (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <Link to="/s/$sessionId" params={{ sessionId: chatSessionId }} />
            }
          >
            <MessagesSquareIcon data-icon="inline-start" />
            Open chat
          </Button>
        )}
      </div>

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
            <TimelineEvent key={e.id} connectionId={connection.uuid} event={e} />
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-2 pb-4 text-xs">
        <Link className="underline" to="/connections">
          View all connections
        </Link>
      </p>

      <div className="border-border/60 border-t pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DeleteConnectionButton
          connectionId={connection.uuid}
          connectionName={connection.name}
        />
      </div>
    </div>
  );
}
