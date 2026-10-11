import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const supportStatuses = ["open", "in_review", "closed"] as const;
export type SupportStatus = (typeof supportStatuses)[number];
export const supportCategories = ["general", "account", "safety"] as const;
export type SupportCategory = (typeof supportCategories)[number];
const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();

export const supportReviewers = pgTable(
  "support_reviewers",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    source: text("source").$type<"local_fixture">().notNull(),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    check("support_reviewers_source", sql`${t.source} = 'local_fixture'`),
    check(
      "support_reviewers_status",
      sql`${t.status} IN ('authorized', 'revoked')`,
    ),
  ],
);

// Trusted tooling records capability changes independently of case history.
export const supportReviewerEvents = pgTable(
  "support_reviewer_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => supportReviewers.userId, { onDelete: "restrict" }),
    action: text("action").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    check(
      "support_reviewer_events_action",
      sql`${t.action} IN ('authorized', 'revoked')`,
    ),
  ],
);

export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestKey: uuid("request_key").notNull(),
    source: text("source")
      .$type<"local_synthetic">()
      .default("local_synthetic")
      .notNull(),
    category: text("category").$type<SupportCategory>().notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<SupportStatus>().default("open").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    unique("support_cases_request_unique").on(t.requesterUserId, t.requestKey),
    index("support_cases_requester_created_idx").on(
      t.requesterUserId,
      t.createdAt,
      t.id,
    ),
    check("support_cases_source", sql`${t.source} = 'local_synthetic'`),
    check(
      "support_cases_category",
      sql`${t.category} IN ('general', 'account', 'safety')`,
    ),
    check(
      "support_cases_status",
      sql`${t.status} IN ('open', 'in_review', 'closed')`,
    ),
    check("support_cases_revision", sql`${t.revision} >= 0`),
    check(
      "support_cases_subject",
      sql`char_length(${t.subject}) BETWEEN 1 AND 120 AND ${t.subject} = btrim(${t.subject})`,
    ),
    check(
      "support_cases_body",
      sql`char_length(${t.body}) BETWEEN 1 AND 2000 AND ${t.body} = btrim(${t.body})`,
    ),
  ],
);

export const supportCaseAssignments = pgTable(
  "support_case_assignments",
  {
    caseId: uuid("case_id")
      .primaryKey()
      .references(() => supportCases.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => supportReviewers.userId, { onDelete: "restrict" }),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    index("support_case_assignments_reviewer_idx").on(
      t.reviewerUserId,
      t.caseId,
    ),
  ],
);

export const supportCaseEvents = pgTable(
  "support_case_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => supportCases.id, { onDelete: "restrict" }),
    action: text("action")
      .$type<"created" | "assigned" | "reassigned" | "status_changed">()
      .notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    previousStatus: text("previous_status").$type<SupportStatus>(),
    nextStatus: text("next_status").$type<SupportStatus>(),
    previousReviewerId: text("previous_reviewer_id").references(
      () => supportReviewers.userId,
      { onDelete: "restrict" },
    ),
    nextReviewerId: text("next_reviewer_id").references(
      () => supportReviewers.userId,
      { onDelete: "restrict" },
    ),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    unique("support_case_events_revision_unique").on(t.caseId, t.revision),
    check("support_case_events_revision", sql`${t.revision} >= 0`),
    check(
      "support_case_events_shape",
      sql`(
    (${t.action} = 'created' AND ${t.revision} = 0 AND ${t.actorUserId} IS NOT NULL AND ${t.previousStatus} IS NULL AND ${t.nextStatus} = 'open' AND ${t.previousReviewerId} IS NULL AND ${t.nextReviewerId} IS NULL)
    OR (${t.action} IN ('assigned','reassigned') AND ${t.revision} > 0 AND ${t.actorUserId} IS NULL AND ${t.previousStatus} IS NULL AND ${t.nextStatus} IS NULL AND ${t.nextReviewerId} IS NOT NULL AND ((${t.action} = 'assigned' AND ${t.previousReviewerId} IS NULL) OR (${t.action} = 'reassigned' AND ${t.previousReviewerId} IS NOT NULL AND ${t.previousReviewerId} <> ${t.nextReviewerId})))
    OR (${t.action} = 'status_changed' AND ${t.revision} > 0 AND ${t.actorUserId} IS NOT NULL AND ${t.previousReviewerId} IS NULL AND ${t.nextReviewerId} IS NULL AND ((${t.previousStatus} = 'open' AND ${t.nextStatus} = 'in_review') OR (${t.previousStatus} = 'in_review' AND ${t.nextStatus} = 'closed') OR (${t.previousStatus} = 'closed' AND ${t.nextStatus} = 'in_review')))
  ) IS TRUE`,
    ),
  ],
);
