import { describe, expect, it } from "vitest";
import {
  expandWeeklyWindows,
  generateSlots,
  isValidWeeklyWindow,
  MAX_QUERY_RANGE_DAYS,
  type SlotQuery,
  type UtcInterval,
  type WeeklyWindow,
} from "@/lib/time/availability";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Expected instants are written as UTC literals, never computed by the library. */
const at = (minute: string) => new Date(`${minute}:00Z`);
const between = (start: string, end: string): UtcInterval => ({
  start: at(start),
  end: at(end),
});
const minuteOfDay = (clock: string) =>
  Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
/** Test shorthand only: an end at or before the start means the next local day. */
const weekly = (
  isoWeekday: number,
  start: string,
  end: string,
): WeeklyWindow => {
  const startMinute = minuteOfDay(start);
  const endMinute = minuteOfDay(end);
  return {
    isoWeekday,
    startMinute,
    endMinute: endMinute > startMinute ? endMinute : endMinute + 1440,
  };
};
/** Three UTC days centred on a date, so one weekly occurrence is in range. */
const around = (date: string) => {
  const noon = at(`${date}T12:00`).getTime();
  return { from: new Date(noon - 1.5 * DAY), to: new Date(noon + 1.5 * DAY) };
};
const starts = (slots: UtcInterval[]) =>
  slots.map(({ start }) => start.toISOString().slice(0, 16));

// An independent reading of the local wall clock, used to check the library.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const clocks = new Map<string, Intl.DateTimeFormat>();
function localClock(instant: number | Date, timeZone: string) {
  let clock = clocks.get(timeZone);
  if (!clock) {
    clock = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    clocks.set(timeZone, clock);
  }
  const parts = Object.fromEntries(
    clock.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    isoWeekday: WEEKDAYS.indexOf(parts.weekday) + 1,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    label: `${parts.weekday} ${parts.hour}:${parts.minute}`,
  };
}
function readsInsideAWindow(
  instant: number,
  timeZone: string,
  windows: WeeklyWindow[],
) {
  const { isoWeekday, minute } = localClock(instant, timeZone);
  return windows.some(
    (window) =>
      (isoWeekday === window.isoWeekday &&
        minute >= window.startMinute &&
        minute < window.endMinute) ||
      (isoWeekday === (window.isoWeekday % 7) + 1 &&
        minute < window.endMinute - 1440),
  );
}

const MANILA = "Asia/Manila";
const LOS_ANGELES = "America/Los_Angeles";

