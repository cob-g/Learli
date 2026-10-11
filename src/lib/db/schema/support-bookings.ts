import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bookings } from "./bookings";
import { supportCases } from "./support";

export const supportCaseBookings = pgTable(
  "support_case_bookings",
  {
    caseId: uuid("case_id")
      .primaryKey()
      .references(() => supportCases.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
  },
  (t) => [index("support_case_bookings_booking_idx").on(t.bookingId)],
);

export const supportBookingAccessEvents = pgTable(
  "support_booking_access_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => supportCaseBookings.caseId, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").$type<"booking_context_read">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "support_booking_access_action",
      sql`${t.action} = 'booking_context_read'`,
    ),
  ],
);
