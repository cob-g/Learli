import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { supportCases, supportCaseEvents, supportReviewers } from "./support";
const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
const grantFields = () => ({
  caseId: uuid("case_id").notNull(),
  source: text("source").$type<"local_fixture">().notNull(),
  status: text("status").$type<"authorized" | "revoked">().notNull(),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
});
export const supportDispatchGrants = pgTable(
  "support_dispatch_grants",
  {
    ...grantFields(),
    dispatcherUserId: text("dispatcher_user_id").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.dispatcherUserId, t.caseId],
      name: "support_dispatch_grants_pkey",
    }),
    foreignKey({
      columns: [t.caseId],
      foreignColumns: [supportCases.id],
      name: "support_dispatch_grants_case_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.dispatcherUserId],
      foreignColumns: [user.id],
      name: "support_dispatch_grants_dispatcher_user_id_fkey",
    }).onDelete("restrict"),
    check(
      "support_dispatch_grants_source_check",
      sql`${t.source} = 'local_fixture'`,
    ),
    check(
      "support_dispatch_grants_status_check",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const supportReviewerChoices = pgTable(
  "support_reviewer_choices",
  {
    ...grantFields(),
    reviewerUserId: text("reviewer_user_id").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.caseId, t.reviewerUserId],
      name: "support_reviewer_choices_pkey",
    }),
    foreignKey({
      columns: [t.caseId],
      foreignColumns: [supportCases.id],
      name: "support_reviewer_choices_case_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.reviewerUserId],
      foreignColumns: [supportReviewers.userId],
      name: "support_reviewer_choices_reviewer_user_id_fkey",
    }).onDelete("restrict"),
    check(
      "support_reviewer_choices_source_check",
      sql`${t.source} = 'local_fixture'`,
    ),
    check(
      "support_reviewer_choices_status_check",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const supportDispatchGrantEvents = pgTable(
  "support_dispatch_grant_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<"dispatcher" | "reviewer_choice">().notNull(),
    action: text("action").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.caseId],
      foreignColumns: [supportCases.id],
      name: "support_dispatch_grant_events_case_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.userId],
      foreignColumns: [user.id],
      name: "support_dispatch_grant_events_user_id_fkey",
    }).onDelete("restrict"),
    check(
      "support_dispatch_grant_events_kind_check",
      sql`${t.kind} IN ('dispatcher','reviewer_choice')`,
    ),
    check(
      "support_dispatch_grant_events_action_check",
      sql`${t.action} IN ('authorized','revoked')`,
    ),
  ],
);
export const supportAssignmentEvents = pgTable(
  "support_assignment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    requestKey: uuid("request_key").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    revision: integer("revision").notNull(),
    kind: text("kind").$type<"assign" | "reassign" | "escalate">().notNull(),
    previousReviewerId: text("previous_reviewer_id"),
    nextReviewerId: text("next_reviewer_id").notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.caseId],
      foreignColumns: [supportCases.id],
      name: "support_assignment_events_case_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.actorUserId],
      foreignColumns: [user.id],
      name: "support_assignment_events_actor_user_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.previousReviewerId],
      foreignColumns: [supportReviewers.userId],
      name: "support_assignment_events_previous_reviewer_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.nextReviewerId],
      foreignColumns: [supportReviewers.userId],
      name: "support_assignment_events_next_reviewer_id_fkey",
    }).onDelete("restrict"),
    unique("support_assignment_events_request").on(t.actorUserId, t.requestKey),
    unique("support_assignment_events_revision").on(t.caseId, t.revision),
    index("support_assignment_events_case_idx").on(t.caseId, t.revision),
    foreignKey({
      columns: [t.caseId, t.revision],
      foreignColumns: [supportCaseEvents.caseId, supportCaseEvents.revision],
      name: "support_assignment_events_history_fk",
    }).onDelete("restrict"),
    check(
      "support_assignment_events_revision_valid",
      sql`${t.expectedRevision} >= 0 AND ${t.revision} = ${t.expectedRevision} + 1`,
    ),
    check(
      "support_assignment_events_shape",
      sql`(${t.actorUserId} <> ${t.nextReviewerId} AND ((${t.kind} = 'assign' AND ${t.previousReviewerId} IS NULL) OR (${t.kind} IN ('reassign','escalate') AND ${t.previousReviewerId} IS NOT NULL AND ${t.previousReviewerId} <> ${t.nextReviewerId}))) IS TRUE`,
    ),
  ],
);
