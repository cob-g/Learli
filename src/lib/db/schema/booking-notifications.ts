import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bookingEvents } from "./bookings";

export const bookingNotificationDeliveries = pgTable(
  "booking_notification_deliveries",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => bookingEvents.id, { onDelete: "restrict" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: text("kind").$type<"simulated_reservation_created">().notNull(),
    state: text("state")
      .$type<"pending" | "captured" | "suppressed">()
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    failureCode: text("failure_code").$type<"capture_unavailable">(),
    suppressedReason:
      text("suppressed_reason").$type<"outdated_or_unauthorized">(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.recipientUserId, table.kind] }),
    index("booking_notice_pending_idx").on(
      table.state,
      table.createdAt,
      table.eventId,
    ),
    check(
      "booking_notice_kind",
      sql`${table.kind} = 'simulated_reservation_created'`,
    ),
    check(
      "booking_notice_state",
      sql`${table.state} IN ('pending','captured','suppressed')`,
    ),
    check(
      "booking_notice_attempts",
      sql`${table.attempts} >= 0 AND ((${table.attempts} = 0 AND ${table.lastAttemptAt} IS NULL) OR (${table.attempts} > 0 AND ${table.lastAttemptAt} IS NOT NULL))`,
    ),
    check(
      "booking_notice_shape",
      sql`(
    (${table.state} = 'pending' AND ${table.closedAt} IS NULL AND ${table.suppressedReason} IS NULL AND ((${table.attempts} = 0 AND ${table.failureCode} IS NULL) OR (${table.attempts} > 0 AND ${table.failureCode} = 'capture_unavailable')))
    OR (${table.state} = 'captured' AND ${table.closedAt} IS NOT NULL AND ${table.attempts} > 0 AND ${table.failureCode} IS NULL AND ${table.suppressedReason} IS NULL)
    OR (${table.state} = 'suppressed' AND ${table.closedAt} IS NOT NULL AND ${table.attempts} > 0 AND ${table.failureCode} IS NULL AND ${table.suppressedReason} = 'outdated_or_unauthorized')
  ) IS TRUE`,
    ),
    check(
      "booking_notice_finite_times",
      sql`isfinite(${table.createdAt}) AND (${table.lastAttemptAt} IS NULL OR isfinite(${table.lastAttemptAt})) AND (${table.closedAt} IS NULL OR isfinite(${table.closedAt}))`,
    ),
  ],
);
