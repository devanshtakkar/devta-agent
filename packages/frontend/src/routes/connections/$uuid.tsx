import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import {
  connectionsKeys,
  createSession,
  deleteConnection,
  getConnection,
  updateConnection,
  type ConnectionStage,
  type ConnectionStatus,
} from "@/lib/api";
import { isActiveStage, isTerminalStage } from "@/lib/connection-meta";
import { formatDate } from "@/lib/time";
import { queryClient } from "@/lib/query-client";
import { ConnectionForm } from "@/components/ConnectionForm";
import { ConnectionTimeline } from "@/components/ConnectionTimeline";
import { LogInteractionSheet } from "@/components/LogInteractionSheet";
import { StageBadge } from "@/components/StageBadge";
import { StageStepper } from "@/components/StageStepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/connections/$uuid")({
  loader: async ({ params }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: connectionsKeys.detail(params.uuid),
        queryFn: () => getConnection(params.uuid),
      });
    } catch {
      throw redirect({ to: "/connections" });
    }
  },
  component: ConnectionDetailPage,
});

function ConnectionDetailPage() {
  const { uuid } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailQuery = useQuery({
    queryKey: connectionsKeys.detail(uuid),
    queryFn: () => getConnection(uuid),
    staleTime: 10_000,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: ConnectionStatus) => updateConnection(uuid, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteConnection(uuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      void queryClient.removeQueries({ queryKey: connectionsKeys.detail(uuid) });
      void navigate({ to: "/connections" });
    },
  });

  const chatMutation = useMutation({
    mutationFn: () => createSession(uuid),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      void navigate({ to: "/s/$sessionId", params: { sessionId: s.uuid } });
    },
  });

  const c = detailQuery.data;

  if (detailQuery.isPending) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading…
        </p>
      </div>
    );
  }

  if (detailQuery.isError || !c) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm">Couldn&apos;t load this connection.</p>
        <Button variant="outline" nativeButton={false} render={<Link to="/connections" />}>
          Back to girls
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Back to girls"
          nativeButton={false}
          render={<Link to="/connections" />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading truncate text-xl font-semibold tracking-tight">
            {c.name}
          </h1>
          <div className="mt-0.5 flex items-center gap-2">
            <StageBadge stage={c.stage} />
            {c.metLocation && (
              <span className="text-muted-foreground truncate text-xs">{c.metLocation}</span>
            )}
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Edit"
          onClick={() => setFormOpen(true)}
        >
          <PencilIcon />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Stage
          </h2>
          <StageStepper
            stage={c.stage}
            disabled={stageMutation.isPending}
            onSelect={(s: ConnectionStage) => stageMutation.mutate(s)}
          />
          {isTerminalStage(c.stage) && c.closedReason && (
            <p className="text-muted-foreground text-xs">{c.closedReason}</p>
          )}
          {isActiveStage(c.stage) && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => stageMutation.mutate("failed")}
                disabled={stageMutation.isPending}
              >
                Mark failed
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => stageMutation.mutate("ghosted")}
                disabled={stageMutation.isPending}
              >
                Ghosted
              </Button>
            </div>
          )}
        </section>

        <section className="mt-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-[15px]">Next move</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-snug">
                {c.nextMove || "Ask the wingman what to do next with her."}
              </p>
            </CardContent>
          </Card>
        </section>

        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => chatMutation.mutate()}
            disabled={chatMutation.isPending}
          >
            <SparklesIcon data-icon="inline-start" />
            Ask wingman
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLogOpen(true)}
          >
            <PlusIcon data-icon="inline-start" />
            Log
          </Button>
        </div>

        <section className="mt-5 flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Details
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {c.metAt && (
              <>
                <dt className="text-muted-foreground">Met</dt>
                <dd>{formatDate(c.metAt)}</dd>
              </>
            )}
            {c.metContext && (
              <>
                <dt className="text-muted-foreground">Context</dt>
                <dd>{c.metContext}</dd>
              </>
            )}
            {c.approachOpener && (
              <>
                <dt className="text-muted-foreground">Opener</dt>
                <dd>“{c.approachOpener}”</dd>
              </>
            )}
            {c.notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd>{c.notes}</dd>
              </>
            )}
          </dl>
          {!c.metAt && !c.metContext && !c.approachOpener && !c.notes && (
            <p className="text-muted-foreground text-sm">
              No details yet — tap edit to add them.
            </p>
          )}
        </section>

        <section className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Timeline
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setLogOpen(true)}>
              <MessageSquarePlusIcon data-icon="inline-start" />
              Add
            </Button>
          </div>
          <ConnectionTimeline events={c.events} />
        </section>

        <section className="mt-6 border-border/60 border-t pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete {c.name}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete connection
            </Button>
          )}
        </section>
      </div>

      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        connection={c}
      />
      <LogInteractionSheet open={logOpen} onOpenChange={setLogOpen} connection={c} />
    </div>
  );
}
