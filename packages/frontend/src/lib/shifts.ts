import { apiFetch } from "./api";
import { useEffect, useState } from "react";

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localTime() {
  return new Date().toTimeString().slice(0, 5);
}
export function useToday() {
  const [today, setToday] = useState(localDate());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 30000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
export function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
export interface Shift {
  id: string;
  kind: "sighting" | "declared";
  occurredOn?: string;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  note?: string;
}
export interface Pattern {
  dayOfWeek: number;
  count: number;
  declared: boolean;
  startTime: string;
  endTime?: string;
  lastSeen?: string;
}
export interface Regular {
  uuid: string;
  name: string;
  venue: string;
  venueType: "cafe" | "restaurant" | "grocery" | "other";
  role?: string;
  notes?: string;
  status: "watching" | "approached" | "paused";
  shifts: Shift[];
  days: Pattern[];
  next?: Pattern;
}
export type RegularBody = Pick<
  Regular,
  "name" | "venue" | "venueType" | "role" | "notes" | "status"
>;
export type ShiftBody = Omit<Shift, "id">;
export const regularKeys = {
  all: ["regulars"] as const,
  list: (date: string) => ["regulars", "list", date] as const,
  detail: (id: string, date: string) => ["regulars", id, date] as const,
};
const query = () => `today=${localDate()}`;
export const listRegulars = () =>
  apiFetch<{ regulars: Regular[] }>(`/api/regulars?${query()}`).then(
    (d) => d.regulars,
  );
export const getRegular = (id: string) =>
  apiFetch<Regular>(`/api/regulars/${id}?${query()}`);
export const createRegular = (body: RegularBody & { shift?: ShiftBody }) =>
  apiFetch<Regular>(`/api/regulars?${query()}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateRegular = (id: string, body: RegularBody) =>
  apiFetch<Regular>(`/api/regulars/${id}?${query()}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteRegular = (id: string) =>
  apiFetch<void>(`/api/regulars/${id}?confirm=CONFIRM`, { method: "DELETE" });
export const saveShift = (id: string, body: ShiftBody, shiftId?: string) =>
  apiFetch<Regular>(
    `/api/regulars/${id}/shifts${shiftId ? `/${shiftId}` : ""}?${query()}`,
    { method: shiftId ? "PATCH" : "POST", body: JSON.stringify(body) },
  );
export const deleteShift = (id: string, shiftId: string) =>
  apiFetch<Regular>(`/api/regulars/${id}/shifts/${shiftId}?${query()}`, {
    method: "DELETE",
  });
export function basis(p: Pattern) {
  return [
    p.declared ? "Usual shift" : "Observed",
    p.count ? `${p.count} sighting${p.count === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function windowLabel(p: Pick<Pattern, "startTime" | "endTime">) {
  return `${p.startTime}${p.endTime ? `–${p.endTime}` : " (observed time)"}`;
}
