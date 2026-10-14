// Node-only composition of Agent1's authorized read DTO. No database/query or
// competing authorization layer lives in this feature.
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { listParticipantBookingOverview } from "@/features/bookings/read-service";
import type { BookingSummary } from "@/features/bookings/read-model";
import { formatLessonTime } from "@/features/bookings/format-time";
import type { DashboardData } from "./dashboard";
import {
  dashboardQuery,
  type FamilyWorkspace,
  type ReservationView,
} from "./model";

function view(row: BookingSummary): ReservationView {
  return {
    id: row.id,
    learner: row.learner,
    tutorName: row.tutor.displayName,
    subjectName: row.subject.name,
    startAtUtc: row.time.startAtUtc,
    endAtUtc: row.time.endAtUtc,
    expiresAt: row.expiresAtUtc,
    state: row.state,
    when: row.time,
    expiry: row.expires,
    durationMinutes:
      (new Date(row.time.endAtUtc).getTime() -
        new Date(row.time.startAtUtc).getTime()) /
      60_000,
  };
}

export async function readFamilyDashboard(
  runtime: AuthRuntime,
  headers: Headers,
  workspace: FamilyWorkspace,
  rawQuery: unknown,
): Promise<DashboardData> {
  const normalized =
    rawQuery && typeof rawQuery === "object" && !Array.isArray(rawQuery)
      ? {
          ...rawQuery,
          ...("learner" in rawQuery && rawQuery.learner === ""
            ? { learner: undefined }
            : {}),
        }
      : rawQuery;
  const parsed = dashboardQuery.safeParse(normalized);
  if (!parsed.success || (workspace === "student" && parsed.data.learner))
    throw new AccessError(404);
  const query = parsed.data;
  const scope = workspace === "parent" ? "guardian" : "student";
  const { active, history, earliestExpiryAtUtc } =
    await listParticipantBookingOverview(runtime, headers, {
      scope,
      learnerId: query.learner,
      page: query.historyPage ?? 1,
      pageSize: 20,
    });
  const learners = history.learners;
  const selectedLearner =
    workspace === "parent"
      ? query.learner
        ? learners.find((learner) => learner.id === query.learner)
        : learners.length === 1
          ? learners[0]
          : undefined
      : undefined;
  if (query.learner && !selectedLearner) throw new AccessError(404);
  const snapshot = new Date(history.snapshotAtUtc);
  return {
    workspace,
    learners,
    selectedLearner,
    query,
    active: active.items.map(view),
    history: history.items.map(view),
    activeHasNext: active.hasNext,
    earliestExpiry: earliestExpiryAtUtc,
    historyHasNext: history.hasNext,
    checkedAt: formatLessonTime(snapshot, snapshot, history.viewerTimezone),
  };
}
