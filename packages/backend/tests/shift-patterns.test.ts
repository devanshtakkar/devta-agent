import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateSchema,
  shiftSchema,
  normalizeShift,
  patterns,
  weekday,
  type Shift,
} from "../src/services/shift-patterns.js";

function sighting(date: string, startTime = "09:00", endTime?: string): Shift {
  return {
    id: date,
    kind: "sighting",
    occurredOn: date,
    dayOfWeek: weekday(date),
    startTime,
    endTime,
  };
}
test("dates reject impossible calendar values", () => {
  for (const date of ["2026-02-29", "2026-13-01", "not a date"])
    assert.equal(dateSchema.safeParse(date).success, false);
  assert.equal(dateSchema.safeParse("2024-02-29").success, true);
});
test("weekday comes from the date, independent of local timezone or supplied weekday", () => {
  assert.equal(
    normalizeShift({
      kind: "sighting",
      occurredOn: "2026-10-24",
      startTime: "09:00",
      dayOfWeek: 1,
    }).dayOfWeek,
    6,
  );
});
test("shift validation requires date or weekday and rejects malformed times and future dates", () => {
  for (const body of [
    { kind: "sighting", startTime: "09:00" },
    { kind: "declared", startTime: "09:00" },
    { kind: "declared", dayOfWeek: 7, startTime: "09:00" },
    { kind: "declared", dayOfWeek: 2, startTime: "25:00" },
    { kind: "declared", dayOfWeek: 2, startTime: "09:00", endTime: "08:00" },
    { kind: "sighting", occurredOn: "2099-01-01", startTime: "09:00" },
  ])
    assert.equal(shiftSchema.safeParse(body).success, false);
});
test("patterns count actual sightings, use median times, and prioritize declared times", () => {
  const shifts = [
    sighting("2026-10-10", "08:00"),
    sighting("2026-10-17", "09:00"),
    sighting("2026-10-24", "10:00"),
  ];
  assert.equal(patterns(shifts, "2026-10-24").days[0].startTime, "09:00");
  const result = patterns(
    [
      ...shifts,
      {
        id: "d",
        kind: "declared",
        dayOfWeek: 6,
        startTime: "11:00",
        endTime: "15:00",
      },
    ],
    "2026-10-24",
  );
  assert.deepEqual(result.days[0], {
    dayOfWeek: 6,
    count: 3,
    declared: true,
    startTime: "11:00",
    endTime: "15:00",
    lastSeen: "2026-10-24",
  });
});
test("next weekday wraps the week and empty history has no prediction", () => {
  assert.equal(
    patterns([sighting("2026-10-19")], "2026-10-24").next?.dayOfWeek,
    1,
  );
  assert.deepEqual(patterns([], "2026-10-24"), { days: [], next: undefined });
});
