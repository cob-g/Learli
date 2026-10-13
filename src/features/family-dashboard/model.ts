import type { BookingState } from "@/features/bookings/lifecycle-model";
import { z } from "zod";
import { formatLessonTime } from "@/features/bookings/format-time";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";

export type FamilyWorkspace = "student" | "parent";
export type DashboardLearner = {
  id: string;
  displayName: string;
  level: string;
};

// Presentation-only values adapted from the frozen provider DTO. This module
// never queries records or decides who may read them.
export type ReservationInput = {
  id: string;
  learner: DashboardLearner;
  tutorName: string;
  subjectName: string;
  startAtUtc: string;
  endAtUtc: string;
  expiresAt: string;
  state: BookingState;
};
export type ReservationView = ReservationInput & {
  when: LessonTimeValue;
  expiry: LessonTimeValue;
  durationMinutes: number;
};

export const dashboardQuery = z.strictObject({
  learner: z.uuid().optional(),
  historyPage: z
    .string()
    .regex(/^[1-9]\d{0,3}$/)
    .transform(Number)
    .optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuery>;

export function reservationView(
  row: ReservationInput,
  timezone: string,
): ReservationView {
  const start = new Date(row.startAtUtc);
  const end = new Date(row.endAtUtc);
  const expiry = new Date(row.expiresAt);
  return {
    ...row,
    when: formatLessonTime(start, end, timezone),
    expiry: formatLessonTime(expiry, expiry, timezone),
    durationMinutes: (end.getTime() - start.getTime()) / 60_000,
  };
}

export function dashboardHref(
  workspace: FamilyWorkspace,
  query: DashboardQuery = {},
  anchor = "",
) {
  const params = new URLSearchParams();
  if (query.learner) params.set("learner", query.learner);
  if (query.historyPage && query.historyPage > 1)
    params.set("historyPage", String(query.historyPage));
  return `/${workspace}${params.size ? `?${params}` : ""}${anchor}`;
}

export function groupByDate(rows: ReservationView[]) {
  const groups = new Map<string, ReservationView[]>();
  for (const row of rows) {
    const key = `${row.when.date}\u0000${row.when.zone}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups, ([key, reservations]) => ({
    key,
    date: reservations[0].when.date,
    zone: reservations[0].when.zone,
    reservations,
  }));
}
