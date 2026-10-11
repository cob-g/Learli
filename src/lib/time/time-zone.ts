const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;
const MAX_IDENTIFIER_LENGTH = 64;
const AREA_LOCATION = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+.-]+)+$/;

/**
 * True for the identifiers Learli schedules against: `UTC`, or an IANA
 * Area/Location name this runtime knows. Fixed offsets and offset-style names
 * (`+08:00`, `EST`, `Etc/GMT+8`) are refused, because a recurring window has to
 * follow a region's daylight-saving rules. The value is never rewritten (the
 * runtime would turn `Asia/Kolkata` into `Asia/Calcutta`), so store it as given.
 */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_IDENTIFIER_LENGTH)
    return false;
  if (value === "UTC") return true;
  if (!AREA_LOCATION.test(value) || /^etc\//i.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a function giving the zone's UTC offset in milliseconds (local minus
 * UTC) at an instant. Offsets are read from the runtime's time-zone data, never
 * from a fixed table, so every daylight-saving rule change is followed.
 */
export function utcOffsetLookup(timeZone: string) {
  if (!isValidTimeZone(timeZone))
    throw new RangeError("A valid IANA time zone is required.");
  const wallClock = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (epochMs: number) => {
    if (!Number.isFinite(epochMs))
      throw new RangeError("A valid instant is required.");
    const wholeSecond = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
    const fields: Record<string, number> = {};
    for (const part of wallClock.formatToParts(wholeSecond))
      fields[part.type] = Number(part.value);
    const offset =
      Date.UTC(
        fields.year,
        fields.month - 1,
        fields.day,
        fields.hour,
        fields.minute,
        fields.second,
      ) - wholeSecond;
    // No zone is a day from UTC. A larger result means the year did not survive
    // the round trip (years before 100), so refuse it rather than mislead.
    if (!(Math.abs(offset) < MS_PER_DAY))
      throw new RangeError("A valid instant is required.");
    return offset;
  };
}
