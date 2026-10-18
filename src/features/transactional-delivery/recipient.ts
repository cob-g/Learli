import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import { readCurrentBookingNoticeRecipients } from "@/features/booking-workflows/provider";
import type { WorkflowEvent } from "@/features/booking-workflows/model";
import {
  bookingMessageInput,
  type BookingMessageInput,
} from "@/lib/email/transactional-message";

const kinds: Record<WorkflowEvent, BookingMessageInput["kind"]> = {
  workflow_provisional: "provisional",
  workflow_confirmed: "confirmed",
  workflow_rescheduled: "rescheduled",
  workflow_cancelled: "cancelled",
  workflow_expired: "expired",
  workflow_completed: "completed",
  workflow_no_show: "no_show",
};
/** Current authorization belongs entirely to accepted W6. This adapter only
 * projects exact participant presentation, never generic multi-role scope. */
export async function currentDeliveryMaterial(
  db: Pick<Database, "execute">,
  eventId: string,
  recipientUserId: string,
  kind: WorkflowEvent,
  firstAttemptAt: number,
): Promise<BookingMessageInput | null> {
  const recipient = (
    await readCurrentBookingNoticeRecipients(db, eventId)
  ).find((r) => r.recipientUserId === recipientUserId && r.kind === kind);
  if (!recipient) return null;
  const presentation = await db.execute<{
    timezone: string;
    scope: "student" | "guardian" | "tutor" | null;
  }>(sql`
    SELECT u.timezone, CASE
      WHEN b.booked_by_user_id=u.id AND l.management='guardian' AND l.user_id IS NULL THEN 'guardian'
      WHEN b.booked_by_user_id=u.id AND l.management='self' AND l.user_id=u.id THEN 'student'
      WHEN t.user_id=u.id THEN 'tutor'
      ELSE NULL END AS scope
    FROM public.booking_workflow_notice_intents i
    JOIN public.booking_lifecycle_events e ON e.id=i.event_id
    JOIN public.bookings b ON b.id=coalesce(e.replacement_booking_id,e.booking_id)
    JOIN public.learner_profiles l ON l.id=b.learner_id
    JOIN public.tutor_profiles t ON t.id=b.tutor_id
    JOIN public."user" u ON u.id=i.recipient_user_id
    WHERE i.event_id=${eventId}::uuid AND i.recipient_user_id=${recipientUserId}
      AND i.kind=${kind} AND b.id=${recipient.bookingId}::uuid
  `);
  const view = presentation.rows[0];
  if (!view?.scope) return null;
  // Repeat accepted authority after the presentation query rather than treating
  // an earlier authorized read as a permanent recipient receipt.
  const current = (await readCurrentBookingNoticeRecipients(db, eventId)).find(
    (r) => r.recipientUserId === recipientUserId && r.kind === kind,
  );
  if (!current || JSON.stringify(current) !== JSON.stringify(recipient))
    return null;
  const parsed = bookingMessageInput.safeParse({
    eventId,
    firstAttemptAt,
    recipientEmail: current.email,
    kind: kinds[current.kind],
    source: current.source,
    subject: current.subjectName,
    startAtUtc: new Date(current.startAtUtc).toISOString(),
    endAtUtc: new Date(current.endAtUtc).toISOString(),
    timezone: view.timezone,
    detailPath: `/bookings/${current.bookingId}?scope=${view.scope}`,
  });
  return parsed.success ? parsed.data : null;
}
