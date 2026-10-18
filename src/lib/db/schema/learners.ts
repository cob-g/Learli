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
import type { LearnerLevel } from "./app";

// Trusted fixtures and narrow local synthetic creation only; no real onboarding policy.
export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fixtureKey: text("fixture_key").notNull().unique(),
    source: text("source")
      .$type<"local_fixture" | "synthetic_readiness" | "local_operation">()
      .notNull(),
    management: text("management").$type<"guardian" | "self">().notNull(),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    level: text("level").$type<LearnerLevel>().notNull(),
    grade: integer("grade"),
    timezone: text("timezone").notNull(),
    status: text("status")
      .$type<"active" | "inactive">()
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("learner_profiles_id_management_unique").on(
      table.id,
      table.management,
    ),
    unique("learner_profiles_id_management_source_unique").on(
      table.id,
      table.management,
      table.source,
    ),
    check(
      "learner_profiles_source",
      sql`${table.source} IN ('local_fixture', 'synthetic_readiness', 'local_operation')`,
    ),
    check(
      "learner_profiles_management",
      sql`(${table.management} = 'guardian' AND ${table.userId} IS NULL) OR (${table.management} = 'self' AND ${table.userId} IS NOT NULL AND ${table.level} = 'college_support')`,
    ),
    check(
      "learner_profiles_status",
      sql`${table.status} IN ('active', 'inactive')`,
    ),
    check(
      "learner_profiles_name",
      sql`char_length(btrim(${table.displayName})) BETWEEN 1 AND 80 AND ${table.displayName} = btrim(${table.displayName})`,
    ),
    check(
      "learner_profiles_level",
      sql`${table.level} IN ('elementary', 'middle_school', 'high_school', 'college_support')`,
    ),
    check(
      "learner_profiles_grade",
      sql`${table.grade} IS NULL OR (${table.grade} BETWEEN 1 AND 12 AND ${table.management} = 'guardian' AND ${table.level} <> 'college_support')`,
    ),
    check(
      "learner_profiles_timezone",
      sql`char_length(${table.timezone}) BETWEEN 1 AND 100 AND (${table.timezone} = 'UTC' OR ${table.timezone} ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$')`,
    ),
  ],
);

export const guardianLearnerLinks = pgTable(
  "guardian_learner_links",
  {
    guardianUserId: text("guardian_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id").notNull(),
    management: text("management")
      .$type<"guardian">()
      .default("guardian")
      .notNull(),
    source: text("source")
      .$type<"local_fixture" | "synthetic_readiness" | "local_operation">()
      .notNull(),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.guardianUserId, table.learnerId] }),
    index("guardian_learner_links_learner_idx").on(table.learnerId),
    foreignKey({
      columns: [table.learnerId, table.management],
      foreignColumns: [learnerProfiles.id, learnerProfiles.management],
    }).onDelete("restrict"),
    foreignKey({
      name: "guardian_learner_links_source_fk",
      columns: [table.learnerId, table.management, table.source],
      foreignColumns: [
        learnerProfiles.id,
        learnerProfiles.management,
        learnerProfiles.source,
      ],
    }).onDelete("restrict"),
    check(
      "guardian_learner_links_management",
      sql`${table.management} = 'guardian'`,
    ),
    check(
      "guardian_learner_links_source",
      sql`${table.source} IN ('local_fixture', 'synthetic_readiness', 'local_operation')`,
    ),
    check(
      "guardian_learner_links_status",
      sql`${table.status} IN ('authorized', 'revoked')`,
    ),
  ],
);
