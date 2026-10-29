import { describe, expect, it } from "vitest";
import {
  formatReceiptTime,
  wallClockToUtc,
} from "@/features/tutor-screening/time";

describe("Tutor screening wall-clock time", () => {
  it("converts a known IANA wall-clock minute to UTC", () => {
    expect(wallClockToUtc("2026-10-18T18:30", "Asia/Manila")).toEqual({
      ok: true,
      iso: "2026-10-18T10:30:00.000Z",
    });
  });

  it("rejects a daylight-saving gap instead of shifting the time", () => {
    expect(wallClockToUtc("2026-03-08T02:30", "America/New_York")).toEqual({
      ok: false,
      message:
        "This local time does not exist because the clocks change. Choose another time.",
    });
  });

  it("rejects a daylight-saving fold instead of choosing an offset", () => {
    expect(wallClockToUtc("2026-11-01T01:30", "America/New_York")).toEqual({
      ok: false,
      message:
        "This local time occurs twice because the clocks change. Choose another time.",
    });
  });

  it.each([
    "2026-02-30T12:00",
    "2026-13-01T12:00",
    "2026-10-18T25:00",
    "2026-10-18",
  ])("rejects invalid wall-clock value %s", (value) => {
    expect(wallClockToUtc(value, "UTC")).toEqual({
      ok: false,
      message: "Choose a valid date and time.",
    });
  });

  it("falls back to explicitly labelled UTC for an unavailable zone", () => {
    expect(
      formatReceiptTime("2026-10-12T12:00:00.000Z", "Not/A_Real_Time_Zone"),
    ).toBe("Oct 12, 2026, 12:00 PM UTC (2026-10-12T12:00:00.000Z UTC)");
  });
});
