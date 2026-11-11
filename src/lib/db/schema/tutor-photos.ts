import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tutorProfiles } from "./app";
import { user } from "./auth";

export const tutorPhotoStatuses = [
  "pending",
  "approved",
  "rejected",
  "replaced",
  "removed",
] as const;
export type TutorPhotoStatus = (typeof tutorPhotoStatuses)[number];

/**
 * A tutor's profile photo and its review (owner decision D-15, 2026-11-11).
 * Only the stored object's key lives here, never the image. A photo is public
 * only while approved; each tutor has at most one pending and one approved.
 */
export const tutorPhotos = pgTable(
  "tutor_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    byteSize: integer("byte_size").notNull(),
    status: text("status")
      .$type<TutorPhotoStatus>()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("tutor_photos_tutor_idx").on(table.tutorId, table.createdAt),
    uniqueIndex("tutor_photos_one_pending")
      .on(table.tutorId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("tutor_photos_one_approved")
      .on(table.tutorId)
      .where(sql`${table.status} = 'approved'`),
    check(
      "tutor_photos_status_allowed",
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'replaced', 'removed')`,
    ),
    check(
      "tutor_photos_object_key_format",
      sql`${table.objectKey} ~ '^tutor-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$'`,
    ),
    check(
      "tutor_photos_byte_size_valid",
      sql`${table.byteSize} BETWEEN 1 AND 1048576`,
    ),
    check(
      "tutor_photos_review_recorded",
      sql`(${table.status} <> 'pending' OR ${table.reviewedAt} IS NULL) AND (${table.status} NOT IN ('approved', 'rejected') OR ${table.reviewedAt} IS NOT NULL)`,
    ),
  ],
);
