import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLessonTimeFormatter,
  formatLessonTime,
} from "@/features/bookings/format-time";
import type { AuthRuntime } from "@/lib/auth-factory";
import * as schedule from "@/features/bookings/demo-schedule";
import * as eligibility from "@/features/tutors/eligibility";
import { readPublicCandidates } from "@/features/public-availability/service";

// Captured from the original formatter before optimization, using en-US.
const cases = [
  {
    name: "fold",
    zone: "America/New_York",
    start: "2026-11-01T05:00Z",
    end: "2026-11-01T06:00Z",
    expected: {
      startAtUtc: "2026-11-01T05:00:00.000Z",
      endAtUtc: "2026-11-01T06:00:00.000Z",
      date: "Sunday, November 1, 2026",
      time: "1:00 AM GMT-4 – 1:00 AM GMT-5",
      zone: "Eastern Time (GMT-4)",
    },
  },
  {
    name: "after fold",
    zone: "America/New_York",
    start: "2026-11-01T06:00Z",
    end: "2026-11-01T06:30Z",
    expected: {
      startAtUtc: "2026-11-01T06:00:00.000Z",
      endAtUtc: "2026-11-01T06:30:00.000Z",
      date: "Sunday, November 1, 2026",
      time: "1:00 AM GMT-5 – 1:30 AM GMT-5",
      zone: "Eastern Time (GMT-5)",
    },
  },
  {
    name: "gap",
    zone: "America/New_York",
    start: "2026-03-08T06:30Z",
    end: "2026-03-08T07:30Z",
    expected: {
      startAtUtc: "2026-03-08T06:30:00.000Z",
      endAtUtc: "2026-03-08T07:30:00.000Z",
      date: "Sunday, March 8, 2026",
      time: "1:30 AM GMT-5 – 3:30 AM GMT-4",
      zone: "Eastern Time (GMT-5)",
    },
  },
  {
    name: "viewer midnight",
    zone: "America/New_York",
    start: "2026-10-12T03:30Z",
    end: "2026-10-12T04:30Z",
    expected: {
      startAtUtc: "2026-10-12T03:30:00.000Z",
      endAtUtc: "2026-10-12T04:30:00.000Z",
      date: "Sunday, October 11, 2026 at 11:30 PM GMT-4 – Monday, October 12, 2026 at 12:30 AM GMT-4",
      time: "",
      zone: "Eastern Time (GMT-4)",
    },
  },
  {
    name: "same UTC instants in tutor zone",
    zone: "Asia/Manila",
    start: "2026-10-12T03:30Z",
    end: "2026-10-12T04:30Z",
    expected: {
      startAtUtc: "2026-10-12T03:30:00.000Z",
      endAtUtc: "2026-10-12T04:30:00.000Z",
      date: "Monday, October 12, 2026",
      time: "11:30 AM GMT+8 – 12:30 PM GMT+8",
      zone: "Philippine Standard Time (GMT+8)",
    },
  },
  {
    name: "UTC year boundary",
    zone: "UTC",
    start: "2026-12-31T23:30Z",
    end: "2027-01-01T00:30Z",
    expected: {
      startAtUtc: "2026-12-31T23:30:00.000Z",
      endAtUtc: "2027-01-01T00:30:00.000Z",
      date: "Thursday, December 31, 2026 at 11:30 PM GMT+0 – Friday, January 1, 2027 at 12:30 AM GMT+0",
      time: "",
      zone: "GMT+00:00 (GMT+0)",
    },
  },
  {
    name: "zero duration",
    zone: "UTC",
    start: "2026-10-12T00:00Z",
    end: "2026-10-12T00:00Z",
    expected: {
      startAtUtc: "2026-10-12T00:00:00.000Z",
      endAtUtc: "2026-10-12T00:00:00.000Z",
      date: "Monday, October 12, 2026",
      time: "12:00 AM GMT+0",
      zone: "GMT+00:00 (GMT+0)",
    },
  },
  {
    name: "zero duration at fold",
    zone: "America/New_York",
    start: "2026-11-01T06:00Z",
    end: "2026-11-01T06:00Z",
    expected: {
      startAtUtc: "2026-11-01T06:00:00.000Z",
      endAtUtc: "2026-11-01T06:00:00.000Z",
      date: "Sunday, November 1, 2026",
      time: "1:00 AM GMT-5",
      zone: "Eastern Time (GMT-5)",
    },
  },
  {
    name: "Lord Howe fold",
    zone: "Australia/Lord_Howe",
    start: "2026-04-04T14:45Z",
    end: "2026-04-04T15:45Z",
    expected: {
      startAtUtc: "2026-04-04T14:45:00.000Z",
      endAtUtc: "2026-04-04T15:45:00.000Z",
      date: "Sunday, April 5, 2026",
      time: "1:45 AM GMT+11 – 2:15 AM GMT+10:30",
      zone: "Lord Howe Time (GMT+11)",
    },
  },
  {
    name: "Lord Howe gap",
    zone: "Australia/Lord_Howe",
    start: "2026-10-03T15:15Z",
    end: "2026-10-03T16:15Z",
    expected: {
      startAtUtc: "2026-10-03T15:15:00.000Z",
      endAtUtc: "2026-10-03T16:15:00.000Z",
      date: "Sunday, October 4, 2026",
      time: "1:45 AM GMT+10:30 – 3:15 AM GMT+11",
      zone: "Lord Howe Time (GMT+10:30)",
    },
  },
  {
    name: "quarter-hour zone",
    zone: "Asia/Kathmandu",
    start: "2026-10-12T03:30Z",
    end: "2026-10-12T04:30Z",
    expected: {
      startAtUtc: "2026-10-12T03:30:00.000Z",
      endAtUtc: "2026-10-12T04:30:00.000Z",
      date: "Monday, October 12, 2026",
      time: "9:15 AM GMT+5:45 – 10:15 AM GMT+5:45",
      zone: "Nepal Time (GMT+5:45)",
    },
  },
  {
    name: "Chatham fold",
    zone: "Pacific/Chatham",
    start: "2026-04-04T13:30Z",
    end: "2026-04-04T14:30Z",
    expected: {
      startAtUtc: "2026-04-04T13:30:00.000Z",
      endAtUtc: "2026-04-04T14:30:00.000Z",
      date: "Sunday, April 5, 2026",
      time: "3:15 AM GMT+13:45 – 3:15 AM GMT+12:45",
      zone: "Chatham Time (GMT+13:45)",
    },
  },
  {
    name: "negative half-hour",
    zone: "America/St_Johns",
    start: "2026-11-01T04:00Z",
    end: "2026-11-01T05:00Z",
    expected: {
      startAtUtc: "2026-11-01T04:00:00.000Z",
      endAtUtc: "2026-11-01T05:00:00.000Z",
      date: "Sunday, November 1, 2026",
      time: "1:30 AM GMT-2:30 – 1:30 AM GMT-3:30",
      zone: "Newfoundland Time (GMT-2:30)",
    },
  },
  {
    name: "month boundary",
    zone: "Asia/Manila",
    start: "2026-10-31T15:30Z",
    end: "2026-10-31T16:30Z",
    expected: {
      startAtUtc: "2026-10-31T15:30:00.000Z",
      endAtUtc: "2026-10-31T16:30:00.000Z",
      date: "Saturday, October 31, 2026 at 11:30 PM GMT+8 – Sunday, November 1, 2026 at 12:30 AM GMT+8",
      time: "",
      zone: "Philippine Standard Time (GMT+8)",
    },
  },
  {
    name: "reverse endpoints",
    zone: "UTC",
    start: "2026-10-12T04:30Z",
    end: "2026-10-12T03:30Z",
    expected: {
      startAtUtc: "2026-10-12T04:30:00.000Z",
      endAtUtc: "2026-10-12T03:30:00.000Z",
      date: "Monday, October 12, 2026",
      time: "4:30 AM GMT+0 – 3:30 AM GMT+0",
      zone: "GMT+00:00 (GMT+0)",
    },
  },
];

