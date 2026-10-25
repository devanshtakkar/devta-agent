import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid date");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const shiftSchema = z
  .object({
    kind: z.enum(["sighting", "declared"]),
    occurredOn: dateSchema.optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: timeSchema,
    endTime: timeSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.kind === "sighting" && !s.occurredOn)
      ctx.addIssue({ code: "custom", message: "Date required" });
    if (s.kind === "declared" && s.dayOfWeek === undefined)
      ctx.addIssue({ code: "custom", message: "Weekday required" });
    if (s.endTime && s.endTime <= s.startTime)
      ctx.addIssue({
        code: "custom",
        message: "End must be after start (same day)",
      });
    if (
      s.occurredOn &&
      new Date(`${s.occurredOn}T00:00:00Z`).getTime() > Date.now() + 86400000
    )
      ctx.addIssue({
        code: "custom",
        message: "Future sightings are not allowed",
      });
  });
export type ShiftInput = z.infer<typeof shiftSchema>;
export interface Shift extends ShiftInput {
  id: string;
  dayOfWeek: number;
}
export function normalizeShift(s: ShiftInput) {
  return {
    ...s,
    occurredOn: s.kind === "sighting" ? s.occurredOn : undefined,
    dayOfWeek: s.kind === "sighting" ? weekday(s.occurredOn!) : s.dayOfWeek!,
  };
}
export function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
function median(times: string[]) {
  const sorted = times.sort();
  return sorted[Math.floor(sorted.length / 2)];
}
export function patterns(shifts: Shift[], today: string) {
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const entries = shifts.filter((s) => s.dayOfWeek === dayOfWeek);
    const sightings = entries.filter((s) => s.kind === "sighting");
    const declared = entries.filter((s) => s.kind === "declared");
    const basis = declared.length ? declared : sightings;
    const startTime = median(basis.map((s) => s.startTime));
    const endTime = median(
      basis.flatMap((s) => (s.endTime ? [s.endTime] : [])),
    );
    return {
      dayOfWeek,
      count: sightings.length,
      declared: declared.length > 0,
      startTime,
      endTime: endTime && endTime > startTime ? endTime : undefined,
      lastSeen: sightings
        .map((s) => s.occurredOn!)
        .sort()
        .at(-1),
    };
  }).filter((d) => d.startTime);
  const next = [...days].sort(
    (a, b) =>
      ((a.dayOfWeek - weekday(today) + 7) % 7) -
      ((b.dayOfWeek - weekday(today) + 7) % 7),
  )[0];
  return { days, next };
}
