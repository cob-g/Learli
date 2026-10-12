// Node-only internal adapter for a claimed committed lifecycle outbox row.
// It does not replace authenticated booking reads or expose a web capability.
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import { isValidTimeZone } from "@/lib/time/time-zone";
import {
  bookingDetailPath,
  type BookingReadScope,
} from "@/features/bookings/read-model";
import { noticeKinds } from "./kinds";
import type { LifecycleNotice } from "./template";

const identity = z.strictObject({
  eventId: z.uuid(),
  recipientUserId: z.string().min(1).max(128),
  kind: z.enum(noticeKinds).exclude(["simulated_reservation_created"]),
});

export async function readLifecycleNoticeRecipient(
  db: Pick<Database, "execute">,
  input: { eventId: string; recipientUserId: string; kind: string },
): Promise<LifecycleNotice | null> {
  const { eventId, recipientUserId, kind } = identity.parse(input);
  const result = await db.execute<{
    bookingId: string;
    scope: BookingReadScope;
    timezone: string;
    subject: string;
    start: string;
    end: string;
    expires: string;
  }>(sql`
    WITH recipient AS (
      SELECT u.id, u.timezone, statement_timestamp() AS now
      FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
      WHERE u.id=${recipientUserId} AND u.email_verified=true
        AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
    ), permitted AS (
      SELECT b.id, r.timezone, sub.name AS subject, b.start_at_utc, b.end_at_utc, b.expires_at,
        CASE
          WHEN b.booked_by_user_id=r.id AND l.management='self' AND l.user_id=r.id
            AND l.level='college_support'
            AND EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=r.id AND ur.role='student') THEN 'student'
          WHEN b.booked_by_user_id=r.id AND l.management='guardian' AND l.user_id IS NULL
            AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.guardian_learner_links gl ON gl.guardian_user_id=ur.user_id
              WHERE ur.user_id=r.id AND ur.role='parent' AND gl.learner_id=l.id
                AND gl.status='authorized' AND gl.source='local_fixture') THEN 'guardian'
          WHEN tp.user_id=r.id AND tp.review_status='approved'
            AND EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=r.id AND ur.role='tutor') THEN 'tutor'
          ELSE NULL END AS scope
      FROM recipient r JOIN public.booking_lifecycle_events e ON e.id=${eventId}::uuid
      JOIN public.bookings b ON b.id=COALESCE(e.replacement_booking_id,e.booking_id)
        AND b.logical_booking_id=e.logical_booking_id AND b.source='local_simulation'
      JOIN public.learner_profiles l ON l.id=b.learner_id AND l.status='active' AND l.source='local_fixture'
      JOIN public.tutor_profiles tp ON tp.id=b.tutor_id
      JOIN public.subjects sub ON sub.id=b.subject_id
      WHERE NOT EXISTS(SELECT 1 FROM public.bookings newer WHERE newer.logical_booking_id=b.logical_booking_id AND newer.revision>b.revision)
        AND CASE e.event
          WHEN 'demo_cancelled' THEN ${kind}='simulated_reservation_cancelled' AND b.state='demo_cancelled'
          WHEN 'demo_rescheduled' THEN ${kind}='simulated_reservation_rescheduled' AND b.state='demo_reserved' AND b.expires_at>r.now
          WHEN 'demo_confirmed' THEN ${kind}='simulated_fixture_confirmed' AND b.state='demo_confirmed' AND b.expires_at>r.now
          WHEN 'demo_completed' THEN ${kind}='simulated_fixture_completed' AND b.state='demo_completed' AND b.end_at_utc<=r.now
          ELSE false END
    )
    SELECT id AS "bookingId", scope, timezone, subject, start_at_utc::text AS start,
      end_at_utc::text AS end, expires_at::text AS expires FROM permitted WHERE scope IS NOT NULL
  `);
  const row = result.rows[0];
  if (!row || !isValidTimeZone(row.timezone)) return null;
  return {
    kind,
    detailPath: bookingDetailPath(row.bookingId, row.scope),
    subject: row.subject,
    startAtUtc: new Date(row.start),
    endAtUtc: new Date(row.end),
    timezone: row.timezone,
    ...([
      "simulated_reservation_rescheduled",
      "simulated_fixture_confirmed",
    ].includes(kind)
      ? { expiresAt: new Date(row.expires) }
      : {}),
  };
}
