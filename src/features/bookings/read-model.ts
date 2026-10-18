import type { BookingState, BookingEvent } from "./lifecycle-model";
// Public client-safe read contract. Mutation inputs and identities stay private.
import type { LearnerLevel } from "@/lib/db/schema/app";
import type { LessonTimeValue } from "./lesson-time";

export type BookingReadScope = "student" | "guardian" | "tutor";
export type BookingReadFilter = "all" | "active" | "history";
export type BookingLearnerSummary = {
  id: string;
  displayName: string;
  level: LearnerLevel;
};
/** Only opaque booking IDs and a permission scope belong in the protected URL. */
export function bookingDetailPath(id: string, scope: BookingReadScope) {
  return `/bookings/${encodeURIComponent(id)}?scope=${scope}`;
}
export type BookingSummary = {
  id: string;
  source: "local_simulation" | "synthetic_readiness" | "local_operation";
  workflowRevision?: number;
  policyVersion?: string;
  logicalBookingId?: string;
  revision?: number;
  currentHeadId?: string;
  tutor: { displayName: string; slug: string };
  subject: { name: string; slug: string };
  learner: { id: string; displayName: string; level: LearnerLevel };
  state: BookingState;
  persistedState: BookingState;
  snapshotAtUtc: string;
  expiresAtUtc: string;
  expiryMaterialized: boolean;
  time: LessonTimeValue;
  expires: LessonTimeValue;
  viewerTimezone: string;
};
export type BookingDetail = BookingSummary & {
  events: {
    id: string;
    event: "demo_reserved" | "demo_expired" | BookingEvent;
    occurredAtUtc: string;
    time: LessonTimeValue;
  }[];
};
export type BookingPage = {
  items: BookingSummary[];
  learners: BookingLearnerSummary[];
  scope: BookingReadScope;
  filter: BookingReadFilter;
  page: number;
  pageSize: number;
  hasNext: boolean;
  viewerTimezone: string;
  snapshotAtUtc: string;
};
export type BookingOverview = {
  active: BookingPage;
  history: BookingPage;
  /** Earliest expiry over all active timed reservations in scope, not one page. */
  earliestExpiryAtUtc: string | null;
};
