import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import {
  CONNECTION_STAGES,
  connectionsKeys,
  createConnection,
  listConnections,
  STAGE_LABELS,
  type Connection,
  type ConnectionDraft,
  type ConnectionStage,
  type ConnectionToolPart,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function Loading() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Preparing connection">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Renders the `proposeConnection` tool output as an editable draft. Nothing is
 * persisted until the user reviews the agent's summary and taps Save. A chat
 * session owns at most one connection, so once this tool call has been saved
 * the card shows the saved state instead of the form — even after reopening.
 */
export function ConnectionDraftCard({
  part,
  sessionId,
}: {
  part: ConnectionToolPart;
  sessionId: string | null;
}) {
  if (part.state === "input-streaming") return <Loading />;
  if (part.state === "output-error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          {part.errorText || "Couldn't prepare the connection — try again."}
        </AlertDescription>
      </Alert>
    );
  }
  if (!part.input?.name) return <Loading />;
  return (
    <DraftForm
      key={part.toolCallId}
      toolCallId={part.toolCallId}
      draft={part.input}
      sessionId={sessionId}
    />
  );
}

function SavedCard({ connection }: { connection: Connection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckIcon className="text-primary size-4" />
          Saved {connection.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          Now at “{STAGE_LABELS[connection.stage]}”.
        </span>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link
              to="/connections/$connectionId"
              params={{ connectionId: connection.uuid }}
            />
          }
        >
          Open tracker
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function DraftForm({
  toolCallId,
  draft,
  sessionId,
}: {
  toolCallId: string;
  draft: Partial<ConnectionDraft>;
  sessionId: string | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(draft.name ?? "");
  const [stage, setStage] = useState<ConnectionStage>(draft.stage ?? "approached");
  const [whatHappened, setWhatHappened] = useState(
    draft.whatHappened ?? draft.summary ?? "",
  );
  const [metLocation, setMetLocation] = useState(draft.metLocation ?? "");
  const [metAt, setMetAt] = useState(draft.metAt ?? "");
  const [approachOpener, setApproachOpener] = useState(draft.approachOpener ?? "");
  const [summary, setSummary] = useState(draft.summary ?? "");
  const [saved, setSaved] = useState<Connection | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const existingQuery = useQuery({
    queryKey: connectionsKeys.list(sessionId ?? undefined),
    queryFn: () => listConnections(sessionId ?? undefined),
    enabled: sessionId !== null,
    staleTime: 15_000,
  });
  const sessionConnection = existingQuery.data?.[0];

  const alreadySaved =
    !!sessionConnection && sessionConnection.savedToolCallIds.includes(toolCallId);
  const tracked = saved ?? (alreadySaved ? sessionConnection : null);

  const saveMutation = useMutation({
    mutationFn: () => {
      const isUpdate = !!sessionConnection;
      const cleanWhatHappened = whatHappened.trim();
      const cleanSummary = summary.trim();
      return createConnection({
        originSessionId: sessionId ?? undefined,
        name: name.trim(),
        stage,
        summary: cleanSummary || undefined,
        metLocation: metLocation.trim() || undefined,
        metAt: metAt.trim() || undefined,
        approachOpener: approachOpener.trim() || undefined,
        toolCallId,
        event: {
          type: isUpdate ? "note" : "approach",
          title: isUpdate
            ? cleanSummary || "Interaction update"
            : approachOpener.trim()
              ? `Opened with: “${approachOpener.trim()}”`
              : "First approach",
          details: cleanWhatHappened || undefined,
          occurredAt: metAt.trim() || undefined,
          location: metLocation.trim() || undefined,
          sessionId: sessionId ?? undefined,
          toolCallId,
        },
      });
    },
    onSuccess: (conn) => {
      setSaved(conn);
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
    },
  });

  if (dismissed) return null;
  if (tracked) return <SavedCard connection={tracked} />;

  const isUpdate = !!sessionConnection;
  const canSave = name.trim().length > 0 && !saveMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isUpdate ? `Add to ${sessionConnection.name}` : "Save this as a connection"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Her name"
                maxLength={120}
              />
            </Field>
          </div>
          <Field label="Stage">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as ConnectionStage)}
              className="border-transparent bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 h-9 rounded-3xl border px-3 text-base outline-none focus-visible:ring-3 md:text-sm"
            >
              {CONNECTION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="What happened">
          <Textarea
            value={whatHappened}
            onChange={(e) => setWhatHappened(e.target.value)}
            placeholder="What you said, how she responded, how it went…"
            className="min-h-24"
          />
        </Field>

        <details className="group">
          <summary className="text-muted-foreground cursor-pointer text-xs font-medium select-none">
            More details
          </summary>
          <div className="flex flex-col gap-3 pt-3">
            <Field label="Where we met">
              <Input
                value={metLocation}
                onChange={(e) => setMetLocation(e.target.value)}
                placeholder="Cafe, street, party…"
                maxLength={200}
              />
            </Field>
            <Field label="When (optional)">
              <Input
                value={metAt}
                onChange={(e) => setMetAt(e.target.value)}
                placeholder="2026-09-21T18:30 or leave blank"
              />
            </Field>
            <Field label="Opener used">
              <Input
                value={approachOpener}
                onChange={(e) => setApproachOpener(e.target.value)}
                placeholder="The exact first line"
                maxLength={2000}
              />
            </Field>
            <Field label="Summary">
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1-2 sentence read of where this stands"
                className="min-h-16"
              />
            </Field>
          </div>
        </details>

        {saveMutation.isError && (
          <p className="text-destructive text-xs">
            Couldn't save — check your connection and try again.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            <CheckIcon data-icon="inline-start" />
            {saveMutation.isPending ? "Saving…" : isUpdate ? "Add update" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={saveMutation.isPending}
            onClick={() => setDismissed(true)}
          >
            <XIcon data-icon="inline-start" />
            Discard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
