import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CONNECTION_STAGES,
  CONNECTION_TERMINAL,
  EVENT_TYPES,
  addConnectionEvent,
  connectionsKeys,
  type Connection,
  type ConnectionEventInput,
  type ConnectionEventType,
  type ConnectionStatus,
} from "@/lib/api";
import { EVENT_LABELS, STAGE_LABELS } from "@/lib/connection-meta";
import { toDatetimeLocal } from "@/lib/time";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

export function LogInteractionSheet({
  open,
  onOpenChange,
  connection,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection;
  onLogged?: (connection: Connection) => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<ConnectionEventType>("note");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [location, setLocation] = useState("");
  const [stage, setStage] = useState<"" | ConnectionStatus>("");

  useEffect(() => {
    if (!open) return;
    setType("note");
    setTitle("");
    setDetails("");
    setOccurredAt(toDatetimeLocal());
    setLocation(connection.metLocation ?? "");
    setStage("");
  }, [open, connection]);

  const mutation = useMutation({
    mutationFn: (input: ConnectionEventInput) =>
      addConnectionEvent(connection.uuid, input),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      onOpenChange(false);
      onLogged?.(saved);
    },
  });

  function submit() {
    if (mutation.isPending) return;
    mutation.mutate({
      type,
      title: title.trim() || undefined,
      details: details.trim() || undefined,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      location: location.trim() || undefined,
      stage: stage || undefined,
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Log an interaction</DrawerTitle>
          <DrawerDescription>Adds to {connection.name}&apos;s timeline.</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">What happened</span>
            <select
              className={selectClass}
              aria-label="What happened"
              value={type}
              onChange={(e) => setType(e.target.value as ConnectionEventType)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Title</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              aria-label="Title"
              placeholder="Short summary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Details</span>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              aria-label="Details"
              placeholder="What she said, how it felt, what you did"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground font-medium">When</span>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                aria-label="When"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground font-medium">Where</span>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                aria-label="Where"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Move to stage (optional)</span>
            <select
              className={selectClass}
              aria-label="Move to stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ConnectionStatus | "")}
            >
              <option value="">Keep current</option>
              {[...CONNECTION_STAGES, ...CONNECTION_TERMINAL].map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {mutation.isError && (
            <p className="text-destructive text-xs">Couldn&apos;t log — try again.</p>
          )}
        </div>
        <DrawerFooter>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : "Log interaction"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
