import { utcOffsetLookup } from "./time-zone";

export const MINUTES_PER_DAY = 1440;
/** CPU guard for one query. It is not a booking-horizon policy. */
export const MAX_QUERY_RANGE_DAYS = 366;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
/** 1970-01-01, local day 0, was a Thursday. */
const ISO_WEEKDAY_OF_DAY_ZERO = 4;
/**
 * Local days examined beyond each end of a query. Local time can jump by up to
 * a day at a transition, a window can run into the next local day, and a slot
 * can be a day long.
 */
const DAY_MARGIN = 2;

/** Half-open UTC range: `start` is included, `end` is not. */
export type UtcInterval = { start: Date; end: Date };

/** A recurring weekly range in the tutor's local wall-clock time. */
export type WeeklyWindow = {
  /** Local weekday the window starts on: 1 = Monday to 7 = Sunday. */
  isoWeekday: number;
  /** Minutes after local midnight, 0 to 1439. */
  startMinute: number;
  /**
   * Exclusive end in minutes after the same midnight. A value above 1440 runs
   * into the next local day, so Friday 22:00 to 02:00 is 1320 to 1560.
   */
  endMinute: number;
};

export type AvailabilityQuery = {
  /** IANA zone the windows are written in. */
  timeZone: string;
  windows: readonly WeeklyWindow[];
  /** Start of the queried range, inclusive. */
  from: Date;
  /** End of the queried range, exclusive. */
  to: Date;
};

export type SlotQuery = AvailabilityQuery & {
  /** Lesson length. Required: the duration policy is not this module's to pick. */
  slotMinutes: number;
  /** Distance between candidate start times. Required for the same reason. */
  stepMinutes: number;
  /** UTC ranges already taken, such as active bookings and time off. */
  busy?: readonly UtcInterval[];
};

type Span = readonly [start: number, end: number];
type ZoneSegment = { start: number; end: number; offset: number };
type OffsetAt = (epochMs: number) => number;

export function isValidWeeklyWindow(window: WeeklyWindow) {
  const { isoWeekday, startMinute, endMinute } = window;
  return (
    Number.isInteger(isoWeekday) &&
    isoWeekday >= 1 &&
    isoWeekday <= 7 &&
    Number.isInteger(startMinute) &&
    startMinute >= 0 &&
    startMinute < MINUTES_PER_DAY &&
    Number.isInteger(endMinute) &&
    endMinute > startMinute &&
    endMinute <= startMinute + MINUTES_PER_DAY
  );
}

function queryRange(from: Date, to: Date): Span {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (
    !Number.isFinite(fromMs) ||
    !Number.isFinite(toMs) ||
    toMs < fromMs ||
    toMs - fromMs > MAX_QUERY_RANGE_DAYS * MS_PER_DAY
  )
    throw new RangeError(
      `A valid range of at most ${MAX_QUERY_RANGE_DAYS} days is required.`,
    );
  return [fromMs, toMs];
}

function wholeMinutes(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1 || value > MINUTES_PER_DAY)
    throw new RangeError(
      `${name} must be a whole number of minutes from 1 to ${MINUTES_PER_DAY}.`,
    );
  return value * MS_PER_MINUTE;
}

