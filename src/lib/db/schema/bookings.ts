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
import { user } from "./auth";
import { subjects, tutorProfiles } from "./app";
import type {
  DemoBookingState,
  DemoLifecycleEvent,
} from "@/features/bookings/lifecycle-model";
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
    source: text("source").$type<"local_simulation">().notNull(),
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
    state: text("state").$type<DemoBookingState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
      .where(sql`${table.state} IN ('demo_reserved','demo_confirmed')`),
    check(
      "bookings_revision_valid",
      sql`${table.revision}>=0 AND ((${table.revision}=0 AND ${table.replacesBookingId} IS NULL AND ${table.logicalBookingId}=${table.id}) OR (${table.revision}>0 AND ${table.replacesBookingId} IS NOT NULL AND ${table.logicalBookingId}<>${table.id}))`,
    ),
    unique("bookings_actor_key_unique").on(
      table.bookedByUserId,
      table.idempotencyKey,
    ),
    index("bookings_tutor_time_idx").on(table.tutorId, table.startAtUtc),
    check("bookings_local_source", sql`${table.source} = 'local_simulation'`),
    check(
      "bookings_demo_state",
      sql`${table.state} IN ('demo_reserved','demo_expired','demo_cancelled','demo_replaced','demo_confirmed','demo_completed')`,
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
    actorUserId: text("actor_user_id").notNull(),
    event: text("event").$type<DemoLifecycleEvent>().notNull(),
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
      sql`${table.event} IN ('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed')`,
    ),
    check(
      "booking_lifecycle_events_request_fingerprint_check",
      sql`${table.requestFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "booking_lifecycle_shape",
      sql`(${table.event}='demo_rescheduled' AND ${table.replacementBookingId} IS NOT NULL) OR (${table.event}<>'demo_rescheduled' AND ${table.replacementBookingId} IS NULL)`,
    ),
    unique("booking_lifecycle_actor_request_unique").on(
      table.actorUserId,
      table.requestId,
    ),
    index("booking_lifecycle_logical_idx").on(table.logicalBookingId),
  ],
);
