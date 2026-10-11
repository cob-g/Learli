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

const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
export const accountRestrictionTargets = pgTable(
  "account_restriction_targets",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    source: text("source").$type<"local_fixture">().notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    check(
      "account_restriction_targets_source",
      sql`${t.source} = 'local_fixture'`,
    ),
    check("account_restriction_targets_revision", sql`${t.revision} >= 0`),
  ],
);
export const accountRestrictionGrants = pgTable(
  "account_restriction_grants",
  {
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => accountRestrictionTargets.userId, {
        onDelete: "restrict",
      }),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.staffUserId, t.targetUserId] }),
    check(
      "account_restriction_grants_not_self",
      sql`${t.staffUserId} <> ${t.targetUserId}`,
    ),
    check(
      "account_restriction_grants_status",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const accountRestrictionGrantEvents = pgTable(
  "account_restriction_grant_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffUserId: text("staff_user_id").notNull(),
    targetUserId: text("target_user_id").notNull(),
    action: text("action").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.staffUserId, t.targetUserId],
      foreignColumns: [
        accountRestrictionGrants.staffUserId,
        accountRestrictionGrants.targetUserId,
      ],
    }).onDelete("restrict"),
    check(
      "account_restriction_grant_events_action",
      sql`${t.action} IN ('authorized','revoked')`,
    ),
  ],
);
export const accountRestrictionEvents = pgTable(
  "account_restriction_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => accountRestrictionTargets.userId, {
        onDelete: "restrict",
      }),
    requestKey: uuid("request_key").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    revision: integer("revision").notNull(),
    previousStatus: text("previous_status")
      .$type<"active" | "suspended">()
      .notNull(),
    nextStatus: text("next_status").$type<"active" | "suspended">().notNull(),
    reason: text("reason")
      .$type<"local_access_test" | "local_review_test" | "local_restore_test">()
      .notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    unique("account_restriction_events_request").on(
      t.actorUserId,
      t.requestKey,
    ),
    unique("account_restriction_events_revision").on(
      t.targetUserId,
      t.revision,
    ),
    index("account_restriction_events_target_idx").on(
      t.targetUserId,
      t.revision,
    ),
    check(
      "account_restriction_events_revision_valid",
      sql`${t.expectedRevision} >= 0 AND ${t.revision} = ${t.expectedRevision} + 1`,
    ),
    check(
      "account_restriction_events_not_self",
      sql`${t.actorUserId} <> ${t.targetUserId}`,
    ),
    check(
      "account_restriction_events_shape",
      sql`((${t.previousStatus} = 'active' AND ${t.nextStatus} = 'suspended' AND ${t.reason} IN ('local_access_test','local_review_test')) OR (${t.previousStatus} = 'suspended' AND ${t.nextStatus} = 'active' AND ${t.reason} = 'local_restore_test')) IS TRUE`,
    ),
  ],
);
