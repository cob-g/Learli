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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tutorProfiles } from "./app";
const instant = (n: string) => timestamp(n, { withTimezone: true });
const source = () =>
  text("provenance").$type<"synthetic_readiness">().notNull();
const policyReceipt = () => ({
  provenance: source(),
  policyVersion: text("policy_version").notNull(),
});
export const tutorScreeningPolicies = pgTable(
  "tutor_screening_policies",
  {
    provenance: source(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    authorityReference: text("authority_reference").notNull(),
    requiredCheckCodes: text("required_check_codes").array().notNull(),
    allowedActions: text("allowed_actions").array().notNull(),
    expiryRule: text("expiry_rule").notNull(),
    validFrom: instant("valid_from").notNull(),
    validUntil: instant("valid_until").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.provenance, t.version] }),
    check(
      "screening_policy_source",
      sql`${t.provenance}='synthetic_readiness'`,
    ),
    check(
      "screening_policy_window",
      sql`isfinite(${t.validFrom}) AND isfinite(${t.validUntil}) AND ${t.validUntil}>${t.validFrom}`,
    ),
    check(
      "screening_policy_codes",
      sql`cardinality(${t.requiredCheckCodes}) BETWEEN 1 AND 20 AND array_position(${t.requiredCheckCodes},NULL) IS NULL`,
    ),
    check(
      "screening_policy_actions",
      sql`cardinality(${t.allowedActions}) BETWEEN 1 AND 6 AND ${t.allowedActions} <@ ARRAY['approve','reject','suspend','reinstate','reopen','revoke']::text[] AND ${t.expiryRule}='all_checks_current'`,
    ),
  ],
);
export const tutorScreeningPolicyHeads = pgTable(
  "tutor_screening_policy_heads",
  {
    provenance: source().primaryKey(),
    version: text("version").notNull(),
    status: text("status").$type<"enabled" | "revoked">().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.provenance, t.version],
      foreignColumns: [
        tutorScreeningPolicies.provenance,
        tutorScreeningPolicies.version,
      ],
    }).onDelete("restrict"),
    check("screening_head_status", sql`${t.status} IN ('enabled','revoked')`),
  ],
);
export const tutorScreeningCases = pgTable(
  "tutor_screening_cases",
  {
    tutorId: uuid("tutor_id")
      .primaryKey()
      .references(() => tutorProfiles.id, { onDelete: "restrict" }),
    ...policyReceipt(),
    round: integer("round").default(1).notNull(),
    revision: integer("revision").default(0).notNull(),
    state: text("state")
      .$type<"pending" | "approved" | "rejected" | "suspended" | "revoked">()
      .default("pending")
      .notNull(),
    currentDecisionId: uuid("current_decision_id").references(
      (): AnyPgColumn => tutorScreeningDecisions.id,
      { onDelete: "restrict" },
    ),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.provenance, t.policyVersion],
      foreignColumns: [
        tutorScreeningPolicies.provenance,
        tutorScreeningPolicies.version,
      ],
    }).onDelete("restrict"),
    check("screening_case_source", sql`${t.provenance}='synthetic_readiness'`),
    check("screening_case_revision", sql`${t.round}>=1 AND ${t.revision}>=0`),
    check(
      "screening_case_state",
      sql`${t.state} IN ('pending','approved','rejected','suspended','revoked')`,
    ),
  ],
);
export const tutorScreeningStaff = pgTable(
  "tutor_screening_staff",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    provenance: text("provenance")
      .$type<"local_fixture" | "synthetic_readiness">()
      .notNull(),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    capability: text("capability").default("screening_reviewer").notNull(),
    validUntil: instant("valid_until").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provenance] }),
    check(
      "screening_staff_source",
      sql`${t.provenance} IN ('local_fixture','synthetic_readiness')`,
    ),
    check(
      "screening_staff_status",
      sql`${t.status} IN ('authorized','revoked') AND ${t.capability}='screening_reviewer' AND isfinite(${t.validUntil})`,
    ),
  ],
);
export const tutorScreeningAssignments = pgTable(
  "tutor_screening_assignments",
  {
    tutorId: uuid("tutor_id")
      .primaryKey()
      .references(() => tutorProfiles.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id").notNull(),
    provenance: text("provenance")
      .$type<"local_fixture" | "synthetic_readiness">()
      .notNull(),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    assignmentRevision: integer("assignment_revision").default(0).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.reviewerUserId, t.provenance],
      foreignColumns: [
        tutorScreeningStaff.userId,
        tutorScreeningStaff.provenance,
      ],
    }).onDelete("restrict"),
    check(
      "screening_assignment_revision",
      sql`${t.assignmentRevision}>=0 AND ${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
const receipt = () => ({
  id: uuid("id").defaultRandom().primaryKey(),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => tutorScreeningCases.tutorId, { onDelete: "restrict" }),
  ...policyReceipt(),
  round: integer("round").notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  revision: integer("revision").notNull(),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  assignmentRevision: integer("assignment_revision").notNull(),
  requestKey: uuid("request_key").notNull(),
  createdAt: instant("created_at").defaultNow().notNull(),
});
export const tutorScreeningChecks = pgTable(
  "tutor_screening_checks",
  {
    ...receipt(),
    checkCode: text("check_code").notNull(),
    outcome: text("outcome").$type<"passed" | "failed" | "revoked">().notNull(),
    evidenceReference: text("evidence_reference").notNull(),
    checkedAt: instant("checked_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [
    unique("screening_check_revision").on(t.tutorId, t.revision),
    unique("screening_check_request").on(t.actorUserId, t.requestKey),
    foreignKey({
      columns: [t.provenance, t.policyVersion],
      foreignColumns: [
        tutorScreeningPolicies.provenance,
        tutorScreeningPolicies.version,
      ],
    }).onDelete("restrict"),
    check(
      "screening_check_shape",
      sql`${t.revision}=${t.expectedRevision}+1 AND ${t.expectedRevision}>=0 AND ${t.round}>0 AND ${t.assignmentRevision}>=0 AND ${t.outcome} IN ('passed','failed','revoked') AND ${t.checkCode} ~ '^[a-z][a-z0-9_]{0,47}$' AND ${t.evidenceReference} ~ '^screening:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND isfinite(${t.checkedAt}) AND isfinite(${t.expiresAt}) AND ${t.expiresAt}>${t.checkedAt}`,
    ),
  ],
);
export const tutorScreeningDecisions = pgTable(
  "tutor_screening_decisions",
  {
    ...receipt(),
    action: text("action")
      .$type<
        "approve" | "reject" | "suspend" | "reinstate" | "reopen" | "revoke"
      >()
      .notNull(),
  },
  (t) => [
    unique("screening_decision_revision").on(t.tutorId, t.revision),
    unique("screening_decision_request").on(t.actorUserId, t.requestKey),
    foreignKey({
      columns: [t.provenance, t.policyVersion],
      foreignColumns: [
        tutorScreeningPolicies.provenance,
        tutorScreeningPolicies.version,
      ],
    }).onDelete("restrict"),
    check(
      "screening_decision_shape",
      sql`${t.revision}=${t.expectedRevision}+1 AND ${t.expectedRevision}>=0 AND ${t.round}>0 AND ${t.assignmentRevision}>=0 AND ${t.action} IN ('approve','reject','suspend','reinstate','reopen','revoke')`,
    ),
  ],
);
export const tutorScreeningDecisionChecks = pgTable(
  "tutor_screening_decision_checks",
  {
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => tutorScreeningDecisions.id, { onDelete: "restrict" }),
    checkCode: text("check_code").notNull(),
    checkId: uuid("check_id")
      .notNull()
      .references(() => tutorScreeningChecks.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.decisionId, t.checkCode] })],
);
export const tutorScreeningEvents = pgTable(
  "tutor_screening_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "restrict" }),
    revision: integer("revision"),
    kind: text("kind")
      .$type<"request" | "check" | "decision" | "assignment" | "revocation">()
      .notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    requestKey: uuid("request_key"),
    checkId: uuid("check_id").references(() => tutorScreeningChecks.id, {
      onDelete: "restrict",
    }),
    decisionId: uuid("decision_id").references(
      () => tutorScreeningDecisions.id,
      { onDelete: "restrict" },
    ),
    assignmentRevision: integer("assignment_revision"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (t) => [
    check(
      "screening_event_shape",
      sql`((${t.kind}='check' AND ${t.checkId} IS NOT NULL AND ${t.decisionId} IS NULL AND ${t.revision}>0 AND ${t.actorUserId} IS NOT NULL AND ${t.requestKey} IS NOT NULL) OR (${t.kind}='decision' AND ${t.decisionId} IS NOT NULL AND ${t.checkId} IS NULL AND ${t.revision}>0 AND ${t.actorUserId} IS NOT NULL AND ${t.requestKey} IS NOT NULL) OR (${t.kind} IN ('request','assignment','revocation') AND ${t.checkId} IS NULL AND ${t.decisionId} IS NULL)) IS TRUE`,
    ),
  ],
);
