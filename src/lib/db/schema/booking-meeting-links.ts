import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bookings } from "./bookings";
import { googleMeetJobs } from "./google-meet";

export const bookingMeetingLinks = pgTable(
  "booking_meeting_links",
  {
    bookingId: uuid("booking_id")
      .primaryKey()
      .references(() => bookings.id, { onDelete: "restrict" }),
    provider: text("provider").$type<"zoom" | "google_meet">().notNull(),
    url: text("url").notNull(),
    revision: integer("revision").notNull(),
    actorKind: text("actor_kind")
      .$type<"human" | "system">()
      .notNull()
      .default("human"),
    automationJobId: uuid("automation_job_id"),
    requestId: uuid("request_id").notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "meeting_link_job_fk",
      columns: [t.automationJobId, t.bookingId],
      foreignColumns: [googleMeetJobs.id, googleMeetJobs.bookingId],
    }).onDelete("restrict"),
    check(
      "meeting_link_actor",
      sql`(${t.actorKind}='human' AND ${t.updatedByUserId} IS NOT NULL AND ${t.automationJobId} IS NULL) OR (${t.actorKind}='system' AND ${t.updatedByUserId} IS NULL AND ${t.automationJobId} IS NOT NULL)`,
    ),
    check("booking_meeting_links_revision", sql`${t.revision} > 0`),
    check(
      "booking_meeting_links_provider",
      sql`${t.provider} IN ('zoom','google_meet')`,
    ),
    check(
      "booking_meeting_links_url_bound",
      sql`char_length(${t.url}) BETWEEN 1 AND 2048 AND ${t.url} LIKE 'https://%'`,
    ),
    check("booking_meeting_links_time", sql`isfinite(${t.updatedAt})`),
  ],
);

// Never store a URL, passcode, request body or URL hash in edit history.
export const bookingMeetingLinkEvents = pgTable(
  "booking_meeting_link_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    actorKind: text("actor_kind")
      .$type<"human" | "system">()
      .notNull()
      .default("human"),
    automationJobId: uuid("automation_job_id"),
    requestId: uuid("request_id").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "meeting_event_job_fk",
      columns: [t.automationJobId, t.bookingId],
      foreignColumns: [googleMeetJobs.id, googleMeetJobs.bookingId],
    }).onDelete("restrict"),
    check(
      "meeting_event_actor",
      sql`(${t.actorKind}='human' AND ${t.actorUserId} IS NOT NULL AND ${t.automationJobId} IS NULL) OR (${t.actorKind}='system' AND ${t.actorUserId} IS NULL AND ${t.automationJobId} IS NOT NULL)`,
    ),
    unique("booking_meeting_link_events_revision_unique").on(
      t.bookingId,
      t.revision,
    ),
    unique("booking_meeting_link_events_request_unique").on(
      t.bookingId,
      t.requestId,
    ),
    check("booking_meeting_link_events_revision", sql`${t.revision} > 0`),
    check("booking_meeting_link_events_time", sql`isfinite(${t.createdAt})`),
  ],
);
