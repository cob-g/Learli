import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { Identity } from "@/lib/permissions/access";
import { currentCompletionEligibilityPredicate } from "@/features/booking-workflows/provider";
import type { PublicationState } from "./input";
export type PublicationReview = {
  id: string;
  rating: number;
  comment: string;
  state: PublicationState;
  revision: number;
  history: {
    previousState: PublicationState | null;
    nextState: PublicationState;
    revision: number;
    privacyChecked: boolean;
  }[];
};
export type AuthorPublication = {
  bookingRevision: number;
  completionEventId: string;
  review: PublicationReview | null;
};
export type PublicReviewProjection = {
  scope: "synthetic_readiness";
  count: number;
  average: number | null;
  reviews: {
    authorLabel: "Customer";
    rating: number;
    comment: string;
    date: string;
  }[];
};
const history = sql`coalesce((SELECT jsonb_agg(jsonb_build_object('previousState',e.previous_state,'nextState',e.next_state,'revision',e.revision,'privacyChecked',e.privacy_checked) ORDER BY e.revision) FROM public.publication_review_events e WHERE e.review_id=v.id),'[]'::jsonb)`;
export async function queryAuthorPublication(
  db: Pick<Database, "execute">,
  a: Identity,
  bookingId: string,
  policyId: string,
) {
  const result = await db.execute<AuthorPublication>(
    sql`SELECT b.workflow_revision AS "bookingRevision",ce.id AS "completionEventId",CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object('id',v.id,'rating',v.rating,'comment',v.comment,'state',v.state,'revision',v.revision,'history',${history}) END AS review FROM public.bookings b JOIN public.booking_lifecycle_events ce ON ce.booking_id=b.id AND ce.event='workflow_completed' AND ce.workflow_revision=b.workflow_revision AND ce.workflow_policy_id=b.workflow_policy_id LEFT JOIN public.publication_reviews v ON v.logical_booking_id=b.logical_booking_id WHERE b.id=${bookingId}::uuid AND b.booked_by_user_id=${a.userId} AND (v.id IS NULL OR (v.author_user_id=${a.userId} AND v.policy_id=${policyId}::uuid)) AND public.publication_author_allowed(${a.userId},${a.sessionId},b.id,ce.id,b.workflow_revision,${policyId}::uuid) AND ${currentCompletionEligibilityPredicate({ userId: a.userId, sessionId: a.sessionId, bookingId: sql`b.id`, eventId: sql`ce.id` })}`,
  );
  return result.rows[0];
}
export async function queryModeratorPublications(
  db: Pick<Database, "execute">,
  a: Identity,
  policyId: string,
  reviewId?: string,
) {
  const result = await db.execute<PublicationReview>(
    sql`SELECT v.id,v.rating,v.comment,v.state,v.revision,${history} AS history FROM public.publication_reviews v WHERE public.publication_moderator_allowed(${a.userId},${a.sessionId},v.id,${policyId}::uuid) ${reviewId ? sql`AND v.id=${reviewId}::uuid` : sql``} ORDER BY v.created_at DESC,v.id LIMIT 21`,
  );
  return result.rows;
}
/** One statement and one exact eligible set for rows/count/average. No internal IDs leave SQL. */
export async function queryPublicReviewProjection(
  db: Pick<Database, "execute">,
  slug: string,
  policyId: string,
): Promise<PublicReviewProjection> {
  const result = await db.execute<PublicReviewProjection>(
    sql`WITH eligible AS MATERIALIZED (SELECT v.rating,v.comment,v.created_at FROM public.publication_reviews v JOIN public.bookings b ON b.id=v.booking_id JOIN public.tutor_profiles t ON t.id=b.tutor_id JOIN public.publication_review_events e ON e.review_id=v.id AND e.revision=v.revision AND e.next_state='published' AND e.privacy_checked AND e.policy_id=v.policy_id WHERE t.slug=${slug} AND v.source='synthetic_readiness' AND v.state='published' AND v.policy_id=${policyId}::uuid AND public.publication_policy_current(v.policy_id) AND public.publication_completion_current(v.author_user_id,v.booking_id,v.completion_event_id,v.booking_revision) AND EXISTS(SELECT 1 FROM public.publication_review_events approval WHERE approval.review_id=v.id AND approval.revision=e.revision-1 AND approval.next_state='approved' AND approval.privacy_checked AND approval.policy_id=v.policy_id)) SELECT 'synthetic_readiness' AS scope,count(*)::integer AS count,avg(rating)::float8 AS average,coalesce(jsonb_agg(jsonb_build_object('authorLabel','Customer','rating',rating,'comment',comment,'date',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD')) ORDER BY created_at DESC),'[]'::jsonb) AS reviews FROM eligible`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Publication projection unavailable.");
  return row;
}
