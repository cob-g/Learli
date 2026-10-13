import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
  check,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bookings, bookingLifecycleEvents } from "./bookings";
import type { EnabledPublicationPolicy } from "@/features/review-publication/policy";
import type { PublicationState } from "@/features/review-publication/input";
const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
export const reviewPublicationPolicies = pgTable(
  "review_publication_policies",
  {
    id: uuid("id").primaryKey(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    contentDigest: text("content_digest").notNull(),
    terms: jsonb("terms").$type<EnabledPublicationPolicy>().notNull(),
    createdAt: instant("created_at"),
  },
  (t) => [
    check(
      "review_publication_policy_shape",
      sql`${t.version}='synthetic-publication-v1' AND ${t.reference}='synthetic:publication:v1' AND ${t.contentDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
export const reviewPublicationPolicyHead = pgTable(
  "review_publication_policy_head",
  {
    source: text("source").primaryKey(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => reviewPublicationPolicies.id, { onDelete: "restrict" }),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [
    check(
      "review_publication_head_source",
      sql`${t.source}='synthetic_readiness'`,
    ),
  ],
);
export const publicationReviews = pgTable(
  "publication_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    logicalBookingId: uuid("logical_booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    completionEventId: uuid("completion_event_id")
      .notNull()
      .references(() => bookingLifecycleEvents.id, { onDelete: "restrict" }),
    bookingRevision: integer("booking_revision").notNull(),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => reviewPublicationPolicies.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    source: text("source")
      .$type<"synthetic_readiness">()
      .notNull()
      .default("synthetic_readiness"),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    state: text("state").$type<PublicationState>().notNull().default("pending"),
    revision: integer("revision").notNull().default(0),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    unique("publication_reviews_logical_unique").on(t.logicalBookingId),
    unique("publication_reviews_author_request_unique").on(
      t.authorUserId,
      t.requestId,
    ),
    check("publication_reviews_source", sql`${t.source}='synthetic_readiness'`),
    check("publication_reviews_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check(
      "publication_reviews_comment",
      sql`char_length(${t.comment})<=1000 AND ${t.comment}=btrim(${t.comment}) AND translate(${t.comment},E'\\n\\r\\t','') !~ '[[:cntrl:]]'`,
    ),
    check(
      "publication_reviews_state",
      sql`${t.state} IN ('pending','approved','rejected','published','withdrawn')`,
    ),
    check(
      "publication_reviews_revisions",
      sql`${t.revision}>=0 AND ${t.bookingRevision}>=0`,
    ),
  ],
);
export const publicationModeratorGrants = pgTable(
  "publication_moderator_grants",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => publicationReviews.id, { onDelete: "restrict" }),
    moderatorUserId: text("moderator_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => reviewPublicationPolicies.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(false),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    reference: text("reference").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.moderatorUserId] }),
    index("publication_moderator_user_idx").on(t.moderatorUserId),
    check(
      "publication_moderator_shape",
      sql`isfinite(${t.validUntil}) AND ${t.reference} ~ '^synthetic:[0-9a-f-]{36}$'`,
    ),
  ],
);
export const publicationReviewEvents = pgTable(
  "publication_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => publicationReviews.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => reviewPublicationPolicies.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    previousState: text("previous_state").$type<PublicationState>(),
    nextState: text("next_state").$type<PublicationState>().notNull(),
    revision: integer("revision").notNull(),
    privacyChecked: boolean("privacy_checked").notNull().default(false),
    createdAt: instant("created_at"),
  },
  (t) => [
    unique("publication_events_revision_unique").on(t.reviewId, t.revision),
    unique("publication_events_actor_request_unique").on(
      t.actorUserId,
      t.requestId,
    ),
    check(
      "publication_events_shape",
      sql`((${t.revision}=0 AND ${t.previousState} IS NULL AND ${t.nextState}='pending' AND NOT ${t.privacyChecked}) OR (${t.revision}>0 AND ((${t.previousState}='pending' AND ${t.nextState} IN ('approved','rejected')) OR (${t.previousState}='approved' AND ${t.nextState} IN ('published','pending')) OR (${t.previousState}='published' AND ${t.nextState}='withdrawn') OR (${t.previousState} IN ('rejected','withdrawn') AND ${t.nextState}='pending')) AND (${t.nextState} NOT IN ('approved','published') OR ${t.privacyChecked}))) IS TRUE`,
    ),
  ],
);
