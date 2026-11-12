import "server-only";
import { renderAccountProofEmail } from "./account-proof-email";
import { formatLessonTime } from "@/features/bookings/format-time";
import type { BookingMessageInput } from "./transactional-message";

export const localBookingNoticeKinds = [
  "provisional",
  "confirmed",
  "rescheduled",
  "cancelled",
  "expired",
  "completed",
  "no_show",
] as const;
export type LocalBookingNoticeKind = (typeof localBookingNoticeKinds)[number];

/** Called only with a validated current participant snapshot. No meeting/child fields. */
export function renderBookingEmail(
  origin: string,
  notice: BookingMessageInput & { kind: LocalBookingNoticeKind },
) {
  const title = {
    provisional: "Provisional booking",
    confirmed: "Booking confirmed",
    rescheduled: "Booking rescheduled",
    cancelled: "Booking cancelled",
    expired: "Booking expired",
    completed: "Booking marked completed",
    no_show: "Booking marked no-show",
  }[notice.kind];
  const time = formatLessonTime(
    new Date(notice.startAtUtc),
    new Date(notice.endAtUtc),
    notice.timezone,
  );
  const introduction = {
    provisional: `Your ${notice.subject} booking is provisionally held and is not confirmed. Confirmation is required before the hold expires. Open your booking for the current status and next steps.`,
    confirmed: `Your ${notice.subject} booking is confirmed. Open your booking for the latest lesson details and any available private joining information.`,
    rescheduled: `Your ${notice.subject} booking time has changed. The updated schedule is shown below. Open your booking to check its current status and details.`,
    cancelled: `Your ${notice.subject} booking has been cancelled. The cancelled time is shown below. You can still view the booking record on Learli.`,
    expired: `The provisional hold for your ${notice.subject} booking has expired. This booking is no longer reserved. Open the record to check its status or choose another available time on Learli.`,
    completed: `Your ${notice.subject} booking has been marked completed. This is a recorded booking status; Learli does not verify lesson attendance. If this looks incorrect, open your booking and contact support.`,
    no_show: `Your ${notice.subject} booking has been marked no-show. This is a recorded booking status; Learli does not verify lesson attendance or who attended. If you disagree with this record, open your booking and contact support.`,
  }[notice.kind];
  const deadline =
    notice.kind === "provisional" && notice.expiresAtUtc
      ? formatLessonTime(
          new Date(notice.expiresAtUtc),
          new Date(notice.expiresAtUtc),
          notice.timezone,
        )
      : null;
  return renderAccountProofEmail(new URL(notice.detailPath, origin).href, {
    subject: `${title} | Learli`,
    preview: `${title}. View the latest schedule and details on Learli.`,
    heading: title,
    introduction,
    action: "View booking",
    guidance: `${notice.kind === "cancelled" ? "Cancelled time" : notice.kind === "rescheduled" ? "Updated time" : "Lesson time"}: ${time.date}. ${time.time} ${time.zone}. Times are shown in ${notice.timezone}.${deadline ? ` Confirmation deadline: ${deadline.date}. ${deadline.time} ${deadline.zone}.` : ""}`,
    ignore:
      "This is a local test booking update. No payment or attendance is established. Sign in to the account associated with this booking to view its current details. If you did not expect this update, check your account on Learli.",
  });
}
