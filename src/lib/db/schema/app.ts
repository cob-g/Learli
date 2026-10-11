import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roles = ["student", "parent", "tutor", "admin"] as const;
export type Role = (typeof roles)[number];

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    check(
      "user_roles_allowed",
      sql`${table.role} IN ('student', 'parent', 'tutor', 'admin')`,
    ),
  ],
);

export const userAccess = pgTable(
  "user_access",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"active" | "suspended">()
      .default("active")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "user_access_status",
      sql`${table.status} IN ('active', 'suspended')`,
    ),
  ],
);

export const subjectCategories = [
  "academic_core",
  "test_prep",
  "academic_support",
  "specialized",
] as const;
export type SubjectCategory = (typeof subjectCategories)[number];

export const learnerLevels = [
  "elementary",
  "middle_school",
  "high_school",
  "college_support",
] as const;
export type LearnerLevel = (typeof learnerLevels)[number];

export const reviewStatuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").$type<SubjectCategory>().notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("subjects_name_unique").on(sql`lower(${table.name})`),
    check(
      "subjects_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "subjects_name_length",
      sql`char_length(${table.name}) BETWEEN 2 AND 60`,
    ),
    check(
      "subjects_category_allowed",
      sql`${table.category} IN ('academic_core', 'test_prep', 'academic_support', 'specialized')`,
    ),
  ],
);

export const tutorProfiles = pgTable(
  "tutor_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Restrict: a tutor's record must outlive any accidental account deletion.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    // Public address of the profile. Set once; never an account identifier.
    slug: text("slug").notNull().unique(),
    headline: text("headline").notNull(),
    bio: text("bio").notNull(),
    teachingBackground: text("teaching_background").notNull(),
    timezone: text("timezone").notNull(),
    availabilityVersion: integer("availability_version").default(0).notNull(),
    reviewStatus: text("review_status")
      .$type<ReviewStatus>()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "tutor_availability_version_valid",
      sql`${table.availabilityVersion} >= 0`,
    ),
    index("tutor_profiles_review_status_idx").on(table.reviewStatus),
    check(
      "tutor_profiles_review_status_allowed",
      sql`${table.reviewStatus} IN ('pending', 'approved', 'rejected', 'suspended')`,
    ),
    check(
      "tutor_profiles_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "tutor_profiles_headline_length",
      sql`char_length(${table.headline}) BETWEEN 1 AND 100`,
    ),
    check(
      "tutor_profiles_bio_length",
      sql`char_length(${table.bio}) BETWEEN 1 AND 1500`,
    ),
    check(
      "tutor_profiles_background_length",
      sql`char_length(${table.teachingBackground}) BETWEEN 1 AND 1000`,
    ),
  ],
);

/** Weekly wall-clock windows use the owner's tutor_profiles.timezone. */
export const tutorAvailability = pgTable(
  "tutor_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    isoWeekday: integer("iso_weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (table) => [
    uniqueIndex("tutor_availability_window_unique").on(
      table.tutorId,
      table.isoWeekday,
      table.startMinute,
      table.endMinute,
    ),
    check(
      "tutor_availability_weekday_valid",
      sql`${table.isoWeekday} BETWEEN 1 AND 7`,
    ),
    check(
      "tutor_availability_minutes_valid",
      sql`${table.startMinute} BETWEEN 0 AND 1439 AND ${table.endMinute} > ${table.startMinute} AND ${table.endMinute} <= ${table.startMinute} + 1440`,
    ),
  ],
);

export const tutorSubjects = pgTable(
  "tutor_subjects",
  {
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    // Restrict: deactivate a subject instead of deleting one a tutor offers.
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    levels: text("levels").array().$type<LearnerLevel[]>().notNull(),
    specialty: text("specialty"),
  },
  (table) => [
    primaryKey({ columns: [table.tutorId, table.subjectId] }),
    index("tutor_subjects_subject_idx").on(table.subjectId),
    check(
      "tutor_subjects_levels_allowed",
      sql`cardinality(${table.levels}) BETWEEN 1 AND 4 AND ${table.levels} <@ ARRAY['elementary', 'middle_school', 'high_school', 'college_support']::text[]`,
    ),
    check(
      "tutor_subjects_specialty_length",
      sql`${table.specialty} IS NULL OR char_length(${table.specialty}) BETWEEN 1 AND 120`,
    ),
  ],
);

export const auditActions = [
  "account.created",
  "account.updated",
  "fixture.roles_granted",
  "tutor_role.self_granted",
  "tutor_profile.submitted",
  "tutor_profile.updated",
  "tutor_availability.updated",
  "tutor_time_off.updated",
  "tutor_review.approved",
  "tutor_review.rejected",
  "tutor_review.suspended",
  "tutor_review.reinstated",
  "tutor_review.reopened",
  "subject.created",
  "subject.activated",
  "subject.deactivated",
] as const;
export type AuditAction = (typeof auditActions)[number];

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetSubjectId: uuid("target_subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    action: text("action").$type<AuditAction>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "audit_action_allowed",
      sql`${table.action} IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated')`,
    ),
  ],
);
