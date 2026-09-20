import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CONNECTION_STAGES,
  CONNECTION_TERMINAL,
  connectionsKeys,
  createConnection,
  updateConnection,
  type Connection,
  type ConnectionInput,
  type ConnectionStatus,
} from "@/lib/api";
import { STAGE_LABELS } from "@/lib/connection-meta";
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
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

interface FormState {
  name: string;
  metLocation: string;
  metAt: string;
  metContext: string;
  approachOpener: string;
  approachRisk: "" | "low" | "medium" | "high";
  stage: ConnectionStatus;
  nextMove: string;
  notes: string;
  rating: string;
}

const EMPTY: FormState = {
  name: "",
  metLocation: "",
  metAt: "",
  metContext: "",
  approachOpener: "",
  approachRisk: "",
  stage: "approached",
  nextMove: "",
  notes: "",
  rating: "",
};

function fromConnection(c: Connection): FormState {
  return {
    name: c.name,
    metLocation: c.metLocation ?? "",
    metAt: toDatetimeLocal(c.metAt),
    metContext: c.metContext ?? "",
    approachOpener: c.approachOpener ?? "",
    approachRisk: c.approachRisk ?? "",
    stage: c.stage,
    nextMove: c.nextMove ?? "",
    notes: c.notes ?? "",
    rating: c.rating != null ? String(c.rating) : "",
  };
}

function toPayload(form: FormState): ConnectionInput {
  return {
    name: form.name.trim(),
    metLocation: form.metLocation.trim(),
    metAt: form.metAt ? new Date(form.metAt).toISOString() : undefined,
    metContext: form.metContext.trim(),
    approachOpener: form.approachOpener.trim(),
    approachRisk: form.approachRisk || undefined,
    stage: form.stage,
    nextMove: form.nextMove.trim(),
    notes: form.notes.trim(),
    rating: form.rating ? Number(form.rating) : undefined,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}

export function ConnectionForm({
  open,
  onOpenChange,
  connection,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection?: Connection;
  onSaved?: (connection: Connection) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) setForm(connection ? fromConnection(connection) : EMPTY);
  }, [open, connection]);

  const mutation = useMutation({
    mutationFn: (input: ConnectionInput) =>
      connection ? updateConnection(connection.uuid, input) : createConnection(input),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKeys.all });
      onOpenChange(false);
      onSaved?.(saved);
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    if (!form.name.trim() || mutation.isPending) return;
    mutation.mutate(toPayload(form));
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{connection ? "Edit connection" : "New connection"}</DrawerTitle>
          <DrawerDescription>
            Everything here is private and only used to coach you.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3">
          <Field label="Name or label">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={80}
              aria-label="Name or label"
              placeholder="e.g. Ana from the cafe"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Where you met">
              <Input
                value={form.metLocation}
                onChange={(e) => set("metLocation", e.target.value)}
                maxLength={200}
                aria-label="Where you met"
                placeholder="Cafe, street…"
              />
            </Field>
            <Field label="When">
              <Input
                type="datetime-local"
                value={form.metAt}
                onChange={(e) => set("metAt", e.target.value)}
                aria-label="When you met"
              />
            </Field>
          </div>
          <Field label="Stage">
            <select
              className={cn(selectClass)}
              aria-label="Stage"
              value={form.stage}
              onChange={(e) => set("stage", e.target.value as ConnectionStatus)}
            >
              {[...CONNECTION_STAGES, ...CONNECTION_TERMINAL].map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Opener used">
            <Textarea
              value={form.approachOpener}
              onChange={(e) => set("approachOpener", e.target.value)}
              rows={2}
              aria-label="Opener used"
              placeholder="What you actually said"
            />
          </Field>
          <Field label="Context / notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              aria-label="Context or notes"
              placeholder="Anything worth remembering"
            />
          </Field>
          <Field label="Next move">
            <Textarea
              value={form.nextMove}
              onChange={(e) => set("nextMove", e.target.value)}
              rows={2}
              aria-label="Next move"
              placeholder="The one thing to do next"
            />
          </Field>
          {mutation.isError && (
            <p className="text-destructive text-xs">
              Couldn&apos;t save — check your connection and try again.
            </p>
          )}
        </div>
        <DrawerFooter>
          <Button onClick={submit} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? <Spinner /> : connection ? "Save changes" : "Add connection"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