afterEach(() => vi.restoreAllMocks());

describe("lesson time formatting", () => {
  it.each(cases)(
    "preserves exact fields and strings: $name",
    ({ zone, start, end, expected }) => {
      for (const actual of [
        formatLessonTime(new Date(start), new Date(end), zone),
        createLessonTimeFormatter(zone)(new Date(start), new Date(end)),
      ]) {
        expect(actual).toEqual(expected);
        expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
      }
    },
  );

  it("uses each instant's offset when one formatter crosses seasons and midnight", () => {
    for (const zone of new Set(cases.map((item) => item.zone))) {
      const format = createLessonTimeFormatter(zone);
      for (const item of cases.filter((item) => item.zone === zone))
        expect(format(new Date(item.start), new Date(item.end))).toEqual(
          item.expected,
        );
    }
  });

  it("bounds construction per formatter and creates the cross-day formatter lazily", () => {
    const Native = Intl.DateTimeFormat;
    const constructors = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(function (locales, options) {
        return new Native(locales, options);
      });
    const format = createLessonTimeFormatter("UTC");
    expect(constructors).toHaveBeenCalledTimes(4);
    for (let day = 1; day <= 28; day++) {
      const start = new Date(Date.UTC(2026, 9, day, 10));
      format(start, new Date(start.getTime() + 3_600_000));
      format(start, start);
    }
    expect(constructors).toHaveBeenCalledTimes(4);
    for (let day = 1; day <= 28; day++) {
      const start = new Date(Date.UTC(2026, 9, day, 23, 30));
      format(start, new Date(start.getTime() + 3_600_000));
    }
    expect(constructors).toHaveBeenCalledTimes(5);
    const other = createLessonTimeFormatter("UTC");
    other(new Date(cases[0].start), new Date(cases[0].end));
    expect(constructors).toHaveBeenCalledTimes(9);
  });

  it("shares a zone across tutor intervals only within the current candidate read", async () => {
    const profiles = ["UTC", "America/New_York", "America/New_York"].map(
      (timezone, index) => ({
        id: String(index),
        slug: `tutor-${index}`,
        timezone,
      }),
    );
    vi.spyOn(eligibility, "listEligibleTutorsBySlugs").mockResolvedValue(
      profiles.map(({ slug }) => ({
        slug,
        displayName: slug,
        headline: "Synthetic tutor",
        bio: "",
        teachingBackground: "",
        teachingLanguages: [],
        offerings: [],
      })),
    );
    const intervals = Array.from({ length: 14 }, (_, day) => ({
      start: new Date(Date.UTC(2026, 9, 25 + day, 10)),
      end: new Date(Date.UTC(2026, 9, 25 + day, 11)),
    }));
    vi.spyOn(schedule, "demoCandidateIntervals").mockReturnValue(intervals);
    const expected = profiles.map((profile) => ({
      tutorSlug: profile.slug,
      state: "available",
      times: intervals.map(({ start, end }) => ({
        ...formatLessonTime(start, end, "UTC"),
        tutorTime: formatLessonTime(start, end, profile.timezone),
      })),
    }));
    const transaction = vi.fn(async (read: (tx: unknown) => unknown) => {
      const results = [profiles, [], [], []];
      const selection = {
        from: () => selection,
        where: () => selection,
        orderBy: () => selection,
        limit: async () => results.shift(),
      };
      return read({
        execute: async () => ({
          rows: [{ milliseconds: Date.UTC(2026, 9, 25) }],
        }),
        select: () => selection,
      });
    });
    const runtime = {
      environment: "test",
      origin: "http://127.0.0.1:3000",
      db: { transaction },
    } as unknown as AuthRuntime;
    const Native = Intl.DateTimeFormat;
    const constructors = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(function (locales, options) {
        return new Native(locales, options);
      });
    for (let read = 1; read <= 2; read++) {
      const result = await readPublicCandidates(runtime, {
        tutorSlugs: profiles.map(({ slug }) => slug),
        subjectSlug: "math",
        level: "college_support",
        displayTimezone: "UTC",
      });
      expect(result.tutors).toEqual(expected);
      expect(constructors).toHaveBeenCalledTimes(read * 8);
      expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
    }
  });

  it.each(["\u202f", "\u2009"])(
    "normalizes Intl date/time spacing %j",
    (space) => {
      const native = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype,
        "format",
      )?.get;
      if (!native) throw new Error("Native Intl format getter is required.");
      // Intl types describe the bound getter as a method; expose its property shape.
      const prototype: { readonly format: unknown } =
        Intl.DateTimeFormat.prototype;
      vi.spyOn(prototype, "format", "get").mockImplementation(function (
        this: Intl.DateTimeFormat,
      ) {
        const format = native.call(this) as Intl.DateTimeFormat["format"];
        return (date?: Date | number) => format(date).replace(/ /g, space);
      });
      for (const item of [cases[0], cases[3]])
        expect(
          createLessonTimeFormatter(item.zone)(
            new Date(item.start),
            new Date(item.end),
          ),
        ).toEqual(item.expected);
    },
  );

  it("keeps native invalid Date and zone failures, including after successful reuse", () => {
    const valid = new Date(cases[0].start);
    const format = createLessonTimeFormatter("UTC");
    format(valid, valid);
    for (const [start, end] of [
      [new Date(NaN), valid],
      [valid, new Date(NaN)],
    ]) {
      expect(() => formatLessonTime(start, end, "UTC")).toThrow(
        new RangeError("Invalid time value"),
      );
      expect(() => format(start, end)).toThrow(
        new RangeError("Invalid time value"),
      );
    }
    for (const zone of ["Mars/Planet", ""]) {
      let nativeError: unknown;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone });
      } catch (error) {
        nativeError = error;
      }
      expect(nativeError).toBeInstanceOf(RangeError);
      expect(() => formatLessonTime(valid, valid, zone)).toThrow(
        nativeError as RangeError,
      );
      expect(() => formatLessonTime(new Date(NaN), valid, zone)).toThrow(
        nativeError as RangeError,
      );
      expect(() => createLessonTimeFormatter(zone)).toThrow(
        nativeError as RangeError,
      );
    }
    expect(format(valid, valid)).toEqual(formatLessonTime(valid, valid, "UTC"));
  });
});
