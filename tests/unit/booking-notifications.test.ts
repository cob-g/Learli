import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bookingNoticeKey } from "@/features/booking-notifications/local-capture";
import {
  renderReservationNotice,
  type ReservationNotice,
} from "@/features/booking-notifications/template";

const notice: ReservationNotice = {
  detailPath: `/bookings/${randomUUID()}?scope=guardian`,
  subject: "Math",
  startAtUtc: new Date("2026-11-01T05:30:00Z"),
  endAtUtc: new Date("2026-11-01T06:30:00Z"),
  expiresAt: new Date("2026-10-31T12:10:00Z"),
  timezone: "America/New_York",
};
describe("minimal local reservation notice", () => {
  it("labels capture, simulation and authenticated details truthfully", () => {
    const html = renderReservationNotice("http://127.0.0.1:3136", notice);
    expect(html).toContain("Local capture only. No email was sent.");
    expect(html).toContain("This is not a confirmed lesson.");
    expect(html).toContain(notice.detailPath);
    expect(html).toContain("Sign in to an authorized local test account");
    expect(html).not.toMatch(
      /learner|parent name|meeting|token|paid|cancelled/i,
    );
  });
  it("renders repeated DST times with both actual offsets", () => {
    const html = renderReservationNotice("http://127.0.0.1:3136", notice);
    expect(html).toContain("GMT-4");
    expect(html).toContain("GMT-5");
    expect(html).toContain("Sunday, November 1, 2026");
  });
  it("keeps both dates when a recipient sees midnight crossing", () => {
    const html = renderReservationNotice("http://127.0.0.1:3136", {
      ...notice,
      startAtUtc: new Date("2026-11-01T03:30:00Z"),
      endAtUtc: new Date("2026-11-01T04:30:00Z"),
    });
    expect(html).toContain("October 31, 2026");
    expect(html).toContain("November 1, 2026");
  });
  it("escapes catalog text instead of interpreting HTML", () => {
    expect(
      renderReservationNotice("http://127.0.0.1:3136", {
        ...notice,
        subject: '<script>"&</script>',
      }),
    ).toContain("&lt;script&gt;&quot;&amp;&lt;/script&gt;");
  });
  it.each([
    "https://example.com",
    "http://127.0.0.1:3136/evil",
    "http://user@localhost:3136",
    "http://localhost:3136?x=1",
  ])("rejects unsafe origin %s", (origin) => {
    expect(() => renderReservationNotice(origin, notice)).toThrow();
  });
  it("refuses unexpected private fields and malformed schedule/scope", () => {
    for (const invalid of [
      { ...notice, learnerName: "Private" },
      { ...notice, detailPath: "/bookings/x?scope=admin" },
      { ...notice, timezone: "GMT+8" },
      { ...notice, endAtUtc: notice.startAtUtc },
    ])
      expect(() =>
        renderReservationNotice(
          "http://127.0.0.1:3136",
          invalid as ReservationNotice,
        ),
      ).toThrow();
  });
  it("keys event+account+kind without role duplicates or private filename text", () => {
    const event = randomUUID();
    const key = bookingNoticeKey(event, "account-one");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(bookingNoticeKey(event, "account-one")).toBe(key);
    expect(bookingNoticeKey(event, "account-two")).not.toBe(key);
    expect(bookingNoticeKey(randomUUID(), "account-one")).not.toBe(key);
  });
});
