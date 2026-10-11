// Internal Node-only capability for an owned, claimed creation-notice dispatcher.
// Never expose this as a user-controlled route or use it instead of session reads.
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { formatLessonTime } from "./format-time";
import { bookingDetailPath, type BookingReadScope } from "./read-model";
import type { LessonTimeValue } from "./lesson-time";

const noticeRecipientInput = z.strictObject({
  bookingId: z.uuid(),
  eventId: z.uuid(),
  recipientUserId: z.string().min(1).max(128),
});
export type SimulationNoticeRecipient = {
  recipientEmail: string;
  scope: BookingReadScope;
  subject: { name: string; slug: string };
  time: LessonTimeValue;
  expires: LessonTimeValue;
  state: "demo_reserved";
  viewerTimezone: string;
  snapshotAtUtc: string;
  detailPath: string;
};

/**
 * Caller supplies committed booking/event/recipient IDs from its claimed outbox
 * row and passes that transaction connection. Scope is derived, not supplied.
 * No learner label, user ID, creator zone or write identity leaves this boundary.
 */
export async function readSimulationNoticeRecipient(
  db: Pick<Database, "execute">,
  input: { bookingId: string; eventId: string; recipientUserId: string },
): Promise<SimulationNoticeRecipient | null> {
  const { bookingId, eventId, recipientUserId } =
    noticeRecipientInput.parse(input);
  const result = await db.execute<{
    email: string;
    timezone: string;
    scope: BookingReadScope;
    subjectName: string;
    subjectSlug: string;
    start: string;
    end: string;
    expires: string;
    snapshot: string;
  }>(sql`
    WITH recipient AS (
      SELECT u.id, u.email, u.timezone, statement_timestamp() AS now
      FROM "user" u JOIN user_access a ON a.user_id = u.id AND a.status = 'active'
      WHERE u.id = ${recipientUserId} AND u.email_verified = true
        AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
    ), permitted AS (
      SELECT r.email, r.timezone, r.now, b.start_at_utc, b.end_at_utc, b.expires_at,
        sub.name AS subject_name, sub.slug AS subject_slug,
        CASE
          WHEN b.booked_by_user_id = r.id AND l.management = 'self'
            AND l.user_id = r.id AND l.level = 'college_support'
            AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = r.id AND ur.role = 'student') THEN 'student'
          WHEN b.booked_by_user_id = r.id AND l.management = 'guardian' AND l.user_id IS NULL
            AND EXISTS (SELECT 1 FROM user_roles ur JOIN guardian_learner_links gl ON gl.guardian_user_id = ur.user_id
              WHERE ur.user_id = r.id AND ur.role = 'parent' AND gl.learner_id = l.id
                AND gl.status = 'authorized' AND gl.source = 'local_fixture') THEN 'guardian'
          WHEN tp.user_id = r.id AND tp.review_status = 'approved'
            AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = r.id AND ur.role = 'tutor') THEN 'tutor'
          ELSE NULL
        END AS scope
      FROM recipient r JOIN bookings b ON b.id = ${bookingId}::uuid
        AND b.source = 'local_simulation' AND b.state = 'demo_reserved' AND b.expires_at > r.now
      JOIN booking_events e ON e.id = ${eventId}::uuid AND e.booking_id = b.id AND e.event = 'demo_reserved'
      JOIN learner_profiles l ON l.id = b.learner_id AND l.status = 'active' AND l.source = 'local_fixture'
      JOIN tutor_profiles tp ON tp.id = b.tutor_id
      JOIN subjects sub ON sub.id = b.subject_id
    )
    SELECT email, timezone, scope, subject_name AS "subjectName", subject_slug AS "subjectSlug",
      start_at_utc::text AS start, end_at_utc::text AS end, expires_at::text AS expires,
      now::text AS snapshot FROM permitted WHERE scope IS NOT NULL
  `);
  const row = result.rows[0];
  if (!row || !isValidTimeZone(row.timezone)) return null;
  const expires = new Date(row.expires);
  return {
    recipientEmail: row.email,
    scope: row.scope,
    subject: { name: row.subjectName, slug: row.subjectSlug },
    time: formatLessonTime(
      new Date(row.start),
      new Date(row.end),
      row.timezone,
    ),
    expires: formatLessonTime(expires, expires, row.timezone),
    state: "demo_reserved",
    viewerTimezone: row.timezone,
    snapshotAtUtc: new Date(row.snapshot).toISOString(),
    detailPath: bookingDetailPath(bookingId, row.scope),
  };
}
