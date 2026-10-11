// Node-only owned invocation, never a user-controlled route or recipient override.
import { and, eq } from "drizzle-orm";
import { bookingEvents } from "@/lib/db/schema";
import { syntheticEmail } from "@/lib/local-mode";
import { readSimulationNoticeRecipient } from "@/features/bookings/read-notice";
import {
  drainBookingNotices,
  type DispatchOptions,
  type LocalNoticeRuntime,
} from "./delivery";

export function dispatchPendingBookingNotices(
  runtime: LocalNoticeRuntime,
  options: DispatchOptions = {},
) {
  return drainBookingNotices(
    runtime,
    options,
    async (db, eventId, recipientUserId) => {
      const [event] = await db
        .select({ bookingId: bookingEvents.bookingId })
        .from(bookingEvents)
        .where(
          and(
            eq(bookingEvents.id, eventId),
            eq(bookingEvents.event, "demo_reserved"),
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
}
