import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { supportCases, supportReviewers } from "./support";
const instant = (n: string) => timestamp(n, { withTimezone: true });
export const supportResponsePolicies = pgTable(
  "support_response_policies",
  {
    provenance: text("provenance").$type<"synthetic_readiness">().notNull(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    validFrom: instant("valid_from").notNull(),
    validUntil: instant("valid_until").notNull(),
    responsibleOwnerId: text("responsible_owner_id")
      .notNull()
      .references(() => supportReviewers.userId, { onDelete: "restrict" }),
    escalationOwnerId: text("escalation_owner_id")
      .notNull()
      .references(() => supportReviewers.userId, { onDelete: "restrict" }),
    reportingGuidanceReference: text("reporting_guidance_reference").notNull(),
    meetingGuidanceReference: text("meeting_guidance_reference").notNull(),
    allowedActions: text("allowed_actions").array().notNull(),
    reasonCodes: text("reason_codes").array().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.provenance, t.version] }),
    check("response_policy_source", sql`${t.provenance}='synthetic_readiness'`),
    check(
      "response_policy_window",
      sql`isfinite(${t.validFrom}) AND isfinite(${t.validUntil}) AND ${t.validUntil}>${t.validFrom} AND ${t.responsibleOwnerId}<>${t.escalationOwnerId}`,
    ),
    check(
      "response_policy_actions",
      sql`cardinality(${t.allowedActions}) BETWEEN 1 AND 10 AND ${t.allowedActions} <@ ARRAY['intake','assign','reassign','acknowledge','request_escalation','escalate','close','reopen','restrict','restore']::text[] AND ${t.reasonCodes} <@ ARRAY['synthetic_safety_restrict','synthetic_safety_restore']::text[]`,
    ),
  ],
);
export const supportResponsePolicyHeads = pgTable(
  "support_response_policy_heads",
  {
    provenance: text("provenance").$type<"synthetic_readiness">().primaryKey(),
    version: text("version").notNull(),
    status: text("status").$type<"enabled" | "revoked">().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.provenance, t.version],
      foreignColumns: [
        supportResponsePolicies.provenance,
        supportResponsePolicies.version,
      ],
    }).onDelete("restrict"),
    check("response_head_status", sql`${t.status} IN ('enabled','revoked')`),
  ],
);
export const supportCaseResponses = pgTable(
  "support_case_responses",
  {
    caseId: uuid("case_id")
      .primaryKey()
      .references(() => supportCases.id, { onDelete: "restrict" }),
    provenance: text("provenance").$type<"synthetic_readiness">().notNull(),
    policyVersion: text("policy_version").notNull(),
    assignmentRevision: integer("assignment_revision"),
    acknowledgedAssignmentRevision: integer("acknowledged_assignment_revision"),
    acknowledgedBy: text("acknowledged_by").references(
      () => supportReviewers.userId,
      { onDelete: "restrict" },
    ),
    acknowledgedAt: instant("acknowledged_at"),
    escalationRequestedAt: instant("escalation_requested_at"),
    escalationTargetUserId: text("escalation_target_user_id").references(
      () => supportReviewers.userId,
      { onDelete: "restrict" },
    ),
    responseCycle: integer("response_cycle").default(1).notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.provenance, t.policyVersion],
      foreignColumns: [
        supportResponsePolicies.provenance,
        supportResponsePolicies.version,
      ],
    }).onDelete("restrict"),
    check(
      "response_state_shape",
      sql`(${t.provenance}='synthetic_readiness' AND ${t.responseCycle}>=1 AND (${t.assignmentRevision} IS NULL OR ${t.assignmentRevision}>0) AND ((${t.acknowledgedAt} IS NULL AND ${t.acknowledgedBy} IS NULL AND ${t.acknowledgedAssignmentRevision} IS NULL) OR (${t.acknowledgedAt} IS NOT NULL AND isfinite(${t.acknowledgedAt}) AND ${t.acknowledgedBy} IS NOT NULL AND ${t.acknowledgedAssignmentRevision}=${t.assignmentRevision})) AND ((${t.escalationRequestedAt} IS NULL AND ${t.escalationTargetUserId} IS NULL) OR (isfinite(${t.escalationRequestedAt}) AND ${t.escalationTargetUserId} IS NOT NULL AND ${t.acknowledgedAt} IS NOT NULL))) IS TRUE`,
    ),
  ],
);
export const supportResponseEvents = pgTable(
  "support_response_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => supportCases.id, { onDelete: "restrict" }),
    action: text("action")
      .$type<
        | "intake"
        | "acknowledge"
        | "request_escalation"
        | "assign"
        | "reassign"
        | "escalate"
        | "close"
        | "reopen"
      >()
      .notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestKey: uuid("request_key").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    revision: integer("revision").notNull(),
    provenance: text("provenance").$type<"synthetic_readiness">().notNull(),
    policyVersion: text("policy_version").notNull(),
    responseCycle: integer("response_cycle").notNull(),
    assignmentRevision: integer("assignment_revision"),
    targetUserId: text("target_user_id").references(
      () => supportReviewers.userId,
      { onDelete: "restrict" },
    ),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("response_event_request").on(t.actorUserId, t.requestKey),
    unique("response_event_revision").on(t.caseId, t.revision),
    foreignKey({
      columns: [t.provenance, t.policyVersion],
      foreignColumns: [
        supportResponsePolicies.provenance,
        supportResponsePolicies.version,
      ],
    }).onDelete("restrict"),
    check(
      "response_event_shape",
      sql`${t.provenance}='synthetic_readiness' AND ${t.responseCycle}>=1 AND ((${t.action}='intake' AND ${t.expectedRevision}=0 AND ${t.revision}=0) OR (${t.action} IN ('acknowledge','request_escalation','assign','reassign','escalate','close','reopen') AND ${t.expectedRevision}>=0 AND ${t.revision}=${t.expectedRevision}+1))`,
    ),
  ],
);