describe("weekly windows to UTC", () => {
  it("keeps a Manila evening at one UTC time while California's clock changes", () => {
    const intervals = expandWeeklyWindows({
      timeZone: MANILA,
      windows: [weekly(1, "21:00", "23:00")],
      from: at("2025-03-03T00:00"),
      to: at("2025-03-11T00:00"),
    });
    expect(intervals).toEqual([
      between("2025-03-03T13:00", "2025-03-03T15:00"),
      between("2025-03-10T13:00", "2025-03-10T15:00"),
    ]);
    expect(
      intervals.map(({ start }) => localClock(start, LOS_ANGELES).label),
    ).toEqual(["Mon 05:00", "Mon 06:00"]);
  });

  it("moves a California evening in UTC when California's clock changes", () => {
    const intervals = expandWeeklyWindows({
      timeZone: LOS_ANGELES,
      windows: [weekly(1, "18:00", "20:00")],
      from: at("2025-03-03T00:00"),
      to: at("2025-03-12T00:00"),
    });
    expect(intervals).toEqual([
      between("2025-03-04T02:00", "2025-03-04T04:00"),
      between("2025-03-11T01:00", "2025-03-11T03:00"),
    ]);
    // The learner's local date differs from the tutor's Monday.
    expect(
      intervals.map(({ start }) => localClock(start, MANILA).label),
    ).toEqual(["Tue 10:00", "Tue 09:00"]);
  });

  const transitions: [
    name: string,
    timeZone: string,
    date: string,
    window: WeeklyWindow,
    expected: UtcInterval[],
  ][] = [
    [
      "gives nothing for a window wholly inside the skipped hour",
      LOS_ANGELES,
      "2025-03-09",
      weekly(7, "02:00", "03:00"),
      [],
    ],
    [
      "drops the skipped hour from a window that spans it",
      LOS_ANGELES,
      "2025-03-09",
      weekly(7, "01:00", "04:00"),
      [between("2025-03-09T09:00", "2025-03-09T11:00")],
    ],
    [
      "starts at the clock change when the window starts in the skipped hour",
      LOS_ANGELES,
      "2025-03-09",
      weekly(7, "02:30", "03:30"),
      [between("2025-03-09T10:00", "2025-03-09T10:30")],
    ],
    [
      "ends at the clock change when the window ends in the skipped hour",
      LOS_ANGELES,
      "2025-03-09",
      weekly(7, "01:00", "02:30"),
      [between("2025-03-09T09:00", "2025-03-09T10:00")],
    ],
    [
      "covers both passes of a repeated hour as one interval",
      LOS_ANGELES,
      "2025-11-02",
      weekly(7, "01:00", "02:00"),
      [between("2025-11-02T08:00", "2025-11-02T10:00")],
    ],
    [
      "covers the second pass separately when the window ends inside the repeat",
      LOS_ANGELES,
      "2025-11-02",
      weekly(7, "00:30", "01:30"),
      [
        between("2025-11-02T07:30", "2025-11-02T08:30"),
        between("2025-11-02T09:00", "2025-11-02T09:30"),
      ],
    ],
    [
      "covers the first pass separately when the window starts inside the repeat",
      LOS_ANGELES,
      "2025-11-02",
      weekly(7, "01:30", "03:00"),
      [
        between("2025-11-02T08:30", "2025-11-02T09:00"),
        between("2025-11-02T09:30", "2025-11-02T11:00"),
      ],
    ],
    [
      "adds the repeated hour to a window that spans it",
      LOS_ANGELES,
      "2025-11-02",
      weekly(7, "00:00", "03:00"),
      [between("2025-11-02T07:00", "2025-11-02T11:00")],
    ],
    [
      "handles a half-hour skip",
      "Australia/Lord_Howe",
      "2025-10-05",
      weekly(7, "02:00", "03:00"),
      [between("2025-10-04T15:30", "2025-10-04T16:00")],
    ],
    [
      "handles a half-hour repeat",
      "Australia/Lord_Howe",
      "2025-04-06",
      weekly(7, "01:00", "02:00"),
      [between("2025-04-05T14:00", "2025-04-05T15:30")],
    ],
    [
      "handles a day whose first hour is skipped",
      "Africa/Cairo",
      "2025-04-25",
      weekly(5, "00:00", "02:00"),
      [between("2025-04-24T22:00", "2025-04-24T23:00")],
    ],
    [
      "handles a day whose last hour repeats",
      "Africa/Cairo",
      "2025-10-30",
      weekly(4, "23:00", "24:00"),
      [between("2025-10-30T20:00", "2025-10-30T22:00")],
    ],
    [
      "handles a clock that goes back across midnight to the previous date",
      "America/Santiago",
      "2025-04-05",
      weekly(6, "22:00", "01:00"),
      [between("2025-04-06T01:00", "2025-04-06T05:00")],
    ],
  ];
  it.each(transitions)("%s", (_name, timeZone, date, window, expected) => {
    expect(
      expandWeeklyWindows({ timeZone, windows: [window], ...around(date) }),
    ).toEqual(expected);
  });

  it("offers nothing on a calendar day the zone skipped", () => {
    expect(
      expandWeeklyWindows({
        timeZone: "Pacific/Apia",
        windows: [weekly(5, "09:00", "17:00")],
        from: at("2011-12-28T00:00"),
        to: at("2012-01-02T00:00"),
      }),
    ).toEqual([]);
  });

  it("runs an overnight window through local midnight", () => {
    expect(
      expandWeeklyWindows({
        timeZone: MANILA,
        windows: [weekly(5, "22:00", "02:00")],
        ...around("2025-03-07"),
      }),
    ).toEqual([between("2025-03-07T14:00", "2025-03-07T18:00")]);
  });

  it.each([
    ["shorter", "2025-03-09", between("2025-03-09T07:00", "2025-03-09T10:00")],
    ["longer", "2025-11-02", between("2025-11-02T06:00", "2025-11-02T11:00")],
  ])(
    "makes an overnight window %s in real time across a clock change",
    (_name, date, expected) => {
      expect(
        expandWeeklyWindows({
          timeZone: LOS_ANGELES,
          windows: [weekly(6, "23:00", "03:00")],
          ...around(date),
        }),
      ).toEqual([expected]);
    },
  );

  it.each([
    [
      "touching",
      [weekly(1, "09:00", "10:30"), weekly(1, "10:30", "12:00")],
      between("2025-03-03T01:00", "2025-03-03T04:00"),
    ],
    [
      "overlapping",
      [weekly(1, "09:00", "11:00"), weekly(1, "10:00", "12:00")],
      between("2025-03-03T01:00", "2025-03-03T04:00"),
    ],
    [
      "overnight and next-day",
      [weekly(7, "22:00", "01:00"), weekly(1, "01:00", "03:00")],
      between("2025-03-02T14:00", "2025-03-02T19:00"),
    ],
  ])("merges %s windows", (_name, windows, expected) => {
    expect(
      expandWeeklyWindows({
        timeZone: MANILA,
        windows,
        ...around("2025-03-03"),
      }),
    ).toEqual([expected]);
  });

  it("returns only the part of an interval inside the queried range", () => {
    const query = { timeZone: MANILA, windows: [weekly(1, "09:00", "12:00")] };
    const within = (from: string, to: string) =>
      expandWeeklyWindows({ ...query, from: at(from), to: at(to) });
    expect(within("2025-03-03T02:00", "2025-03-03T02:30")).toEqual([
      between("2025-03-03T02:00", "2025-03-03T02:30"),
    ]);
    expect(within("2025-03-03T00:00", "2025-03-03T01:00")).toEqual([]);
    expect(within("2025-03-03T04:00", "2025-03-03T05:00")).toEqual([]);
    expect(within("2025-03-03T02:00", "2025-03-03T02:00")).toEqual([]);
  });

  it("finds an overnight window from a range that starts after local midnight", () => {
    // Saturday 00:30 to 01:30 in Manila, inside Friday's 22:00 to 02:00 window.
    expect(
      expandWeeklyWindows({
        timeZone: MANILA,
        windows: [weekly(5, "22:00", "02:00")],
        from: at("2025-03-07T16:30"),
        to: at("2025-03-07T17:30"),
      }),
    ).toEqual([between("2025-03-07T16:30", "2025-03-07T17:30")]);
  });

  it("returns nothing without windows", () => {
    expect(
      expandWeeklyWindows({
        timeZone: MANILA,
        windows: [],
        ...around("2025-03-03"),
      }),
    ).toEqual([]);
  });
});

