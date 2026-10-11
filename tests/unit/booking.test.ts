import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDemoBookingInput } from "@/features/bookings/input";
import { bookingFingerprint } from "@/features/bookings/request-fingerprint";
import { formatLessonTime } from "@/features/bookings/format-time";
import { generateSlots } from "@/lib/time/availability";

const input = {
  learnerId: randomUUID(),
  tutorSlug: "synthetic-tutor",
  subjectSlug: "math",
  displayTimezone: "America/New_York",
  startAtUtc: "2026-11-01T05:00:00Z",
  endAtUtc: "2026-11-01T06:00:00Z",
  idempotencyKey: randomUUID(),
};
describe("synthetic booking boundary and retry identity", () => {
  it("rejects forged state, arbitrary times, zones and roles", () => {
    expect(createDemoBookingInput.safeParse(input).success).toBe(true);
    for (const changed of [
      { state: "confirmed" },
      { paid: true },
      { role: "admin" },
      { displayTimezone: "EST" },
      { endAtUtc: input.startAtUtc },
      { startAtUtc: "invalid" },
      { learnerId: "foreign" },
    ])
      expect(
        createDemoBookingInput.safeParse({ ...input, ...changed }).success,
      ).toBe(false);
  });
  it("keeps canonical request identity while excluding retry key", () => {
    expect(
      bookingFingerprint({
        ...input,
        idempotencyKey: randomUUID(),
        startAtUtc: "2026-11-01T05:00:00.000Z",
      }),
    ).toBe(bookingFingerprint(input));
    for (const changed of [
      { learnerId: randomUUID() },
      { subjectSlug: "english" },
      { tutorSlug: "another-tutor" },
      { displayTimezone: "UTC" },
      { endAtUtc: "2026-11-01T07:00:00Z" },
    ])
      expect(bookingFingerprint({ ...input, ...changed })).not.toBe(
        bookingFingerprint(input),
      );
  });
  it("formats repeated wall times with distinct UTC offset context", () => {
    const first = formatLessonTime(
      new Date("2026-11-01T05:00Z"),
      new Date("2026-11-01T05:30Z"),
      "America/New_York",
    );
    const second = formatLessonTime(
      new Date("2026-11-01T06:00Z"),
      new Date("2026-11-01T06:30Z"),
      "America/New_York",
    );
    expect(first.date).toContain("November 1, 2026");
    expect(first.zone).toContain("GMT-4");
    expect(second.zone).toContain("GMT-5");
    expect(first.time).not.toBe(second.time);
    const transition = formatLessonTime(
      new Date("2026-11-01T05:00Z"),
      new Date("2026-11-01T06:00Z"),
      "America/New_York",
    );
    expect(transition.time).toContain("1:00 AM GMT-4");
    expect(transition.time).toContain("1:00 AM GMT-5");
  });
  it("keeps cross-midnight dates explicit instead of numeric-only times", () => {
    const formatted = formatLessonTime(
      new Date("2026-10-12T03:30Z"),
      new Date("2026-10-12T04:30Z"),
      "America/New_York",
    );
    expect(formatted.date).toContain("October 11");
    expect(formatted.date).toContain("October 12");
    expect(formatted.time).toBe("");
  });
  it("uses elapsed duration across repeated DST hour and omits skipped hours", () => {
    const windows = [{ isoWeekday: 7, startMinute: 60, endMinute: 180 }];
    const repeated = generateSlots({
      timeZone: "America/New_York",
      windows,
      from: new Date("2026-11-01T00:00Z"),
      to: new Date("2026-11-02T00:00Z"),
      slotMinutes: 60,
      stepMinutes: 30,
    });
    expect(repeated.map((t) => t.start.toISOString())).toContain(
      "2026-11-01T05:00:00.000Z",
    );
    expect(repeated.map((t) => t.start.toISOString())).toContain(
      "2026-11-01T06:00:00.000Z",
    );
    expect(
      repeated.every((t) => t.end.getTime() - t.start.getTime() === 3_600_000),
    ).toBe(true);
    const skipped = generateSlots({
      timeZone: "America/New_York",
      windows: [{ isoWeekday: 7, startMinute: 120, endMinute: 180 }],
      from: new Date("2026-03-08T00:00Z"),
      to: new Date("2026-03-09T00:00Z"),
      slotMinutes: 60,
      stepMinutes: 30,
    });
    expect(skipped).toEqual([]);
  });
});
