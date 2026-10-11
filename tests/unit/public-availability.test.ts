import { describe, expect, it } from "vitest";
import {
  demoCandidateIntervals,
  demoCandidateRange,
} from "@/features/bookings/demo-schedule";
import { publicCandidateQueryInput } from "@/features/public-availability/input";
import {
  bookingSelectionHref,
  parsePublicBookingSelection,
  safeBookingReturnPath,
  selectionFromReturnPath,
} from "@/features/bookings/selection";

import { publicProfileHref } from "@/features/public-availability/links";

const choice = {
  tutorSlug: "synthetic-tutor",
  subjectSlug: "math",
  level: "elementary" as const,
  displayTimezone: "America/New_York",
  startAtUtc: "2026-11-01T05:00:00.000Z",
  endAtUtc: "2026-11-01T06:00:00.000Z",
};
const query = {
  tutorSlugs: [choice.tutorSlug],
  subjectSlug: choice.subjectSlug,
  level: choice.level,
  displayTimezone: choice.displayTimezone,
};

describe("public local availability and continuation boundary", () => {
  it("preserves only the validated public selection through a safe return", () => {
    const href = bookingSelectionHref(choice);
    expect(selectionFromReturnPath(href)).toEqual(choice);
    expect(safeBookingReturnPath(href)).toBe(href);
    expect(
      parsePublicBookingSelection({
        ...choice,
        startAtUtc: undefined,
        endAtUtc: undefined,
      }),
    ).toBeNull();
    const { startAtUtc, endAtUtc, ...filters } = choice;
    expect(
      parsePublicBookingSelection({
        ...filters,
        time: `${startAtUtc}|${endAtUtc}`,
      }),
    ).toEqual(choice);
  });
  it.each(["learnerId", "learnerName", "bookingId", "role", "next", "paid"])(
    "refuses private or authoritative field %s",
    (field) => {
      expect(
        parsePublicBookingSelection({ ...choice, [field]: "forged" }),
      ).toBeNull();
      expect(
        safeBookingReturnPath(
          `${bookingSelectionHref(choice)}&${field}=forged`,
        ),
      ).toBe("/bookings/demo");
      expect(
        publicCandidateQueryInput.safeParse({ ...query, [field]: "forged" })
          .success,
      ).toBe(false);
    },
  );
  it.each([
    "https://evil.test",
    "//evil.test",
    "/%2f%2fevil.test",
    "/api/bookings/demo",
    "/sign-in",
    "/bookings/demo%5cfoo",
    "/bookings/demo?bad=%ZZ",
  ])("rejects unsafe return %s", (path) => {
    expect(safeBookingReturnPath(path)).toBe("/account");
    expect(selectionFromReturnPath(path)).toBeNull();
  });
  it("rejects duplicate fields and malformed selection instead of guessing", () => {
    expect(
      selectionFromReturnPath(
        `${bookingSelectionHref(choice)}&level=college_support`,
      ),
    ).toBeNull();
    expect(
      selectionFromReturnPath(`${bookingSelectionHref(choice)}#learner`),
    ).toBeNull();
    expect(
      parsePublicBookingSelection({ ...choice, time: "forged" }),
    ).toBeNull();
    expect(
      parsePublicBookingSelection({ ...choice, endAtUtc: choice.startAtUtc }),
    ).toBeNull();
    expect(
      parsePublicBookingSelection({ ...choice, displayTimezone: "EST" }),
    ).toBeNull();
    expect(safeBookingReturnPath("/tutors?subject=math")).toBe(
      "/tutors?subject=math",
    );
  });
  it("bounds batch/range and rejects public clock injection", () => {
    for (const update of [
      { tutorSlugs: [] },
      { tutorSlugs: Array(21).fill("tutor") },
      { tutorSlugs: ["tutor", "tutor"] },
      { tutorSlugs: ["bad/slug"] },
      { now: choice.startAtUtc },
      { from: choice.endAtUtc, to: choice.startAtUtc },
      { from: choice.startAtUtc, to: "2026-11-01T05:00:00Z" },
    ])
      expect(
        publicCandidateQueryInput.safeParse({ ...query, ...update }).success,
      ).toBe(false);
  });
  it("intersects requested instants with the server notice/horizon", () => {
    const now = new Date("2026-10-11T00:00:00Z");
    const range = demoCandidateRange(now, {
      from: "2020-01-01T00:00:00Z",
      to: "2030-01-01T00:00:00Z",
    });
    expect(range.from.toISOString()).toBe("2026-10-11T01:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(range.busyTo.toISOString()).toBe("2026-10-25T01:00:00.000Z");
    const past = demoCandidateRange(now, {
      from: "2020-01-01T00:00:00Z",
      to: "2020-01-02T00:00:00Z",
    });
    expect(past.from).toEqual(past.to);
  });
  it("retains 60 elapsed minutes, both DST passes and no skipped hour", () => {
    const repeated = demoCandidateIntervals({
      timezone: "America/New_York",
      windows: [{ isoWeekday: 7, startMinute: 60, endMinute: 180 }],
      from: new Date("2026-11-01T00:00Z"),
      to: new Date("2026-11-02T00:00Z"),
      busy: [],
    });
    expect(repeated.map((time) => time.start.toISOString())).toContain(
      choice.startAtUtc,
    );
    expect(repeated.map((time) => time.start.toISOString())).toContain(
      choice.endAtUtc,
    );
    expect(
      repeated.every(
        (time) => time.end.getTime() - time.start.getTime() === 3_600_000,
      ),
    ).toBe(true);
    expect(
      demoCandidateIntervals({
        timezone: "America/New_York",
        windows: [{ isoWeekday: 7, startMinute: 120, endMinute: 180 }],
        from: new Date("2026-03-08T00:00Z"),
        to: new Date("2026-03-09T00:00Z"),
        busy: [],
      }),
    ).toEqual([]);
  });
  it("omits a crossing candidate for busy time starting after the queried start horizon", () => {
    const input = {
      timezone: "UTC",
      windows: [{ isoWeekday: 1, startMinute: 0, endMinute: 180 }],
      from: new Date("2026-10-12T00:00Z"),
      to: new Date("2026-10-12T00:45Z"),
      busy: [],
    };
    expect(demoCandidateIntervals(input)).toHaveLength(2);
    expect(
      demoCandidateIntervals({
        ...input,
        busy: [
          {
            start: new Date("2026-10-12T00:50Z"),
            end: new Date("2026-10-12T01:50Z"),
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("shared matching profile links", () => {
  it("preserves canonical public filters and selected UTC instants", () => {
    const href = publicProfileHref(choice);
    const url = new URL(href, "http://127.0.0.1:3134");
    expect(url.pathname).toBe("/tutors/synthetic-tutor");
    expect(url.searchParams.get("subject")).toBe("math");
    expect(url.searchParams.get("startAtUtc")).toBe(choice.startAtUtc);
    const { startAtUtc, endAtUtc, ...filters } = choice;
    expect(publicProfileHref(filters)).not.toContain("startAtUtc");
    expect(() =>
      publicProfileHref({ ...choice, endAtUtc: startAtUtc }),
    ).toThrow();
    expect(() => publicProfileHref({ ...filters, startAtUtc })).toThrow();
    expect(endAtUtc).toBe(choice.endAtUtc);
  });
});

it("rejects repeated/non-string auth next input before the baseline helper", () => {
  for (const value of [
    [bookingSelectionHref(choice), "/account"],
    {},
    123,
    null,
  ]) {
    expect(selectionFromReturnPath(value)).toBeNull();
    expect(safeBookingReturnPath(value)).toBe("/account");
  }
});
