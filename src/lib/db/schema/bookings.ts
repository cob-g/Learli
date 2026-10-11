import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { subjects, tutorProfiles } from "./app";
import { learnerProfiles } from "./learners";

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    state: text("state").$type<"demo_reserved" | "demo_expired">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("bookings_actor_key_unique").on(
      table.bookedByUserId,
      table.idempotencyKey,
    ),
    index("bookings_tutor_time_idx").on(table.tutorId, table.startAtUtc),
    check("bookings_local_source", sql`${table.source} = 'local_simulation'`),
    check(
      "bookings_demo_state",
      sql`${table.state} IN ('demo_reserved','demo_expired')`,
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
