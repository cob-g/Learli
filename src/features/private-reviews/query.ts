import { adminAssurancePredicate } from "@/features/admin-security/assurance";
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { Identity } from "@/lib/permissions/access";
import type { ReviewState } from "./input";
export type ReviewContent = {
  id: string;
  rating: number;
  comment: string;
  state: ReviewState;
  revision: number;
  history: {
    previousState: ReviewState | null;
    nextState: ReviewState;
    revision: number;
  }[];
};
export type AuthorReview = {
  bookingRevision: number;
  learnerName: string;
  scope: "student" | "guardian";
  review: ReviewContent | null;
};
const actorQuery = (a: Identity) =>
  sql`SELECT u.id FROM public."user" u JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active' JOIN public.session s ON s.user_id=u.id AND s.id=${a.sessionId} AND s.expires_at>statement_timestamp() WHERE u.id=${a.userId} AND u.email_verified AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'`;
const history = sql`coalesce((SELECT jsonb_agg(jsonb_build_object('previousState',e.previous_state,'nextState',e.next_state,'revision',e.revision) ORDER BY e.revision) FROM public.private_review_events e WHERE e.review_id=v.id),'[]'::jsonb)`;
export async function queryAuthorReview(
  db: Database,
  a: Identity,
  bookingId: string,
) {
  const r =
    await db.execute<AuthorReview>(sql`WITH actor AS (${actorQuery(a)}) SELECT b.revision AS "bookingRevision",l.display_name AS "learnerName",CASE l.management WHEN 'self' THEN 'student' ELSE 'guardian' END AS scope,CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object('id',v.id,'rating',v.rating,'comment',v.comment,'state',v.state,'revision',v.revision,'history',${history}) END AS review
 FROM actor a JOIN public.bookings b ON b.id=${bookingId}::uuid AND b.source='local_simulation' AND b.state='demo_completed' AND b.end_at_utc<=statement_timestamp()
 JOIN public.learner_profiles l ON l.id=b.learner_id AND l.status='active' AND l.source='local_fixture'
 JOIN public.tutor_profiles tp ON tp.id=b.tutor_id AND tp.user_id<>a.id
 LEFT JOIN public.private_booking_reviews v ON v.logical_booking_id=b.logical_booking_id
 WHERE (v.id IS NULL OR v.author_user_id=a.id) AND NOT EXISTS(SELECT 1 FROM public.bookings child WHERE child.logical_booking_id=b.logical_booking_id AND child.revision>b.revision)
 AND EXISTS(SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=b.id AND e.logical_booking_id=b.logical_booking_id AND e.event='demo_completed')
 AND ((l.management='self' AND l.user_id=a.id AND l.level='college_support' AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=a.id AND r.role='student')) OR (l.management='guardian' AND l.user_id IS NULL AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=a.id AND r.role='parent') AND EXISTS(SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=l.id AND g.guardian_user_id=a.id AND g.source='local_fixture' AND g.status='authorized')))`);
  return r.rows[0];
}
export async function queryModeratorReviews(
  db: Database,
  a: Identity,
  reviewId?: string,
) {
  const r =
    await db.execute<ReviewContent>(sql`WITH actor AS (${actorQuery(a)}) SELECT v.id,v.rating,v.comment,v.state,v.revision,${history} AS history
 FROM actor a JOIN public.review_moderators m ON m.user_id=a.id AND m.status='authorized' AND m.source='local_fixture'
 JOIN public.review_moderator_grants g ON g.moderator_user_id=a.id AND g.status='authorized'
 JOIN public.private_booking_reviews v ON v.id=g.review_id AND v.source='local_synthetic' AND v.author_user_id<>a.id
 JOIN public.bookings b ON b.id=v.booking_id JOIN public.tutor_profiles tp ON tp.id=b.tutor_id AND tp.user_id<>a.id
 WHERE ${adminAssurancePredicate(a.userId, a.sessionId)} AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=a.id AND r.role='admin') ${reviewId ? sql`AND v.id=${reviewId}::uuid` : sql``} ORDER BY v.created_at DESC,v.id LIMIT 21`);
  return r.rows;
}
