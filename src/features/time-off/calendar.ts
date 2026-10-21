import { utcOffsetLookup } from "@/lib/time/time-zone";
import { resolveLocalTime } from "./local-time";

/** Display helpers for the Time off preview and month calendar. */

/** The calendar date of an instant in a time zone, as YYYY-MM-DD. */
export function localDateOf(instant: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** A local midnight as an instant; a midnight lost to a clock change uses the offset just before it. */
function localMidnight(date: string, timeZone: string) {
  try {
    return resolveLocalTime(`${date}T00:00`, timeZone).getTime();
  } catch {
    const [year, month, day] = date.split("-").map(Number);
    const local = Date.UTC(year, month - 1, day);
    const offsetAt = utcOffsetLookup(timeZone);
    return local - offsetAt(local - 86_400_000);
  }
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export type Period = { start: number; end: number };
export type DayCoverage = "full" | "part" | null;

/** The instants a local calendar day starts and ends; the costly part, so callers can reuse it. */
export function localDayBounds(date: string, timeZone: string): Period {
  return {
    start: localMidnight(date, timeZone),
    end: localMidnight(addDays(date, 1), timeZone),
  };
}

/** Whether periods cover a whole day (given its bounds), part of it, or none. */
export function coverageWithin(
  { start, end }: Period,
  periods: readonly Period[],
): DayCoverage {
  let covered = start;
  let touched = false;
  for (const period of [...periods].sort((a, b) => a.start - b.start)) {
    if (period.end <= start || period.start >= end) continue;
    touched = true;
    if (period.start <= covered) covered = Math.max(covered, period.end);
  }
  return covered >= end ? "full" : touched ? "part" : null;
}

/** Whether saved periods cover the whole local day, part of it, or none. */
export function dayCoverage(
  date: string,
  timeZone: string,
  periods: readonly Period[],
): DayCoverage {
  return coverageWithin(localDayBounds(date, timeZone), periods);
}

/** The 6×7 Monday-first grid for a YYYY-MM month, with outside days marked. */
export function monthGrid(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, 1 - lead + index));
    return {
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      outside: date.getUTCMonth() !== monthNumber - 1,
    };
  });
}

export function shiftMonth(month: string, by: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + by, 1))
    .toISOString()
    .slice(0, 7);
}

export function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

/** "Wed, Oct 21, 12:30 PM" in the tutor's zone. */
export function shortInstantLabel(instant: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

/** "Oct" and "21" for a period's date tile. */
export function dateTile(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).formatToParts(new Date(instant));
  return {
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

/** "1 day 3 h 30 m", from actual elapsed time. */
export function formatSpan(milliseconds: number) {
  let minutes = Math.round(milliseconds / 60_000);
  const days = Math.floor(minutes / 1440);
  minutes -= days * 1440;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  const parts = [
    days ? `${days} ${days === 1 ? "day" : "days"}` : "",
    hours ? `${hours} h` : "",
    minutes ? `${minutes} m` : "",
  ].filter(Boolean);
  return parts.join(" ") || "0 m";
}
