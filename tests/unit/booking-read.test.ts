import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bookingListInput } from "@/features/bookings/read-input";
import {
  projectBookingRead,
  type StoredBookingRead,
} from "@/features/bookings/read-projection";

const row: StoredBookingRead = {
  id: randomUUID(),
  tutorName: "Synthetic tutor",
  tutorSlug: "synthetic-tutor",
  subjectName: "Math",
  subjectSlug: "math",
  learnerId: randomUUID(),
  learnerName: "Synthetic learner",
  learnerLevel: "college_support",
  state: "demo_reserved",
  start: "2026-11-01T05:30:00Z",
  end: "2026-11-01T06:30:00Z",
  expires: "2026-10-11T12:10:00Z",
  events: [
    { id: randomUUID(), event: "demo_reserved", at: "2026-10-11T12:00:00Z" },
  ],
};
describe("participant read input", () => {
  it("bounds pages and defaults without accepting actor or write fields", () => {
    expect(bookingListInput.parse({ scope: "guardian" })).toEqual({
      scope: "guardian",
      page: 1,
      pageSize: 20,
      filter: "all",
    });
    for (const values of [
      { scope: "admin" },
      { scope: "guardian", userId: "someone" },
      { scope: "student", state: "confirmed" },
      { scope: "student", page: 0 },
      { scope: "student", page: 10001 },
      { scope: "student", pageSize: 51 },
      { scope: "student", pageSize: 1.5 },
      { scope: "guardian", learnerId: "malformed" },
      { scope: ["guardian"] },
      { scope: "tutor", learnerId: randomUUID() },
      { scope: "student", filter: "completed" },
    ])
      expect(bookingListInput.safeParse(values).success).toBe(false);
  });
  it("accepts explicit family UUID filters and bounded string pagination", () => {
    expect(
      bookingListInput.parse({
        scope: "guardian",
        learnerId: row.learnerId,
        page: "2",
        pageSize: "50",
        filter: "history",
      }).page,
    ).toBe(2);
  });
});
describe("truthful UTC-backed read projection", () => {
  it.each(["2026-10-11T12:10:00Z", "2026-10-11T12:11:00Z"])(
    "projects expiry at/after deadline %s without an event or mutation",
    (snapshot) => {
      const before = structuredClone(row);
      const result = projectBookingRead(
        row,
        "America/New_York",
        new Date(snapshot),
      );
      expect(result.state).toBe("demo_expired");
      expect(result.persistedState).toBe("demo_reserved");
      expect(result.expiryMaterialized).toBe(false);
      expect(result.events.map((e) => e.event)).toEqual(["demo_reserved"]);
      expect(row).toEqual(before);
    },
  );
  it("retains authoritative materialized expiry even before the deadline", () => {
    const result = projectBookingRead(
      { ...row, state: "demo_expired" },
      "UTC",
      new Date("2026-10-11T12:01Z"),
    );
    expect(result.state).toBe("demo_expired");
    expect(result.expiryMaterialized).toBe(true);
  });
  it("uses current viewer zone for repeated-hour endpoints and event/expiry times", () => {
    const result = projectBookingRead(
      row,
      "America/New_York",
      new Date("2026-10-11T12:01Z"),
    );
    expect(result.time.time).toContain("GMT-4");
    expect(result.time.time).toContain("GMT-5");
    expect(result.time.startAtUtc).toBe("2026-11-01T05:30:00.000Z");
    expect(result.events[0].time.zone).toContain("GMT-4");
    expect(result.state).toBe("demo_reserved");
  });
  it("displays midnight crossing with both dates and offsets", () => {
    const result = projectBookingRead(
      { ...row, start: "2026-11-02T04:30Z", end: "2026-11-02T05:30Z" },
      "America/New_York",
      new Date("2026-10-11T12:01Z"),
    );
    expect(result.time.date).toContain("November 1");
    expect(result.time.date).toContain("November 2");
    expect(result.time.time).toBe("");
  });
});
