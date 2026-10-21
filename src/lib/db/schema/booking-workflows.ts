import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { user } from "./auth";
import type { EnabledBookingPolicy } from "@/features/booking-workflows/policy";
export const bookingWorkflowPolicies = pgTable(
  "booking_workflow_policies",
  {
    id: uuid("id").primaryKey(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    contentDigest: text("content_digest").notNull(),
    terms: jsonb("terms").$type<EnabledBookingPolicy>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "booking_workflow_policy_shape",
      sql`((${t.version}='synthetic-booking-v1' AND ${t.reference}='synthetic:booking:v1') OR (${t.version}='synthetic-booking-v2' AND ${t.reference}='synthetic:booking:v2') OR (${t.version}='local-parent-booking-v2' AND ${t.reference}='local:parent-booking:v2') OR (${t.version}='local-independent-booking-v2' AND ${t.reference}='local:independent-booking:v2') OR (${t.version}='local-booking-v1' AND ${t.reference}='local:booking:v1')) AND ${t.contentDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
export const bookingWorkflowPolicyHead = pgTable(
  "booking_workflow_policy_head",
  {
    source: text("source").primaryKey(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => bookingWorkflowPolicies.id, { onDelete: "restrict" }),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [
    check(
      "booking_workflow_policy_head_source",
      sql`${t.source} IN ('synthetic_readiness','local_operation')`,
    ),
  ],
);
export const bookingWorkflowGrants = pgTable(
  "booking_workflow_grants",
  {
    logicalBookingId: uuid("logical_booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action")
      .$type<"confirm" | "complete" | "no_show">()
      .notNull(),
    active: boolean("active").notNull().default(false),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    reference: text("reference").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.logicalBookingId, t.actorUserId, t.action] }),
    check(
      "booking_workflow_grant_shape",
      sql`${t.action} IN ('confirm','complete','no_show') AND ((${t.validUntil} IS NOT NULL AND isfinite(${t.validUntil}) AND ${t.reference} ~ '^synthetic:[0-9a-f-]{36}$') OR (${t.validUntil} IS NULL AND ${t.reference} ~ '^local:[0-9a-f-]{36}$'))`,
    ),
  ],
);
import { bookingLifecycleEvents } from "./bookings";
import type { WorkflowEvent } from "@/features/booking-workflows/model";
export const bookingWorkflowNoticeIntents = pgTable(
  "booking_workflow_notice_intents",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => bookingLifecycleEvents.id, { onDelete: "restrict" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: text("kind").$type<WorkflowEvent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.recipientUserId, t.kind] }),
    check(
      "booking_workflow_notice_intents_kind_check",
      sql`${t.kind} IN ('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled')`,
    ),
  ],
);
