import { describe, expect, it } from "vitest";
import { isValidTimeZone, utcOffsetLookup } from "@/lib/time/time-zone";
import { listTimeZoneOptions, timeZoneLabel } from "@/lib/time/zones";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

describe("reused display-zone formatters", () => {
  it("formats each date's actual offset across DST after reuse, including aliases", () => {
    const before = new Date("2026-03-08T06:59:59Z");
    const after = new Date("2026-03-08T07:00:00Z");
    expect(timeZoneLabel("America/New_York", before)).toBe("New York (GMT-5)");
    expect(timeZoneLabel("America/New_York", after)).toBe("New York (GMT-4)");
    expect(timeZoneLabel("America/New_York", before)).toBe("New York (GMT-5)");
    for (const date of [before, after]) {
      const options = listTimeZoneOptions(date, ["US/Eastern", "Asia/Kolkata"]);
      for (const zone of [
        "America/New_York",
        "US/Eastern",
        "Asia/Kolkata",
        "Pacific/Chatham",
        "UTC",
      ]) {
        const offset = new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          timeZoneName: "shortOffset",
        })
          .formatToParts(date)
          .find((part) => part.type === "timeZoneName")!.value;
        expect(options.find((item) => item.value === zone)?.label).toContain(
          `(${offset})`,
        );
      }
      expect(new Set(options.map((item) => item.value)).size).toBe(
        options.length,
      );
    }
  });
});

describe("time-zone identifiers", () => {
  it.each([
    "UTC",
    "Asia/Manila",
    "America/Los_Angeles",
    "America/Argentina/Buenos_Aires",
    "Australia/Lord_Howe",
    "Asia/Kolkata",
    "Asia/Calcutta",
    "US/Pacific",
  ])("accepts %s", (value) => {
    expect(isValidTimeZone(value)).toBe(true);
  });

  it.each([
    "+08:00",
    "-0800",
    "GMT+8",
    "GMT",
    "EST",
    "PST8PDT",
    "Etc/GMT+8",
    "Etc/UTC",
    "etc/utc",
    "utc",
    "Asia",
    "Mars/Planet",
    "Asia/Manila/Extra",
    " Asia/Manila",
    "Asia/Manila ",
    "Asia/Manila\n",
    "",
    `Asia/${"a".repeat(64)}`,
  ])("rejects %j", (value) => {
    expect(isValidTimeZone(value)).toBe(false);
  });

  it.each([[null], [undefined], [8], [{}], [["Asia/Manila"]]])(
    "rejects the non-string %j",
    (value) => {
      expect(isValidTimeZone(value)).toBe(false);
    },
  );
});

describe("UTC offsets", () => {
  it("changes at the zone's own transition instants, not on a fixed offset", () => {
    const losAngeles = utcOffsetLookup("America/Los_Angeles");
    expect(losAngeles(at("2025-03-09T09:59:59Z"))).toBe(-8 * HOUR);
    expect(losAngeles(at("2025-03-09T10:00:00Z"))).toBe(-7 * HOUR);
    expect(losAngeles(at("2025-11-02T08:59:59.999Z"))).toBe(-7 * HOUR);
    expect(losAngeles(at("2025-11-02T09:00:00Z"))).toBe(-8 * HOUR);
  });

  it.each([
    ["UTC", 0, 0],
    ["Asia/Manila", 8 * HOUR, 8 * HOUR],
    ["Asia/Kathmandu", 5 * HOUR + 45 * MINUTE, 5 * HOUR + 45 * MINUTE],
    ["Australia/Lord_Howe", 11 * HOUR, 10 * HOUR + 30 * MINUTE],
    ["America/St_Johns", -(3 * HOUR + 30 * MINUTE), -(2 * HOUR + 30 * MINUTE)],
    ["Pacific/Chatham", 13 * HOUR + 45 * MINUTE, 12 * HOUR + 45 * MINUTE],
  ])("reads %s in January and July", (timeZone, january, july) => {
    const offsetAt = utcOffsetLookup(timeZone);
    expect(offsetAt(at("2025-01-15T12:00:00Z"))).toBe(january);
    expect(offsetAt(at("2025-07-15T12:00:00Z"))).toBe(july);
  });

  it.each(["+08:00", "EST", "Etc/GMT+8", "Mars/Planet", ""])(
    "refuses to look up %j",
    (timeZone) => {
      expect(() => utcOffsetLookup(timeZone)).toThrow(RangeError);
    },
  );

  it("refuses an invalid instant", () => {
    expect(() => utcOffsetLookup("Asia/Manila")(Number.NaN)).toThrow(
      RangeError,
    );
  });

  it("reads a pre-standard-time offset that is still under a day", () => {
    expect(utcOffsetLookup("Asia/Manila")(at("1800-01-01T00:00:00Z"))).toBe(
      -(15 * HOUR + 56 * MINUTE + 8_000),
    );
  });

  it.each(["0050-06-01T00:00:00Z", "-000099-06-01T00:00:00Z"])(
    "refuses %s, a year the runtime cannot round-trip",
    (iso) => {
      expect(() => utcOffsetLookup("Asia/Manila")(at(iso))).toThrow(RangeError);
    },
  );
});
