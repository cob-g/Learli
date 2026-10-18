import { sql } from "drizzle-orm";
import {
  check,
  index,
  foreignKey,
  uniqueIndex,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bookingWorkflowPolicies } from "./booking-workflows";
import { learnerAdmissionPolicies } from "./learner-admission";
import { user } from "./auth";
import { subjects, tutorProfiles } from "./app";
import type {
  DemoBookingState,
  DemoLifecycleEvent,
} from "@/features/bookings/lifecycle-model";
import type {
  WorkflowState,
  WorkflowEvent,
} from "@/features/booking-workflows/model";
import { learnerProfiles } from "./learners";

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logicalBookingId: uuid("logical_booking_id")
      .$defaultFn(() => sql`NULL`)
      .notNull(),
    replacesBookingId: uuid("replaces_booking_id"),
    revision: integer("revision").default(0).notNull(),
    source: text("source")
      .$type<"local_simulation" | "synthetic_readiness" | "local_operation">()
      .notNull(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "restrict" }),
    bookedByUserId: text("booked_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    startAtUtc: timestamp("start_at_utc", { withTimezone: true }).notNull(),
    endAtUtc: timestamp("end_at_utc", { withTimezone: true }).notNull(),
    displayTimezone: text("display_timezone").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: text("state").$type<DemoBookingState | WorkflowState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    workflowPolicyId: uuid("workflow_policy_id").references(
      () => bookingWorkflowPolicies.id,
      { onDelete: "restrict" },
    ),
    admissionPolicyId: uuid("admission_policy_id").references(
      () => learnerAdmissionPolicies.id,
      { onDelete: "restrict" },
    ),
    workflowRevision: integer("workflow_revision").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "bookings_logical_fk",
      columns: [table.logicalBookingId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "bookings_replaces_fk",
      columns: [table.replacesBookingId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    unique("bookings_replaces_unique").on(table.replacesBookingId),
    uniqueIndex("bookings_logical_live_unique")
      .on(table.logicalBookingId)
      .where(
        sql`${table.state} IN ('demo_reserved','demo_confirmed','provisional','confirmed')`,
      ),
    check(
      "bookings_revision_valid",
      sql`${table.revision}>=0 AND ((${table.revision}=0 AND ${table.replacesBookingId} IS NULL AND ${table.logicalBookingId}=${table.id}) OR (${table.revision}>0 AND ${table.replacesBookingId} IS NOT NULL AND ${table.logicalBookingId}<>${table.id}))`,
    ),
    unique("bookings_actor_key_unique").on(
      table.bookedByUserId,
      table.idempotencyKey,
    ),
    index("bookings_tutor_time_idx").on(table.tutorId, table.startAtUtc),
    check(
      "bookings_local_source",
      sql`${table.source} IN ('local_simulation','synthetic_readiness','local_operation')`,
    ),
    check(
      "bookings_demo_state",
      sql`(${table.source}='local_simulation' AND ${table.state} IN ('demo_reserved','demo_expired','demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND ${table.workflowPolicyId} IS NULL AND ${table.admissionPolicyId} IS NULL AND ${table.workflowRevision}=0) OR (${table.source} IN ('synthetic_readiness','local_operation') AND ${table.state} IN ('provisional','confirmed','completed','no_show','expired','cancelled','replaced') AND ${table.workflowPolicyId} IS NOT NULL AND ${table.admissionPolicyId} IS NOT NULL AND ${table.workflowRevision}>=0)`,
    ),
    check(
      "bookings_interval_valid",
      sql`isfinite(${table.startAtUtc}) AND isfinite(${table.endAtUtc}) AND ${table.endAtUtc} > ${table.startAtUtc}`,
    ),
    check(
      "bookings_expiry_valid",
      sql`isfinite(${table.createdAt}) AND isfinite(${table.expiresAt}) AND ${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "bookings_fingerprint_valid",
      sql`${table.requestFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "bookings_zone_valid",
      sql`char_length(${table.displayTimezone}) BETWEEN 1 AND 100 AND (${table.displayTimezone} = 'UTC' OR ${table.displayTimezone} ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$')`,
    ),
  ],
);

export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    event: text("event").$type<"demo_reserved" | "demo_expired">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("booking_events_transition_unique").on(table.bookingId, table.event),
    check(
      "booking_events_demo_event",
      sql`${table.event} IN ('demo_reserved','demo_expired')`,
    ),
  ],
);

export const bookingLifecycleEvents = pgTable(
  "booking_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logicalBookingId: uuid("logical_booking_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    replacementBookingId: uuid("replacement_booking_id"),
    workflowPolicyId: uuid("workflow_policy_id").references(
      () => bookingWorkflowPolicies.id,
      { onDelete: "restrict" },
    ),
    workflowRevision: integer("workflow_revision"),
    reasonCode: text("reason_code"),
    actorUserId: text("actor_user_id").notNull(),
    event: text("event").$type<DemoLifecycleEvent | WorkflowEvent>().notNull(),
    requestId: uuid("request_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "booking_lifecycle_events_logical_booking_id_fkey",
      columns: [table.logicalBookingId],
      foreignColumns: [bookings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "booking_lifecycle_events_booking_id_fkey",
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "booking_lifecycle_events_replacement_booking_id_fkey",
      columns: [table.replacementBookingId],
      foreignColumns: [bookings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "booking_lifecycle_events_actor_user_id_fkey",
      columns: [table.actorUserId],
      foreignColumns: [user.id],
    }).onDelete("restrict"),
    check(
      "booking_lifecycle_events_event_check",
      sql`(${table.workflowPolicyId} IS NULL AND ${table.event} IN ('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed') AND ${table.workflowRevision} IS NULL AND ${table.reasonCode} IS NULL) OR (${table.workflowPolicyId} IS NOT NULL AND ${table.event} IN ('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled') AND ${table.workflowRevision}>=0 AND ${table.reasonCode} IN ('synthetic_request','synthetic_prerequisite_review','synthetic_completed','synthetic_no_show','synthetic_participant_change','synthetic_expiry','local_request','local_prerequisite_review','local_completed','local_no_show','local_participant_change','local_expiry'))`,
    ),
    check(
      "booking_lifecycle_events_request_fingerprint_check",
      sql`${table.requestFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "booking_lifecycle_shape",
      sql`(${table.event} IN ('demo_rescheduled','workflow_rescheduled') AND ${table.replacementBookingId} IS NOT NULL) OR (${table.event} NOT IN ('demo_rescheduled','workflow_rescheduled') AND ${table.replacementBookingId} IS NULL)`,
    ),
    unique("booking_lifecycle_actor_request_unique").on(
      table.actorUserId,
      table.requestId,
    ),
    uniqueIndex("booking_workflow_event_revision")
      .on(table.bookingId, table.workflowRevision)
      .where(sql`${table.workflowPolicyId} IS NOT NULL`),
    index("booking_lifecycle_logical_idx").on(table.logicalBookingId),
  ],
);
