import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, PlusIcon, SearchIcon } from "lucide-react";
import {
  CONNECTION_STAGES,
  connectionsKeys,
  getConnectionsOverview,
  listConnections,
  type Connection,
  type ConnectionStage,
} from "@/lib/api";
import { STAGE_LABELS } from "@/lib/connection-meta";
import { queryClient } from "@/lib/query-client";
import { ConnectionCard } from "@/components/ConnectionCard";
import { ConnectionForm } from "@/components/ConnectionForm";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const EMPTY_CONNECTIONS: Connection[] = [];

export const Route = createFileRoute("/connections/")({
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: connectionsKeys.overview,
        queryFn: getConnectionsOverview,
      }),
      queryClient.ensureQueryData({
        queryKey: connectionsKeys.list(),
        queryFn: () => listConnections(),
      }),
    ]);
  },
  component: ConnectionsPage,
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 flex flex-1 flex-col items-center rounded-2xl px-2 py-2.5">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </div>
  );
}

function ConnectionsPage() {
  const navigate = useNavigate();
  const [stageFilter, setStageFilter] = useState<ConnectionStage | "all">("all");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: connectionsKeys.list(),
    queryFn: () => listConnections(),
    staleTime: 15_000,
  });
  const overviewQuery = useQuery({
    queryKey: connectionsKeys.overview,
    queryFn: getConnectionsOverview,
    staleTime: 15_000,
  });

  const connections = listQuery.data ?? EMPTY_CONNECTIONS;
  const overview = overviewQuery.data;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return connections.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [connections, stageFilter, q]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Girls</h1>
          <p className="text-muted-foreground text-xs">
            {overview
              ? `${overview.active} active · ${overview.total} total`
              : "Your tracked connections"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Playbook"
            nativeButton={false}
            render={<Link to="/playbook" />}
          >
            <BookOpenIcon />
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
      </div>

      {overview && overview.total > 0 && (
        <div className="flex gap-2 px-4 pt-3">
          <Stat label="Active" value={overview.active} />
          <Stat label="Dating+" value={overview.funnel.find((f) => f.stage === "dating")?.reached ?? 0} />
          <Stat label="Relationships" value={overview.byStage.relationship ?? 0} />
          <Stat label="Closed" value={overview.closed} />
        </div>
      )}

      <div className="px-4 pt-3">
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search connections"
            placeholder="Search by name"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setStageFilter("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            stageFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          All
        </button>
        {CONNECTION_STAGES.map((s) => {
          const count = overview?.byStage[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStageFilter(s)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                stageFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {STAGE_LABELS[s]}
              {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {listQuery.isPending && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-28 w-full rounded-4xl" />
            <Skeleton className="h-28 w-full rounded-4xl" />
            <Skeleton className="h-28 w-full rounded-4xl" />
          </div>
        )}

        {listQuery.isError && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Couldn&apos;t load your connections.
          </p>
        )}

        {listQuery.isSuccess && connections.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlusIcon />
              </EmptyMedia>
              <EmptyTitle>No connections yet</EmptyTitle>
              <EmptyDescription>
                After an approach, tell the wingman what happened — or add her here to
                start tracking.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {listQuery.isSuccess && connections.length > 0 && filtered.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No one matches this filter.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {filtered.map((c: Connection) => (
            <ConnectionCard key={c.uuid} connection={c} />
          ))}
        </div>
      </div>

      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={(c) =>
          void navigate({ to: "/connections/$uuid", params: { uuid: c.uuid } })
        }
      />
    </div>
  );
}
