import "server-only";
import { renderAccountProofEmail } from "./account-proof-email";
import { formatLessonTime } from "@/features/bookings/format-time";
import type { BookingMessageInput } from "./transactional-message";

export const localBookingNoticeKinds = [
  "confirmed",
  "rescheduled",
  "cancelled",
] as const;
export type LocalBookingNoticeKind = (typeof localBookingNoticeKinds)[number];

/** Called only with a validated current participant snapshot. No meeting/child fields. */
export function renderBookingEmail(
  origin: string,
  notice: BookingMessageInput & { kind: LocalBookingNoticeKind },
) {
  const title = {
    confirmed: "Booking confirmed",
    rescheduled: "Booking rescheduled",
    cancelled: "Booking cancelled",
  }[notice.kind];
  const time = formatLessonTime(
    new Date(notice.startAtUtc),
    new Date(notice.endAtUtc),
    notice.timezone,
  );
  const introduction = {
    confirmed: `Your ${notice.subject} booking is confirmed. Open your booking for the latest lesson details and any available private joining information.`,
    rescheduled: `Your ${notice.subject} booking time has changed. The updated schedule is shown below. Open your booking to check its current status and details.`,
    cancelled: `Your ${notice.subject} booking has been cancelled. The cancelled time is shown below. You can still view the booking record on Learli.`,
  }[notice.kind];
  return renderAccountProofEmail(new URL(notice.detailPath, origin).href, {
    subject: `${title} | Learli`,
    preview: `${title}. View the latest schedule and details on Learli.`,
    heading: title,
    introduction,
    action: "View booking",
    guidance: `${notice.kind === "cancelled" ? "Cancelled time" : notice.kind === "rescheduled" ? "Updated time" : "Lesson time"}: ${time.date}. ${time.time} ${time.zone}. Times are shown in ${notice.timezone}.`,
    ignore:
      "This is a local test booking update. No payment or attendance is established. Sign in to the account associated with this booking to view its current details. If you did not expect this update, check your account on Learli.",
  });
}