describe.each([
  MANILA,
  LOS_ANGELES,
  "Europe/London",
  "Australia/Lord_Howe",
  "Africa/Cairo",
  "America/Santiago",
  "Africa/Casablanca",
  "Pacific/Chatham",
  "America/St_Johns",
  "Asia/Kathmandu",
])("a year of %s against the local wall clock", (timeZone) => {
  const windows = [
    weekly(1, "09:00", "12:30"),
    weekly(3, "22:15", "01:45"),
    weekly(4, "22:00", "02:00"),
    weekly(6, "23:00", "24:00"),
    weekly(7, "00:00", "03:30"),
  ];
  const from = at("2025-01-01T00:00");
  const to = at("2026-01-01T00:00");

  it("is available exactly when the local clock reads inside a window", () => {
    const intervals = expandWeeklyWindows({ timeZone, windows, from, to });
    const wrong: string[] = [];
    let index = 0;
    for (
      let instant = from.getTime();
      instant < to.getTime();
      instant += 15 * MINUTE
    ) {
      while (
        index < intervals.length &&
        intervals[index].end.getTime() <= instant
      )
        index++;
      const available =
        index < intervals.length && intervals[index].start.getTime() <= instant;
      if (available !== readsInsideAWindow(instant, timeZone, windows))
        wrong.push(new Date(instant).toISOString());
    }
    expect(wrong).toEqual([]);
  });

  it("only offers lessons that stay inside a window for their full length", () => {
    const slots = generateSlots({
      timeZone,
      windows,
      from,
      to,
      slotMinutes: 60,
      stepMinutes: 30,
    });
    expect(slots.length).toBeGreaterThan(0);
    const wrong = slots.filter(({ start, end }) => {
      if (end.getTime() - start.getTime() !== 60 * MINUTE) return true;
      for (
        let instant = start.getTime();
        instant < end.getTime();
        instant += 15 * MINUTE
      )
        if (!readsInsideAWindow(instant, timeZone, windows)) return true;
      return false;
    });
    expect(wrong).toEqual([]);
  });
});

