import { z } from "zod";
import { escapeHtml } from "@/lib/email/escape-html";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { formatLessonTime } from "@/features/bookings/format-time";
import { noticeKinds, type LifecycleNoticeKind } from "./kinds";

export { escapeHtml as escapeNoticeText } from "@/lib/email/escape-html";

export const noticeKind = "simulated_reservation_created" as const;
const instant = z.date().refine((value) => Number.isFinite(value.getTime()));
const input = z
  .object({
    detailPath: z
      .string()
      .regex(/^\/bookings\/[a-f0-9-]{36}\?scope=(student|guardian|tutor)$/),
    subject: z.string().trim().min(1).max(100),
    startAtUtc: instant,
    endAtUtc: instant,
    expiresAt: instant,
    timezone: z.string().refine(isValidTimeZone),
  })
  .strict()
  .refine((value) => value.endAtUtc > value.startAtUtc);
export type ReservationNotice = z.infer<typeof input>;
export type LifecycleNotice = Omit<ReservationNotice, "expiresAt"> & {
  kind: LifecycleNoticeKind;
  expiresAt?: Date;
};
export type BookingNotice = ReservationNotice | LifecycleNotice;
const bookingNoticeInput = z
  .strictObject({
    ...input.shape,
    kind: z.enum(noticeKinds).default(noticeKind),
    expiresAt: instant.optional(),
  })
  .refine((value) => value.endAtUtc > value.startAtUtc)
  .refine(
    (value) =>
      [
        "simulated_reservation_cancelled",
        "simulated_fixture_completed",
      ].includes(value.kind) || value.expiresAt !== undefined,
  );
const headings = {
  simulated_reservation_created: "Simulated reservation created",
  simulated_reservation_cancelled: "Simulated reservation cancelled",
  simulated_reservation_rescheduled: "Simulated reservation rescheduled",
  simulated_fixture_confirmed: "Synthetic fixture marked confirmed",
  simulated_fixture_completed: "Synthetic fixture marked completed",
} as const;

/** No participant/learner fields enter this template. Link always requires sign-in. */
export function renderReservationNotice(origin: string, notice: BookingNotice) {
  if (!isLoopbackOrigin(origin))
    throw new Error("Local notice origin rejected.");
  const values = bookingNoticeInput.parse(notice);
  const time = formatLessonTime(
    values.startAtUtc,
    values.endAtUtc,
    values.timezone,
  );
  const expiry = values.expiresAt
    ? formatLessonTime(values.expiresAt, values.expiresAt, values.timezone)
    : null;
  const fixture = values.kind.startsWith("simulated_fixture_");
  const disclaimer = fixture
    ? "Owner-provisioned synthetic fixture only. This does not establish a real lesson, payment or attendance."
    : "This is not a confirmed lesson.";
  const detail = new URL(values.detailPath, origin);
  const escape = escapeHtml;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex, nofollow"><title>Learli local reservation notice</title>
<style>body{margin:0;padding:1rem;font-family:Arial,sans-serif;line-height:1.6}main{max-width:42rem;margin:auto}h1{font-size:1.75rem}dt{font-weight:bold}dd{margin:0 0 1rem;overflow-wrap:anywhere}a{display:inline-block;padding:.75rem 0}a:focus-visible{outline:2px solid;outline-offset:2px}</style></head>
<body><main><h1>${headings[values.kind]}</h1>
<p>Local capture only. No email was sent.</p><p>${disclaimer}</p>
<dl><dt>Subject</dt><dd>${escape(values.subject)}</dd>
<dt>${values.kind === noticeKind ? "Reserved time" : "Scheduled time"}</dt><dd><time datetime="${escape(time.startAtUtc)}">${escape(time.date)}</time><br>${escape(time.time)}<br>${escape(time.zone)}</dd>
${expiry ? `<dt>Simulation expires at</dt><dd><time datetime="${escape(expiry.startAtUtc)}">${escape(expiry.date)} · ${escape(expiry.time)}</time><br>${escape(expiry.zone)}</dd>` : ""}</dl>
<p><a rel="noreferrer" href="${escape(detail.href)}">View simulated reservation</a></p>
<p>Sign in to an authorized local test account to view current details. This capture records a historical simulation notice; details show the current simulation state.</p>
</main></body></html>`;
}
