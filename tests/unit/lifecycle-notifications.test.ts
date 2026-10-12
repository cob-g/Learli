import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bookingNoticeKey } from "@/features/booking-notifications/local-capture";
import {
  renderReservationNotice,
  type LifecycleNotice,
} from "@/features/booking-notifications/template";
import { noticeKinds } from "@/features/booking-notifications/kinds";
const notice: LifecycleNotice = {
  kind: "simulated_reservation_cancelled",
  detailPath: `/bookings/${randomUUID()}?scope=guardian`,
  subject: "Math",
  startAtUtc: new Date("2026-11-01T05:30:00Z"),
  endAtUtc: new Date("2026-11-01T06:30:00Z"),
  timezone: "America/New_York",
};
describe("private local lifecycle capture templates", () => {
  it.each([
    ["simulated_reservation_cancelled", "Simulated reservation cancelled"],
    ["simulated_reservation_rescheduled", "Simulated reservation rescheduled"],
    ["simulated_fixture_confirmed", "Synthetic fixture marked confirmed"],
    ["simulated_fixture_completed", "Synthetic fixture marked completed"],
  ] as const)("truthfully labels %s", (kind, heading) => {
    const html = renderReservationNotice("http://127.0.0.1:3182", {
      ...notice,
      kind,
      ...(kind === "simulated_reservation_rescheduled" ||
      kind === "simulated_fixture_confirmed"
        ? { expiresAt: new Date("2026-10-31T12:10:00Z") }
        : {}),
    });
    expect(html).toContain(heading);
    expect(html).toContain("Local capture only. No email was sent.");
    expect(html).toContain("GMT-4");
    expect(html).toContain("GMT-5");
    expect(html).toContain("Sign in to an authorized local test account");
    if (kind.startsWith("simulated_fixture"))
      expect(html).toContain(
        "does not establish a real lesson, payment or attendance",
      );
    else expect(html).toContain("This is not a confirmed lesson.");
    expect(html).not.toMatch(/learner|meeting|token|email address/i);
  });
  it("omits meaningless expired hold deadline on terminal outcomes", () => {
    expect(
      renderReservationNotice("http://localhost:3182", notice),
    ).not.toContain("Simulation expires at");
  });
  it("requires actual expiry on live reschedule/confirmation captures", () => {
    for (const kind of [
      "simulated_reservation_rescheduled",
      "simulated_fixture_confirmed",
    ] as const)
      expect(() =>
        renderReservationNotice("http://localhost:3182", { ...notice, kind }),
      ).toThrow();
  });
  it("rejects unsupported kinds/private fields and nonfinite timestamps", () => {
    for (const invalid of [
      { ...notice, kind: "paid_confirmed" },
      { ...notice, learnerName: "Private" },
      { ...notice, url: "https://meet.google.com/private" },
      { ...notice, startAtUtc: new Date(NaN) },
    ])
      expect(() =>
        renderReservationNotice(
          "http://localhost:3182",
          invalid as LifecycleNotice,
        ),
      ).toThrow();
  });
  it("includes actual event/account/kind identity while preserving old created keys", () => {
    const id = randomUUID();
    const keys = noticeKinds.map((kind) =>
      bookingNoticeKey(id, "account", kind),
    );
    expect(new Set(keys).size).toBe(5);
    expect(bookingNoticeKey(id, "account")).toBe(keys[0]);
    expect(bookingNoticeKey(id, "account", notice.kind)).toBe(keys[1]);
  });
});