describe("lesson times", () => {
  const monday = {
    timeZone: MANILA,
    windows: [weekly(1, "09:00", "12:00")],
    ...around("2025-03-03"),
  };

  it("cuts a window into back-to-back lessons", () => {
    expect(
      generateSlots({ ...monday, slotMinutes: 60, stepMinutes: 60 }),
    ).toEqual([
      between("2025-03-03T01:00", "2025-03-03T02:00"),
      between("2025-03-03T02:00", "2025-03-03T03:00"),
      between("2025-03-03T03:00", "2025-03-03T04:00"),
    ]);
  });

  it("offers overlapping start times when the step is shorter than the lesson", () => {
    expect(
      starts(generateSlots({ ...monday, slotMinutes: 60, stepMinutes: 30 })),
    ).toEqual([
      "2025-03-03T01:00",
      "2025-03-03T01:30",
      "2025-03-03T02:00",
      "2025-03-03T02:30",
      "2025-03-03T03:00",
    ]);
  });

  it("offers no lesson that would run past the end of availability", () => {
    expect(
      starts(
        generateSlots({
          ...monday,
          windows: [weekly(1, "09:00", "10:30")],
          slotMinutes: 60,
          stepMinutes: 60,
        }),
      ),
    ).toEqual(["2025-03-03T01:00"]);
  });

  it("lets a lesson run on into a touching window", () => {
    expect(
      starts(
        generateSlots({
          ...monday,
          windows: [weekly(1, "09:00", "10:30"), weekly(1, "10:30", "12:00")],
          slotMinutes: 60,
          stepMinutes: 60,
        }),
      ),
    ).toEqual(["2025-03-03T01:00", "2025-03-03T02:00", "2025-03-03T02:30"]);
  });

  it("keeps start times in [from, to) without moving them", () => {
    const query = { ...monday, slotMinutes: 60, stepMinutes: 60 };
    expect(
      starts(generateSlots({ ...query, from: at("2025-03-03T01:10") })),
    ).toEqual(["2025-03-03T02:00", "2025-03-03T03:00"]);
    expect(
      starts(generateSlots({ ...query, to: at("2025-03-03T03:00") })),
    ).toEqual(["2025-03-03T01:00", "2025-03-03T02:00"]);
    expect(
      generateSlots({
        ...query,
        from: at("2025-03-03T02:00"),
        to: new Date(at("2025-03-03T02:00").getTime() + 1),
      }),
    ).toEqual([between("2025-03-03T02:00", "2025-03-03T03:00")]);
    expect(
      generateSlots({ ...query, to: query.from, from: query.from }),
    ).toEqual([]);
  });

  it("returns the same times for any range, even with unbroken availability", () => {
    const always: SlotQuery = {
      timeZone: LOS_ANGELES,
      windows: [1, 2, 3, 4, 5, 6, 7].map((day) =>
        weekly(day, "00:00", "24:00"),
      ),
      slotMinutes: 50,
      stepMinutes: 50,
      from: at("2025-03-01T00:00"),
      to: at("2025-03-20T00:00"),
    };
    const wide = starts(generateSlots(always));
    for (const [from, to] of [
      ["2025-03-08T20:00", "2025-03-10T03:00"],
      ["2025-03-12T00:00", "2025-03-13T00:00"],
      ["2025-03-15T11:17", "2025-03-15T19:43"],
    ]) {
      const narrow = starts(
        generateSlots({ ...always, from: at(from), to: at(to) }),
      );
      expect(narrow.length).toBeGreaterThan(0);
      expect(narrow).toEqual(
        wide.filter((start) => start >= from && start < to),
      );
    }
  });

  it("leaves out times that overlap a busy range and keeps those that touch it", () => {
    expect(
      starts(
        generateSlots({
          ...monday,
          slotMinutes: 60,
          stepMinutes: 30,
          busy: [between("2025-03-03T02:00", "2025-03-03T03:00")],
        }),
      ),
    ).toEqual(["2025-03-03T01:00", "2025-03-03T03:00"]);
  });

  it("accepts busy ranges in any order, overlapping, and outside the range", () => {
    expect(
      starts(
        generateSlots({
          ...monday,
          slotMinutes: 30,
          stepMinutes: 30,
          busy: [
            between("2025-03-03T03:00", "2025-03-03T03:30"),
            between("2025-01-01T00:00", "2025-01-02T00:00"),
            between("2025-03-03T01:15", "2025-03-03T01:45"),
            between("2025-03-03T01:30", "2025-03-03T02:10"),
            between("2025-06-01T00:00", "2025-06-02T00:00"),
          ],
        }),
      ),
    ).toEqual(["2025-03-03T02:30", "2025-03-03T03:30"]);
  });

  it("restarts at the first valid clock time after a skipped hour", () => {
    const slots = generateSlots({
      timeZone: LOS_ANGELES,
      windows: [weekly(7, "01:00", "04:00")],
      ...around("2025-03-09"),
      slotMinutes: 60,
      stepMinutes: 60,
    });
    expect(slots).toEqual([
      between("2025-03-09T09:00", "2025-03-09T10:00"),
      between("2025-03-09T10:00", "2025-03-09T11:00"),
    ]);
    expect(
      slots.map(({ start }) => localClock(start, LOS_ANGELES).label),
    ).toEqual(["Sun 01:00", "Sun 03:00"]);
  });

  it("offers both passes of a repeated hour as different instants", () => {
    const slots = generateSlots({
      timeZone: LOS_ANGELES,
      windows: [weekly(7, "01:00", "02:00")],
      ...around("2025-11-02"),
      slotMinutes: 60,
      stepMinutes: 60,
    });
    expect(slots).toEqual([
      between("2025-11-02T08:00", "2025-11-02T09:00"),
      between("2025-11-02T09:00", "2025-11-02T10:00"),
    ]);
    expect(
      slots.map(({ start }) => localClock(start, LOS_ANGELES).label),
    ).toEqual(["Sun 01:00", "Sun 01:00"]);
  });

  it("checks fit against the next day's window even for a one-minute range", () => {
    // Monday 23:30 in Manila; the lesson ends Tuesday 00:30.
    expect(
      generateSlots({
        timeZone: MANILA,
        windows: [weekly(1, "23:00", "24:00"), weekly(2, "00:00", "01:00")],
        from: at("2025-03-03T15:30"),
        to: at("2025-03-03T15:31"),
        slotMinutes: 60,
        stepMinutes: 30,
      }),
    ).toEqual([between("2025-03-03T15:30", "2025-03-03T16:30")]);
  });

  it("checks fit across a calendar day the zone skipped", () => {
    // Thursday 23:00 in Apia; the next local hour is Saturday 00:00.
    const slots = generateSlots({
      timeZone: "Pacific/Apia",
      windows: [1, 2, 3, 4, 5, 6, 7].map((day) =>
        weekly(day, "00:00", "24:00"),
      ),
      from: at("2011-12-30T09:00"),
      to: at("2011-12-30T09:01"),
      slotMinutes: 120,
      stepMinutes: 60,
    });
    expect(slots).toEqual([between("2011-12-30T09:00", "2011-12-30T11:00")]);
    expect(
      [slots[0].start, new Date(slots[0].end.getTime() - 1)].map(
        (instant) => localClock(instant, "Pacific/Apia").label,
      ),
    ).toEqual(["Thu 23:00", "Sat 00:59"]);
  });

  it("keeps a booked instant blocked when the tutor's time zone changes", () => {
    const booked = [between("2025-03-03T18:00", "2025-03-03T19:00")];
    const query = { ...monday, slotMinutes: 60, stepMinutes: 60, busy: booked };
    expect(starts(generateSlots(query))).toEqual([
      "2025-03-03T01:00",
      "2025-03-03T02:00",
      "2025-03-03T03:00",
    ]);
    expect(starts(generateSlots({ ...query, timeZone: LOS_ANGELES }))).toEqual([
      "2025-03-03T17:00",
      "2025-03-03T19:00",
    ]);
  });
});