function mergeSpans(spans: readonly Span[]) {
  const merged: [number, number][] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** First whole second at which the offset differs from `offsetBefore`. */
function transitionBetween(
  offsetAt: OffsetAt,
  before: number,
  after: number,
  offsetBefore: number,
) {
  let low = before;
  let high = after;
  while (high - low > MS_PER_SECOND) {
    const middle =
      low + Math.floor((high - low) / (2 * MS_PER_SECOND)) * MS_PER_SECOND;
    if (offsetAt(middle) === offsetBefore) low = middle;
    else high = middle;
  }
  return high;
}

/**
 * Splits [from, to) into stretches of constant UTC offset. Offsets are sampled
 * hourly, which assumes no zone changes its offset twice within one hour.
 */
function zoneSegments(offsetAt: OffsetAt, from: number, to: number) {
  const segments: ZoneSegment[] = [];
  let start = from;
  let offset = offsetAt(from);
  for (let probe = from; probe < to; probe += MS_PER_HOUR) {
    const next = Math.min(probe + MS_PER_HOUR, to);
    const nextOffset = offsetAt(next);
    if (nextOffset === offset) continue;
    const transition = transitionBetween(offsetAt, probe, next, offset);
    segments.push({ start, end: transition, offset });
    start = transition;
    offset = nextOffset;
  }
  segments.push({ start, end: to, offset });
  return segments;
}

/**
 * A window covers exactly the instants at which the local wall clock reads
 * inside it. Within a stretch of constant offset that is a plain shift, so a
 * skipped local time yields nothing, and a repeated local hour is covered on
 * both passes without any wall-clock time being moved. Each returned span is
 * one window on one date within one such stretch, for every local day near
 * the range.
 */
function windowSpans(
  timeZone: string,
  windows: readonly WeeklyWindow[],
  [fromMs, toMs]: Span,
) {
  const offsetAt = utcOffsetLookup(timeZone);
  if (!windows.every(isValidWeeklyWindow))
    throw new RangeError("Every weekly window must be valid.");
  const spans: Span[] = [];
  if (fromMs === toMs || windows.length === 0) return spans;

  const firstDay =
    Math.floor((fromMs + offsetAt(fromMs)) / MS_PER_DAY) - DAY_MARGIN;
  const lastDay = Math.floor((toMs + offsetAt(toMs)) / MS_PER_DAY) + DAY_MARGIN;
  // A window ends within two days of its midnight; an offset is under a day.
  const segments = zoneSegments(
    offsetAt,
    (firstDay - 1) * MS_PER_DAY,
    (lastDay + 3) * MS_PER_DAY,
  );

  for (let day = firstDay; day <= lastDay; day++) {
    const isoWeekday =
      ((((day + ISO_WEEKDAY_OF_DAY_ZERO - 1) % 7) + 7) % 7) + 1;
    for (const window of windows) {
      if (window.isoWeekday !== isoWeekday) continue;
      const localStart = day * MS_PER_DAY + window.startMinute * MS_PER_MINUTE;
      const localEnd = day * MS_PER_DAY + window.endMinute * MS_PER_MINUTE;
      for (const segment of segments) {
        const start = Math.max(segment.start, localStart - segment.offset);
        const end = Math.min(segment.end, localEnd - segment.offset);
        if (start < end) spans.push([start, end]);
      }
    }
  }
  return spans;
}

/**
 * The parts of [from, to) during which the tutor is available, as UTC
 * intervals. Touching and overlapping windows are merged.
 */
export function expandWeeklyWindows(query: AvailabilityQuery): UtcInterval[] {
  const range = queryRange(query.from, query.to);
  const [fromMs, toMs] = range;
  return mergeSpans(windowSpans(query.timeZone, query.windows, range))
    .filter(([start, end]) => start < toMs && end > fromMs)
    .map(([start, end]) => ({
      start: new Date(Math.max(start, fromMs)),
      end: new Date(Math.min(end, toMs)),
    }));
}

/**
 * Candidate lesson times that start within [from, to), lie entirely inside
 * availability and overlap nothing in `busy`. Start times step from the
 * beginning of each window on each date (and again from a clock change inside
 * it), so the same times come back whatever range is asked for. A lesson may
 * run on into a touching window. The result is advisory: booking must still
 * recheck on the server.
 */
export function generateSlots(query: SlotQuery): UtcInterval[] {
  const slotMs = wholeMinutes(query.slotMinutes, "slotMinutes");
  const stepMs = wholeMinutes(query.stepMinutes, "stepMinutes");
  const range = queryRange(query.from, query.to);
  const [fromMs, toMs] = range;
  const busy = mergeSpans(
    (query.busy ?? []).map(({ start, end }): Span => {
      const span: Span = [start.getTime(), end.getTime()];
      if (!(span[0] < span[1]))
        throw new RangeError("Every busy interval must end after it starts.");
      return span;
    }),
  );
  const spans = windowSpans(query.timeZone, query.windows, range);
  const open = mergeSpans(spans);

  const starts = new Set<number>();
  for (const [spanStart, spanEnd] of spans) {
    const skipped = Math.max(0, Math.ceil((fromMs - spanStart) / stepMs));
    const last = Math.min(spanEnd, toMs);
    for (
      let start = spanStart + skipped * stepMs;
      start < last;
      start += stepMs
    )
      starts.add(start);
  }

  const slots: UtcInterval[] = [];
  let openIndex = 0;
  let busyIndex = 0;
  for (const start of [...starts].sort((a, b) => a - b)) {
    const end = start + slotMs;
    while (openIndex < open.length && open[openIndex][1] <= start) openIndex++;
    if (openIndex === open.length || end > open[openIndex][1]) continue;
    while (busyIndex < busy.length && busy[busyIndex][1] <= start) busyIndex++;
    if (busyIndex < busy.length && busy[busyIndex][0] < end) continue;
    slots.push({ start: new Date(start), end: new Date(end) });
  }
  return slots;
}
