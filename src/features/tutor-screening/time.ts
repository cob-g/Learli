export type WallClockInstant =
  { ok: true; iso: string } | { ok: false; message: string };

type WallClockParts = readonly [number, number, number, number, number];

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function sameMinute(actual: WallClockParts, expected: WallClockParts): boolean {
  return actual.every((value, index) => value === expected[index]);
}

function utcMinute(parts: WallClockParts) {
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
}

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function zonedMinute(
  instant: number,
  format: Intl.DateTimeFormat,
): WallClockParts {
  const parts = Object.fromEntries(
    format
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return [parts.year, parts.month, parts.day, parts.hour, parts.minute];
}

/** Convert an IANA-zone wall-clock minute without silently shifting DST gaps or folds. */
export function wallClockToUtc(
  value: unknown,
  timeZone: string,
): WallClockInstant {
  if (typeof value !== "string")
    return { ok: false, message: "Choose a date and time." };
  const match = localDateTimePattern.exec(value);
  if (!match) return { ok: false, message: "Choose a valid date and time." };
  const values = match.slice(1).map(Number);
  const expected: WallClockParts = [
    values[0],
    values[1],
    values[2],
    values[3],
    values[4],
  ];
  if (expected[0] < 100)
    return { ok: false, message: "Choose a valid date and time." };
  const naiveUtc = utcMinute(expected);
  const normalized = new Date(naiveUtc);
  const normalizedParts: WallClockParts = [
    normalized.getUTCFullYear(),
    normalized.getUTCMonth() + 1,
    normalized.getUTCDate(),
    normalized.getUTCHours(),
    normalized.getUTCMinutes(),
  ];
  if (!Number.isFinite(naiveUtc) || !sameMinute(normalizedParts, expected))
    return { ok: false, message: "Choose a valid date and time." };

  let localFormatter: Intl.DateTimeFormat;
  try {
    localFormatter = formatter(timeZone);
  } catch {
    return { ok: false, message: "Choose a valid date and time zone." };
  }

  // Sampling the two days around the requested wall time captures the offsets
  // on either side of ordinary daylight-saving and date-line transitions.
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = naiveUtc + hours * 60 * 60 * 1000;
    offsets.add(utcMinute(zonedMinute(sample, localFormatter)) - sample);
  }
  const matches = new Set<number>();
  for (const offset of offsets) {
    const candidate = naiveUtc - offset;
    if (sameMinute(zonedMinute(candidate, localFormatter), expected))
      matches.add(candidate);
  }
  if (matches.size === 0)
    return {
      ok: false,
      message:
        "This local time does not exist because the clocks change. Choose another time.",
    };
  if (matches.size > 1)
    return {
      ok: false,
      message:
        "This local time occurs twice because the clocks change. Choose another time.",
    };
  return { ok: true, iso: new Date([...matches][0]).toISOString() };
}

/** Format a receipt in an explicit zone; invalid or unavailable zones fall back to UTC. */
export function formatReceiptTime(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  let effectiveZone = timeZone;
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: effectiveZone,
    }).format(date);
  } catch {
    effectiveZone = "UTC";
    local = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: effectiveZone,
    }).format(date);
  }
  return `${local} ${effectiveZone} (${date.toISOString()} UTC)`;
}
