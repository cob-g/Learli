import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tutorProfiles } from "./app";

/** Concrete half-open UTC intervals; teaching-zone changes never move them. */
export const tutorAvailabilityExceptions = pgTable(
  "tutor_availability_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    startAtUtc: timestamp("start_at_utc", { withTimezone: true }).notNull(),
    endAtUtc: timestamp("end_at_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tutor_time_off_start_idx").on(table.tutorId, table.startAtUtc),
    uniqueIndex("tutor_time_off_interval_unique").on(
      table.tutorId,
      table.startAtUtc,
      table.endAtUtc,
    ),
    check(
      "tutor_time_off_interval_valid",
      sql`isfinite(${table.startAtUtc}) AND isfinite(${table.endAtUtc}) AND ${table.endAtUtc} > ${table.startAtUtc} AND ${table.startAtUtc} >= '0100-01-01'::timestamptz AND ${table.endAtUtc} < '10000-01-01'::timestamptz`,
    ),
  ],
);
