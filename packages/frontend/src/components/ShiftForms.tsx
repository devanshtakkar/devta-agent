import { useId, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import {
  createRegular,
  updateRegular,
  saveShift,
  regularKeys,
  localDate,
  localTime,
  weekday,
  DAYS,
  type Regular,
  type RegularBody,
  type Shift,
  type ShiftBody,
} from "@/lib/shifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function errorText(error: unknown) {
  return error instanceof ApiError
    ? ((error.body as { error?: string })?.error ??
        "Could not save. Try again.")
    : "Could not save. Check your connection.";
}
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options.map((value) => ({ value, label: value }))}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength = 200,
  list,
  max,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  list?: string;
  max?: string;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        list={list}
        max={max}
      />
    </Field>
  );
}
export function RegularForm({
  regular,
  venues = [],
  onDone,
}: {
  regular?: Regular;
  venues?: string[];
  onDone: (r: Regular) => void;
}) {
  const [draft, setDraft] = useState<RegularBody>({
    name: regular?.name ?? "",
    venue: regular?.venue ?? "",
    venueType: regular?.venueType ?? "cafe",
    role: regular?.role ?? "",
    notes: regular?.notes ?? "",
    status: regular?.status ?? "watching",
  });
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState(localTime());
  const listId = useId();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      regular
        ? updateRegular(regular.uuid, draft)
        : createRegular({
            ...draft,
            shift: {
              kind: "sighting",
              occurredOn: date,
              dayOfWeek: weekday(date),
              startTime: time,
            },
          }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: regularKeys.all });
      onDone(r);
    },
  });
  const set = (key: keyof RegularBody) => (v: string) =>
    setDraft((d) => ({ ...d, [key]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending}>
        <FieldGroup className="p-4">
          <TextField
            label="Name or nickname"
            value={draft.name}
            onChange={set("name")}
            required
            maxLength={120}
          />
          <TextField
            label="Place"
            value={draft.venue}
            onChange={set("venue")}
            required
            list={listId}
          />
          <datalist id={listId}>
            {venues.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <Choice
            label="Place type"
            value={draft.venueType}
            options={["cafe", "restaurant", "grocery", "other"]}
            onChange={set("venueType")}
          />
          <TextField
            label="Role (optional)"
            value={draft.role ?? ""}
            onChange={set("role")}
            maxLength={120}
          />
          <TextField
            label="Notes (optional)"
            value={draft.notes ?? ""}
            onChange={set("notes")}
            maxLength={4000}
          />
          {regular ? (
            <Choice
              label="Status"
              value={draft.status}
              options={["watching", "approached", "paused"]}
              onChange={set("status")}
            />
          ) : (
            <>
              <TextField
                label="First sighting date"
                type="date"
                value={date}
                onChange={setDate}
                required
                max={localDate()}
              />
              <TextField
                label="Seen at"
                type="time"
                value={time}
                onChange={setTime}
                required
              />
            </>
          )}
          {mutation.isError && (
            <FieldError>{errorText(mutation.error)}</FieldError>
          )}
          <Button type="submit">
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
export function ShiftForm({
  regularId,
  shift,
  onDone,
}: {
  regularId: string;
  shift?: Shift;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<ShiftBody["kind"]>(
    shift?.kind ?? "sighting",
  );
  const [date, setDate] = useState(shift?.occurredOn ?? localDate());
  const [day, setDay] = useState(
    String(shift?.dayOfWeek ?? new Date().getDay()),
  );
  const [start, setStart] = useState(shift?.startTime ?? localTime());
  const [end, setEnd] = useState(shift?.endTime ?? "");
  const [note, setNote] = useState(shift?.note ?? "");
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      saveShift(
        regularId,
        {
          kind,
          occurredOn: kind === "sighting" ? date : undefined,
          dayOfWeek: Number(day),
          startTime: start,
          endTime: end || undefined,
          note,
        },
        shift?.id,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: regularKeys.all });
      onDone();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending}>
        <FieldGroup className="p-4">
          <Tabs
            value={kind}
            onValueChange={(v) => setKind(v as ShiftBody["kind"])}
          >
            <TabsList>
              <TabsTrigger value="sighting">Sighting</TabsTrigger>
              <TabsTrigger value="declared">Usual shift</TabsTrigger>
            </TabsList>
            <TabsContent value="sighting">
              <TextField
                label="Date seen"
                type="date"
                value={date}
                onChange={setDate}
                required
                max={localDate()}
              />
            </TabsContent>
            <TabsContent value="declared">
              <Choice
                label="Weekday"
                value={DAYS[Number(day)]}
                options={DAYS}
                onChange={(v) => setDay(String(DAYS.indexOf(v)))}
              />
            </TabsContent>
          </Tabs>
          <TextField
            label="Start / observed time"
            type="time"
            value={start}
            onChange={setStart}
            required
          />
          <TextField
            label="End time (optional, same day)"
            type="time"
            value={end}
            onChange={setEnd}
          />
          <TextField
            label="Note (optional)"
            value={note}
            onChange={setNote}
            maxLength={1000}
          />
          {mutation.isError && (
            <FieldError>{errorText(mutation.error)}</FieldError>
          )}
          <Button type="submit">
            {mutation.isPending ? "Saving…" : "Save shift"}
          </Button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
export function FormSheet({
  title,
  description,
  trigger,
  children,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="outline" />}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto pb-4">
          {open && children(() => setOpen(false))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
export function SeenNow({ regular }: { regular: Regular }) {
  const qc = useQueryClient();
  const today = localDate();
  const existing = regular.shifts.find(
    (s) => s.kind === "sighting" && s.occurredOn === today,
  );
  const mutation = useMutation({
    mutationFn: () =>
      saveShift(regular.uuid, {
        kind: "sighting",
        occurredOn: today,
        dayOfWeek: weekday(today),
        startTime: localTime(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: regularKeys.all });
    },
  });
  return (
    <div>
      <Button
        size="sm"
        disabled={!!existing || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {existing
          ? `Logged today at ${existing.startTime}`
          : mutation.isPending
            ? "Saving…"
            : "Seen now"}
      </Button>
      {mutation.isError && <FieldError>{errorText(mutation.error)}</FieldError>}
    </div>
  );
}
