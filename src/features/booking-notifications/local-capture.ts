// Node-only local adapter. Never imported by a client component.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { noticeKinds, type BookingNoticeKind } from "./kinds";
import { z } from "zod";
import {
  noticeKind,
  renderReservationNotice,
  type BookingNotice,
} from "./template";

export function bookingNoticeKey(
  eventId: string,
  recipientUserId: string,
  kind: BookingNoticeKind = noticeKind,
) {
  z.enum(noticeKinds).parse(kind);
  z.uuid().parse(eventId);
  z.string().min(1).max(200).parse(recipientUserId);
  return createHash("sha256")
    .update(JSON.stringify([eventId, recipientUserId, kind]))
    .digest("hex");
}

export function bookingNoticeMailbox(environment: "development" | "test") {
  if (!["development", "test"].includes(environment))
    throw new Error("Local notice environment rejected.");
  return path.join(
    process.cwd(),
    ".local",
    "mail",
    environment,
    "booking-notifications",
  );
}

/** Atomic stable file identity, not exactly-once delivery across database/file crashes. */
export async function captureBookingNotice(options: {
  environment: "development" | "test";
  origin: string;
  eventId: string;
  recipientUserId: string;
  notice: BookingNotice;
}) {
  const html = renderReservationNotice(options.origin, options.notice);
  const directory = bookingNoticeMailbox(options.environment);
  const key = bookingNoticeKey(
    options.eventId,
    options.recipientUserId,
    "kind" in options.notice ? options.notice.kind : noticeKind,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${key}-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, html, { mode: 0o600, flag: "wx" });
    await rename(temporary, path.join(directory, `${key}.html`));
  } finally {
    await rm(temporary, { force: true });
  }
}
