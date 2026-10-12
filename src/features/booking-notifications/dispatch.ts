// Node-only owned invocation, never a user-controlled route or recipient override.
import { and, eq } from "drizzle-orm";
import { bookingEvents, bookings } from "@/lib/db/schema";
import { readLifecycleNoticeRecipient } from "./lifecycle-recipient";
import { syntheticEmail } from "@/lib/local-mode";
import { readSimulationNoticeRecipient } from "@/features/bookings/read-notice";
import {
  drainBookingNotices,
  type DispatchOptions,
  type LocalNoticeRuntime,
} from "./delivery";

export async function dispatchPendingBookingNotices(
  runtime: LocalNoticeRuntime,
  options: DispatchOptions = {},
) {
  const created = await drainBookingNotices(
    runtime,
    options,
    async (db, eventId, recipientUserId) => {
      const [event] = await db
        .select({ bookingId: bookingEvents.bookingId })
        .from(bookingEvents)
        .innerJoin(bookings, eq(bookings.id, bookingEvents.bookingId))
        .where(
          and(
            eq(bookingEvents.id, eventId),
            eq(bookingEvents.event, "demo_reserved"),
            eq(bookings.revision, 0),
          ),
        );
      if (!event) return null;
      const recipient = await readSimulationNoticeRecipient(db, {
        bookingId: event.bookingId,
        eventId,
        recipientUserId,
      });
      if (!recipient || !syntheticEmail(recipient.recipientEmail)) return null;
      return {
        detailPath: recipient.detailPath,
        subject: recipient.subject.name,
        startAtUtc: new Date(recipient.time.startAtUtc),
        endAtUtc: new Date(recipient.time.endAtUtc),
        expiresAt: new Date(recipient.expires.startAtUtc),
        timezone: recipient.viewerTimezone,
      };
    },
  );
  const attempted =
    created.captured + created.suppressed + created.retryable + created.skipped;
  const remaining = (options.limit ?? 25) - attempted;
  if (remaining <= 0) return created;
  const lifecycle = await drainBookingNotices(
    runtime,
    { ...options, limit: remaining },
    (db, eventId, recipientUserId, kind) =>
      readLifecycleNoticeRecipient(db, {
        eventId,
        recipientUserId,
        kind,
      }),
    true,
  );
  return {
    captured: created.captured + lifecycle.captured,
    suppressed: created.suppressed + lifecycle.suppressed,
    retryable: created.retryable + lifecycle.retryable,
    skipped: created.skipped + lifecycle.skipped,
  };
}
