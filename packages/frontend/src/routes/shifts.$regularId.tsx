import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  getRegular,
  deleteRegular,
  deleteShift,
  regularKeys,
  localDate,
  DAYS,
  basis,
  windowLabel,
  useToday,
  type Shift,
} from "@/lib/shifts";
import {
  FormSheet,
  RegularForm,
  ShiftForm,
  SeenNow,
} from "@/components/ShiftForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/shifts/$regularId")({
  loader: ({ params }) =>
    queryClient
      .ensureQueryData({
        queryKey: regularKeys.detail(params.regularId, localDate()),
        queryFn: () => getRegular(params.regularId),
      })
      .catch(() => null),
  component: RegularView,
});
function DeleteButton({
  label,
  description,
  typed = false,
  run,
  onDone,
}: {
  label: string;
  description: string;
  typed?: boolean;
  run: () => Promise<unknown>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: regularKeys.all });
      setOpen(false);
      onDone?.();
    },
  });
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!mutation.isPending) {
          setOpen(v);
          setConfirm("");
          mutation.reset();
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {description} This cannot be undone.
            {typed && " Type CONFIRM to delete."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {typed && (
          <Input
            aria-label="Type CONFIRM"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
        {mutation.isError && (
          <FieldError>Couldn’t delete. Please try again.</FieldError>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending || (typed && confirm !== "CONFIRM")}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function ShiftRow({ id, shift }: { id: string; shift: Shift }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          {shift.kind === "sighting" ? shift.occurredOn : "Usual shift"} ·{" "}
          {DAYS[shift.dayOfWeek]}
        </CardTitle>
        <CardDescription>{windowLabel(shift)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shift.note && <p className="text-sm">{shift.note}</p>}
        <div className="flex flex-wrap gap-2">
          <FormSheet
            title="Edit shift"
            description="Correct this record."
            trigger="Edit"
          >
            {(close) => (
              <ShiftForm regularId={id} shift={shift} onDone={close} />
            )}
          </FormSheet>
          <DeleteButton
            label="Delete shift"
            description="This shift will be removed."
            run={() => deleteShift(id, shift.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
function RegularView() {
  const { regularId } = Route.useParams();
  const initial = Route.useLoaderData();
  const today = useToday();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: regularKeys.detail(regularId, today),
    queryFn: () => getRegular(regularId),
    initialData: initial ?? undefined,
  });
  const r = query.data;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <Link to="/shifts" className="text-sm underline">
        ← Shift tracker
      </Link>
      {query.isPending && <p>Loading…</p>}
      {query.isError && (
        <div>
          <p>Couldn’t load this person.</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      )}
      {r && (
        <>
          <h1 className="font-heading text-2xl font-semibold">{r.name}</h1>
          <p className="text-muted-foreground">
            {r.venue} · {r.venueType}
            {r.role ? ` · ${r.role}` : ""} · {r.status}
          </p>
          {r.notes && <p>{r.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <SeenNow regular={r} />
            <FormSheet
              title="Edit details"
              description="Pause to hide from Today and Week."
              trigger="Edit details"
            >
              {(close) => <RegularForm regular={r} onDone={close} />}
            </FormSheet>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Weekly pattern</CardTitle>
              <CardDescription>
                Local wall-clock times · observations, not guarantees
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {r.next && <p>Next recorded weekday: {DAYS[r.next.dayOfWeek]}</p>}
              {r.days.map((d) => (
                <div key={d.dayOfWeek}>
                  <p>
                    {DAYS[d.dayOfWeek]} · {windowLabel(d)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {basis(d)}
                    {d.lastSeen ? ` · last seen ${d.lastSeen}` : ""}
                  </p>
                </div>
              ))}
              {!r.days.length && <p>No shifts recorded.</p>}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Shifts & sightings</h2>
            <FormSheet
              title="Add shift"
              description="Record a sighting or a known weekly shift."
              trigger="+ Add shift"
            >
              {(close) => <ShiftForm regularId={r.uuid} onDone={close} />}
            </FormSheet>
          </div>
          {[...r.shifts]
            .sort((a, b) =>
              (b.occurredOn ?? "").localeCompare(a.occurredOn ?? ""),
            )
            .map((s) => (
              <ShiftRow key={s.id} id={r.uuid} shift={s} />
            ))}
          <DeleteButton
            label="Delete person"
            description="This person and all their shifts will be removed."
            typed
            run={() => deleteRegular(r.uuid)}
            onDone={() => void navigate({ to: "/shifts" })}
          />
        </>
      )}
    </div>
  );
}
