import {
  effectiveDemoState,
  type BookingState,
  type BookingEvent,
} from "./lifecycle-model";
import type { LearnerLevel } from "@/lib/db/schema/app";
import { formatLessonTime } from "./format-time";
import type { BookingDetail } from "./read-model";

// Internal SQL projection; this is not the consumer read contract.
export type StoredBookingRead = {
  id: string;
  source?: "local_simulation" | "synthetic_readiness" | "local_operation";
  workflowRevision?: number;
  policyVersion?: string;
  logicalBookingId?: string;
  revision?: number;
  currentHeadId?: string;
  tutorName: string;
  tutorSlug: string;
  subjectName: string;
  subjectSlug: string;
  learnerId: string;
  learnerName: string;
  learnerLevel: LearnerLevel;
  state: BookingState;
  start: string;
  end: string;
  expires: string;
  events: {
    id: string;
    event: "demo_reserved" | "demo_expired" | BookingEvent;
    at: string;
  }[];
};

export function projectBookingRead(
  row: StoredBookingRead,
  timezone: string,
  snapshot: Date,
): BookingDetail {
  const expires = new Date(row.expires);
  return {
    id: row.id,
    logicalBookingId: row.logicalBookingId ?? row.id,
    revision: row.revision ?? 0,
    currentHeadId: row.currentHeadId ?? row.id,
    source: row.source ?? "local_simulation",
    workflowRevision: row.workflowRevision ?? 0,
    policyVersion: row.policyVersion,
    tutor: { displayName: row.tutorName, slug: row.tutorSlug },
    subject: { name: row.subjectName, slug: row.subjectSlug },
    learner: {
      id: row.learnerId,
      displayName: row.learnerName,
      level: row.learnerLevel,
    },
    state: effectiveDemoState(row.state, expires, snapshot),
    persistedState: row.state,
    snapshotAtUtc: snapshot.toISOString(),
    expiresAtUtc: expires.toISOString(),
    expiryMaterialized: row.state === "demo_expired",
    viewerTimezone: timezone,
    time: formatLessonTime(new Date(row.start), new Date(row.end), timezone),
    expires: formatLessonTime(expires, expires, timezone),
    events: row.events.map((event) => {
      const at = new Date(event.at);
      return {
        id: event.id,
        event: event.event,
        occurredAtUtc: at.toISOString(),
        time: formatLessonTime(at, at, timezone),
      };
    }),
  };
}
