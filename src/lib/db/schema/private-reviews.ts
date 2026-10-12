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
import { bookings } from "./bookings";
export const reviewStates = [
  "pending",
  "locally_approved",
  "locally_rejected",
] as const;
export type ReviewState = (typeof reviewStates)[number];
const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
export const privateBookingReviews = pgTable(
  "private_booking_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    logicalBookingId: uuid("logical_booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    source: text("source")
      .$type<"local_synthetic">()
      .default("local_synthetic")
      .notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").default("").notNull(),
    state: text("state").$type<ReviewState>().default("pending").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    unique("private_booking_reviews_logical_unique").on(t.logicalBookingId),
    unique("private_booking_reviews_author_request_unique").on(
      t.authorUserId,
      t.requestId,
    ),
    check("private_booking_reviews_source", sql`${t.source}='local_synthetic'`),
    check("private_booking_reviews_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check(
      "private_booking_reviews_comment",
      sql`char_length(${t.comment})<=1000 AND ${t.comment}=btrim(${t.comment})`,
    ),
    check(
      "private_booking_reviews_state",
      sql`${t.state} IN ('pending','locally_approved','locally_rejected')`,
    ),
    check("private_booking_reviews_revision", sql`${t.revision}>=0`),
  ],
);
export const reviewModerators = pgTable(
  "review_moderators",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    source: text("source")
      .$type<"local_fixture">()
      .default("local_fixture")
      .notNull(),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
  },
  (t) => [
    check("review_moderators_source", sql`${t.source}='local_fixture'`),
    check(
      "review_moderators_status",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const reviewModeratorGrants = pgTable(
  "review_moderator_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => privateBookingReviews.id, { onDelete: "restrict" }),
    moderatorUserId: text("moderator_user_id")
      .notNull()
      .references(() => reviewModerators.userId, { onDelete: "restrict" }),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
  },
  (t) => [
    unique("review_moderator_grants_scope_unique").on(
      t.reviewId,
      t.moderatorUserId,
    ),
    index("review_moderator_grants_user_idx").on(t.moderatorUserId),
    check(
      "review_moderator_grants_status",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const reviewProvisioningEvents = pgTable(
  "review_provisioning_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moderatorUserId: text("moderator_user_id")
      .notNull()
      .references(() => reviewModerators.userId, { onDelete: "restrict" }),
    reviewId: uuid("review_id").references(() => privateBookingReviews.id, {
      onDelete: "restrict",
    }),
    status: text("status").$type<"authorized" | "revoked">().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    check(
      "review_provisioning_events_status",
      sql`${t.status} IN ('authorized','revoked')`,
    ),
  ],
);
export const privateReviewEvents = pgTable(
  "private_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => privateBookingReviews.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    previousState: text("previous_state").$type<ReviewState>(),
    nextState: text("next_state").$type<ReviewState>().notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    unique("private_review_events_revision_unique").on(t.reviewId, t.revision),
    unique("private_review_events_actor_request_unique").on(
      t.actorUserId,
      t.requestId,
    ),
    check(
      "private_review_events_shape",
      sql`((${t.revision}=0 AND ${t.previousState} IS NULL AND ${t.nextState}='pending') OR (${t.revision}>0 AND ((${t.previousState}='pending' AND ${t.nextState} IN ('locally_approved','locally_rejected')) OR (${t.previousState} IN ('locally_approved','locally_rejected') AND ${t.nextState}='pending')))) IS TRUE`,
    ),
  ],
);
