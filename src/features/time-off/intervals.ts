import type { UtcInterval } from "@/lib/time/availability";

/** Subtract the union of half-open exclusions without moving the weekly hours. */
export function subtractTimeOff(
  open: readonly UtcInterval[],
  busy: readonly UtcInterval[],
): UtcInterval[] {
  const exclusions = [...busy].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  if (
    exclusions.some(
      ({ start, end }) =>
        !(
          Number.isFinite(start.getTime()) &&
          Number.isFinite(end.getTime()) &&
          end > start
        ),
    )
  )
    throw new RangeError("Every time-off interval must be valid.");
  return open.flatMap(({ start, end }) => {
    if (!(
      Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      end > start
    ))
      throw new RangeError("Every available interval must be valid.");
    let cursor = start.getTime();
    const result: UtcInterval[] = [];
    for (const exclusion of exclusions) {
      if (exclusion.end.getTime() <= cursor) continue;
      if (exclusion.start >= end) break;
      if (exclusion.start.getTime() > cursor)
        result.push({
          start: new Date(cursor),
          end: new Date(exclusion.start),
        });
      cursor = Math.max(cursor, exclusion.end.getTime());
      if (cursor >= end.getTime()) break;
    }
    if (cursor < end.getTime())
      result.push({ start: new Date(cursor), end: new Date(end) });
    return result;
  });
}
