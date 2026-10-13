import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  foreignKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { bookingWorkflowNoticeIntents } from "./booking-workflows";
import type { WorkflowEvent } from "@/features/booking-workflows/model";
import type { BookingMessageInput } from "@/lib/email/transactional-message";
import type { DeliveryFailure } from "@/features/transactional-delivery/state";

export type DeliveryState =
  | "pending"
  | "claimed"
  | "retryable"
  | "uncertain"
  | "provider_accepted"
  | "suppressed"
  | "blocked";
export const transactionalDeliveries = pgTable(
  "transactional_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    kind: text("kind").$type<WorkflowEvent>().notNull(),
    state: text("state").$type<DeliveryState>().default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    claimToken: uuid("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true }),
    payload: jsonb("payload").$type<BookingMessageInput>(),
    idempotencyKey: text("idempotency_key"),
    payloadFingerprint: text("payload_fingerprint"),
    configurationFingerprint: text("configuration_fingerprint"),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    providerId: uuid("provider_id"),
    failureCode: text("failure_code").$type<DeliveryFailure>(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    suppressedReason: text("suppressed_reason").$type<
      "outdated_or_unauthorized" | "material_changed"
    >(),
  },
  (t) => [
    unique("transactional_delivery_intent_unique").on(
      t.eventId,
      t.recipientUserId,
      t.kind,
    ),
    foreignKey({
      name: "transactional_delivery_intent_fk",
      columns: [t.eventId, t.recipientUserId, t.kind],
      foreignColumns: [
        bookingWorkflowNoticeIntents.eventId,
        bookingWorkflowNoticeIntents.recipientUserId,
        bookingWorkflowNoticeIntents.kind,
      ],
    }).onDelete("restrict"),
    index("transactional_delivery_pending_idx").on(
      t.state,
      t.nextAttemptAt,
      t.createdAt,
      t.id,
    ),
    check(
      "transactional_delivery_state_check",
      sql`${t.state} IN ('pending','claimed','retryable','uncertain','provider_accepted','suppressed','blocked')`,
    ),
    check(
      "transactional_delivery_finite_times",
      sql`isfinite(${t.createdAt}) AND (${t.claimUntil} IS NULL OR isfinite(${t.claimUntil})) AND (${t.firstAttemptAt} IS NULL OR isfinite(${t.firstAttemptAt})) AND (${t.lastAttemptAt} IS NULL OR isfinite(${t.lastAttemptAt})) AND (${t.nextAttemptAt} IS NULL OR isfinite(${t.nextAttemptAt})) AND (${t.closedAt} IS NULL OR isfinite(${t.closedAt}))`,
    ),
    check(
      "transactional_delivery_claim_shape",
      sql`((${t.state}='claimed' AND ${t.claimToken} IS NOT NULL AND ${t.claimUntil} IS NOT NULL) OR (${t.state}<>'claimed' AND ${t.claimToken} IS NULL AND ${t.claimUntil} IS NULL)) IS TRUE`,
    ),
    check(
      "transactional_delivery_prepared_shape",
      sql`(( ${t.payload} IS NULL AND ${t.idempotencyKey} IS NULL AND ${t.payloadFingerprint} IS NULL AND ${t.configurationFingerprint} IS NULL AND ${t.firstAttemptAt} IS NULL AND ${t.lastAttemptAt} IS NULL AND ${t.attempts}=0) OR (${t.payload} IS NOT NULL AND jsonb_typeof(${t.payload})='object' AND ${t.idempotencyKey} ~ '^learli/[a-f0-9]{64}$' AND ${t.payloadFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.configurationFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.firstAttemptAt} IS NOT NULL AND ${t.lastAttemptAt}>=${t.firstAttemptAt} AND ${t.attempts} BETWEEN 1 AND 8)) IS TRUE`,
    ),
    check(
      "transactional_delivery_outcome_shape",
      sql`(( ${t.state} IN ('pending','claimed') AND ${t.providerId} IS NULL AND ${t.closedAt} IS NULL AND ${t.nextAttemptAt} IS NULL AND ${t.failureCode} IS NULL AND ${t.suppressedReason} IS NULL) OR (${t.state} IN ('retryable','uncertain') AND ${t.payload} IS NOT NULL AND ${t.providerId} IS NULL AND ${t.closedAt} IS NULL AND ${t.nextAttemptAt} IS NOT NULL AND ${t.failureCode} IN ('rate_limited','unavailable','timeout') AND ${t.suppressedReason} IS NULL) OR (${t.state}='provider_accepted' AND ${t.payload} IS NOT NULL AND ${t.providerId} IS NOT NULL AND ${t.closedAt} IS NOT NULL AND ${t.nextAttemptAt} IS NULL AND ${t.failureCode} IS NULL AND ${t.suppressedReason} IS NULL) OR (${t.state}='blocked' AND ${t.providerId} IS NULL AND ${t.closedAt} IS NOT NULL AND ${t.nextAttemptAt} IS NULL AND ${t.failureCode} IN ('retention_elapsed','attempt_limit','configuration','recipient','payload') AND ${t.suppressedReason} IS NULL) OR (${t.state}='suppressed' AND ${t.providerId} IS NULL AND ${t.closedAt} IS NOT NULL AND ${t.nextAttemptAt} IS NULL AND ${t.failureCode} IS NULL AND ${t.suppressedReason} IN ('outdated_or_unauthorized','material_changed'))) IS TRUE`,
    ),
  ],
);