describe("rejected input", () => {
  const valid: SlotQuery = {
    timeZone: MANILA,
    windows: [weekly(1, "09:00", "12:00")],
    ...around("2025-03-03"),
    slotMinutes: 60,
    stepMinutes: 60,
  };
  const invalidWindows: WeeklyWindow[] = [
    { isoWeekday: 0, startMinute: 540, endMinute: 720 },
    { isoWeekday: 8, startMinute: 540, endMinute: 720 },
    { isoWeekday: 1.5, startMinute: 540, endMinute: 720 },
    { isoWeekday: 1, startMinute: -1, endMinute: 720 },
    { isoWeekday: 1, startMinute: 1440, endMinute: 1500 },
    { isoWeekday: 1, startMinute: 540, endMinute: 540 },
    { isoWeekday: 1, startMinute: 540, endMinute: 480 },
    { isoWeekday: 1, startMinute: 540, endMinute: 1981 },
    { isoWeekday: 1, startMinute: 540.5, endMinute: 720 },
    { isoWeekday: 1, startMinute: 540, endMinute: Number.NaN },
  ];

  it("accepts windows up to a full day, including overnight ones", () => {
    for (const window of [
      weekly(1, "00:00", "24:00"),
      weekly(7, "22:00", "02:00"),
      { isoWeekday: 3, startMinute: 600, endMinute: 2040 },
      { isoWeekday: 1, startMinute: 1439, endMinute: 1440 },
    ])
      expect(isValidWeeklyWindow(window)).toBe(true);
  });

  it.each(invalidWindows)("rejects the window %j", (window) => {
    expect(isValidWeeklyWindow(window)).toBe(false);
    expect(() => generateSlots({ ...valid, windows: [window] })).toThrow(
      RangeError,
    );
    expect(() =>
      expandWeeklyWindows({ ...valid, windows: [valid.windows[0], window] }),
    ).toThrow(RangeError);
  });

  const invalidQueries: [name: string, patch: Partial<SlotQuery>][] = [
    ["a fixed offset as the zone", { timeZone: "+08:00" }],
    ["an abbreviation as the zone", { timeZone: "EST" }],
    ["an unknown zone", { timeZone: "Mars/Planet" }],
    ["a zero lesson length", { slotMinutes: 0 }],
    ["a negative lesson length", { slotMinutes: -30 }],
    ["a fractional lesson length", { slotMinutes: 30.5 }],
    ["a lesson longer than a day", { slotMinutes: 1441 }],
    ["a missing lesson length", { slotMinutes: Number.NaN }],
    ["a zero step", { stepMinutes: 0 }],
    ["a fractional step", { stepMinutes: 0.5 }],
    ["an invalid start", { from: new Date(Number.NaN) }],
    ["an invalid end", { to: new Date(Number.NaN) }],
    ["an end before the start", { to: at("2025-01-01T00:00") }],
    [
      "a range above the guard",
      {
        from: at("2025-01-01T00:00"),
        to: new Date(
          at("2025-01-01T00:00").getTime() + MAX_QUERY_RANGE_DAYS * DAY + 1,
        ),
      },
    ],
    [
      "a range in years the runtime cannot round-trip",
      {
        from: new Date("-000099-06-01T00:00:00Z"),
        to: new Date("-000098-06-01T00:00:00Z"),
      },
    ],
    [
      "a busy range that ends when it starts",
      { busy: [between("2025-03-03T02:00", "2025-03-03T02:00")] },
    ],
    [
      "a busy range that ends before it starts",
      { busy: [between("2025-03-03T03:00", "2025-03-03T02:00")] },
    ],
    [
      "a busy range with an invalid date",
      { busy: [{ start: new Date(Number.NaN), end: at("2025-03-03T02:00") }] },
    ],
  ];
  it.each(invalidQueries)("rejects %s", (_name, patch) => {
    expect(() => generateSlots({ ...valid, ...patch })).toThrow(RangeError);
  });

  it("accepts a range exactly at the guard", () => {
    const from = at("2025-01-01T00:00");
    expect(() =>
      generateSlots({
        ...valid,
        from,
        to: new Date(from.getTime() + MAX_QUERY_RANGE_DAYS * DAY),
      }),
    ).not.toThrow();
  });
});
