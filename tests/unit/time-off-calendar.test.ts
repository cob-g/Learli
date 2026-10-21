import { describe, expect, it } from "vitest";
import {
  dayCoverage,
  formatSpan,
  localDateOf,
  monthGrid,
  shiftMonth,
} from "@/features/time-off/calendar";

const at = (iso: string) => Date.parse(iso);

describe("time off calendar display", () => {
  it("marks whole and partial local days in the tutor's zone", () => {
    // Midnight Oct 24 to midnight Oct 26 in Manila (UTC+8).
    const twoDays = [
      { start: at("2026-10-23T16:00:00Z"), end: at("2026-10-25T16:00:00Z") },
    ];
    expect(dayCoverage("2026-10-24", "Asia/Manila", twoDays)).toBe("full");
    expect(dayCoverage("2026-10-25", "Asia/Manila", twoDays)).toBe("full");
    expect(dayCoverage("2026-10-26", "Asia/Manila", twoDays)).toBeNull();
    expect(dayCoverage("2026-10-23", "Asia/Manila", twoDays)).toBeNull();
    const afternoon = [
      { start: at("2026-10-29T04:30:00Z"), end: at("2026-10-29T09:00:00Z") },
    ];
    expect(dayCoverage("2026-10-29", "Asia/Manila", afternoon)).toBe("part");
  });

  it("treats adjoining periods as one covered day", () => {
    const halves = [
      { start: at("2026-10-28T12:00:00Z"), end: at("2026-10-28T16:00:00Z") },
      { start: at("2026-10-27T16:00:00Z"), end: at("2026-10-28T12:00:00Z") },
    ];
    expect(dayCoverage("2026-10-28", "Asia/Manila", halves)).toBe("full");
  });

  it("uses the actual 23-hour local day on a daylight-saving change", () => {
    // New York springs forward on 2026-03-08: local midnight to midnight is 23 h.
    const day = [
      { start: at("2026-03-08T05:00:00Z"), end: at("2026-03-09T04:00:00Z") },
    ];
    expect(dayCoverage("2026-03-08", "America/New_York", day)).toBe("full");
    expect(formatSpan(day[0].end - day[0].start)).toBe("23 h");
  });

  it("builds a Monday-first month grid and formats spans", () => {
    const grid = monthGrid("2026-10");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2026-09-28", day: 28, outside: true });
    expect(grid.find((cell) => cell.date === "2026-10-01")?.outside).toBe(
      false,
    );
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(formatSpan(2 * 86_400_000 + 20.5 * 3_600_000)).toBe(
      "2 days 20 h 30 m",
    );
    expect(localDateOf(at("2026-10-21T17:00:00Z"), "Asia/Manila")).toBe(
      "2026-10-22",
    );
  });
});
