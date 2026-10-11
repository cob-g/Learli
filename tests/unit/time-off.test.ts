import { describe, expect, it } from "vitest";
import { timeOffInput } from "@/features/time-off/input";
import {
  LocalTimeError,
  resolveLocalTime,
} from "@/features/time-off/local-time";
import { subtractTimeOff } from "@/features/time-off/intervals";
import { timeOffInstantLabel } from "@/features/time-off/display";
import { generateSlots, type UtcInterval } from "@/lib/time/availability";
const add = {
  operation: "add",
  version: 0,
  timezone: "Asia/Manila",
  startLocal: "2026-10-13T23:00",
  endLocal: "2026-10-14T01:00",
};
const interval = (start: string, end: string): UtcInterval => ({
  start: new Date(start),
  end: new Date(end),
});
describe("dated local time resolution", () => {
  it.each([
    ["Asia/Manila", "2026-10-13T23:00", "2026-10-13T15:00:00.000Z"],
    ["Asia/Kathmandu", "2026-10-13T23:00", "2026-10-13T17:15:00.000Z"],
    ["America/New_York", "2026-03-08T01:30", "2026-03-08T06:30:00.000Z"],
    ["America/New_York", "2026-03-08T03:30", "2026-03-08T07:30:00.000Z"],
    ["America/New_York", "2026-11-01T00:30", "2026-11-01T04:30:00.000Z"],
    ["America/New_York", "2026-11-01T02:30", "2026-11-01T07:30:00.000Z"],
    ["UTC", "2028-02-29T00:00", "2028-02-29T00:00:00.000Z"],
  ])("resolves %s %s without depending on host zone", (zone, local, utc) => {
    expect(resolveLocalTime(local, zone).toISOString()).toBe(utc);
  });
  it.each([
    ["America/New_York", "2026-03-08T02:30", "gap"],
    ["America/New_York", "2026-11-01T01:30", "fold"],
    ["Australia/Lord_Howe", "2026-10-04T02:15", "gap"],
    ["Australia/Lord_Howe", "2026-04-05T01:45", "fold"],
    ["Pacific/Apia", "2011-12-30T12:00", "gap"],
  ])("refuses %s %s (%s)", (zone, local, kind) => {
    try {
      resolveLocalTime(local, zone);
      throw new Error("Expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(LocalTimeError);
      expect(error).toMatchObject({ kind });
    }
  });
  it.each([
    "2026-02-29T12:00",
    "2026-04-31T12:00",
    "2026-00-01T12:00",
    "2026-13-01T12:00",
    "2026-01-00T12:00",
    "2026-01-01T24:00",
    "2026-01-01T12:60",
    "0099-01-01T12:00",
    "0000-01-01T00:00",
    "2026-01-01",
    "2026-01-01T12:00Z",
    "2026-01-01T12:00:01",
    "2026-1-1T12:00",
    "2026-01-01 12:00",
    "",
  ])("rejects malformed/nonexistent calendar input %s", (local) => {
    expect(() => resolveLocalTime(local, "UTC")).toThrow(LocalTimeError);
  });
  it("accepts overnight and multi-day periods, and a transition strictly inside", () => {
    expect(timeOffInput.safeParse(add).success).toBe(true);
    expect(
      timeOffInput.safeParse({ ...add, endLocal: "2026-10-20T01:00" }).success,
    ).toBe(true);
    expect(
      timeOffInput.safeParse({
        ...add,
        timezone: "America/New_York",
        startLocal: "2026-11-01T00:30",
        endLocal: "2026-11-01T02:30",
      }).success,
    ).toBe(true);
  });
  it.each([
    { endLocal: add.startLocal },
    { endLocal: "2026-10-13T22:59" },
    { timezone: "EST" },
    { timezone: "+08:00" },
    { timezone: "Etc/GMT+8" },
    { timezone: "Not/A_Zone" },
    { version: -1 },
    { version: 2_147_483_647 },
    { tutorId: "forged" },
    { reason: "unnecessary" },
    { timezone: "America/New_York", startLocal: "2026-03-08T02:30" },
  ])("rejects unsafe mutation input %j", (change) => {
    expect(timeOffInput.safeParse({ ...add, ...change }).success).toBe(false);
  });
  it("removes only a valid opaque id and rejects ownership/extra fields", () => {
    const remove = {
      operation: "remove",
      version: 1,
      id: "00000000-0000-4000-8000-000000000001",
    };
    expect(timeOffInput.safeParse(remove).success).toBe(true);
    expect(timeOffInput.safeParse({ ...remove, tutorId: "x" }).success).toBe(
      false,
    );
    expect(timeOffInput.safeParse({ ...remove, id: "x" }).success).toBe(false);
  });
  it("labels both absolute offsets when a period spans a fold", () => {
    expect(
      timeOffInstantLabel("2026-11-01T04:30Z", "America/New_York"),
    ).toContain("GMT-4");
    expect(
      timeOffInstantLabel("2026-11-01T07:30Z", "America/New_York"),
    ).toContain("GMT-5");
  });
  it("handles supported year boundaries without sampling unsupported instants", () => {
    expect(resolveLocalTime("0100-01-01T00:00", "UTC").toISOString()).toBe(
      "0100-01-01T00:00:00.000Z",
    );
    expect(resolveLocalTime("9999-12-31T23:59", "UTC").toISOString()).toBe(
      "9999-12-31T23:59:00.000Z",
    );
    expect(
      timeOffInput.safeParse({
        ...add,
        timezone: "Asia/Manila",
        startLocal: "0100-01-01T00:00",
        endLocal: "0100-01-01T01:00",
      }).success,
    ).toBe(false);
  });
});
describe("time-off suppression", () => {
  const open = [interval("2026-10-13T15:00Z", "2026-10-13T20:00Z")];
  it("subtracts overlapping/contained exclusions as a union", () => {
    const busy = [
      interval("2026-10-13T18:00Z", "2026-10-13T19:00Z"),
      interval("2026-10-13T16:00Z", "2026-10-13T18:30Z"),
      interval("2026-10-13T16:30Z", "2026-10-13T17:00Z"),
    ];
    expect(subtractTimeOff(open, busy)).toEqual([
      interval("2026-10-13T15:00Z", "2026-10-13T16:00Z"),
      interval("2026-10-13T19:00Z", "2026-10-13T20:00Z"),
    ]);
    expect(open).toEqual([interval("2026-10-13T15:00Z", "2026-10-13T20:00Z")]);
  });
  it("does not suppress adjacent half-open boundaries; handles total/partial coverage", () => {
    expect(
      subtractTimeOff(open, [
        interval("2026-10-13T14:00Z", "2026-10-13T15:00Z"),
        interval("2026-10-13T20:00Z", "2026-10-13T21:00Z"),
      ]),
    ).toEqual(open);
    expect(
      subtractTimeOff(open, [
        interval("2026-10-13T14:00Z", "2026-10-13T21:00Z"),
      ]),
    ).toEqual([]);
    expect(
      subtractTimeOff(open, [
        interval("2026-10-13T19:00Z", "2026-10-13T21:00Z"),
      ]),
    ).toEqual([interval("2026-10-13T15:00Z", "2026-10-13T19:00Z")]);
  });
  it("refuses invalid exclusions and intervals rather than accidentally advertise them", () => {
    expect(() => subtractTimeOff(open, [interval("bad", "bad")])).toThrow(
      RangeError,
    );
    expect(() =>
      subtractTimeOff(open, [
        interval("2026-10-13T16:00Z", "2026-10-13T16:00Z"),
      ]),
    ).toThrow(RangeError);
    expect(() => subtractTimeOff([interval("bad", "bad")], [])).toThrow(
      RangeError,
    );
  });
  it("engine excludes any candidate overlapping time off, with exact adjacency allowed", () => {
    const slots = generateSlots({
      timeZone: "UTC",
      windows: [{ isoWeekday: 2, startMinute: 540, endMinute: 720 }],
      from: new Date("2026-10-13T00:00Z"),
      to: new Date("2026-10-14T00:00Z"),
      slotMinutes: 60,
      stepMinutes: 30,
      busy: [interval("2026-10-13T10:00Z", "2026-10-13T11:00Z")],
    });
    expect(slots).toEqual([
      interval("2026-10-13T09:00Z", "2026-10-13T10:00Z"),
      interval("2026-10-13T11:00Z", "2026-10-13T12:00Z"),
    ]);
  });
});
