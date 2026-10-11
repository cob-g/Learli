import { utcOffsetLookup } from "@/lib/time/time-zone";

export class LocalTimeError extends RangeError {
  constructor(public readonly kind: "invalid" | "gap" | "fold") {
    super(
      kind === "gap"
        ? "This local time does not exist because the clocks change. Choose another time."
        : kind === "fold"
          ? "This local time occurs twice because the clocks change. Choose an unambiguous time."
          : "Enter a valid date and time.",
    );
  }
}

/** Strict minute-precision calendar input, independent of the machine's zone. */
export function localCalendarMillis(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new LocalTimeError("invalid");
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(ms);
  if (
    year < 100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    throw new LocalTimeError("invalid");
  return ms;
}

/** Reject gaps and folds, rather than guessing which concrete instant was meant. */
export function resolveLocalTime(value: string, timeZone: string): Date {
  const local = localCalendarMillis(value);
  const offsetAt = utcOffsetLookup(timeZone);
  const offsets = new Set<number>();
  // Region offsets are less than a day; this also includes date-line transitions.
  // Like the existing engine, sampling assumes no two offset changes in one hour.
  const supported = (instant: number) => {
    const year = new Date(instant).getUTCFullYear();
    return year >= 100 && year <= 9999;
  };
  for (let hour = -48; hour <= 48; hour++) {
    const probe = local + hour * 3_600_000;
    if (supported(probe)) offsets.add(offsetAt(probe));
  }
  const candidates = [...offsets]
    .map((offset) => local - offset)
    .filter(
      (instant) => supported(instant) && instant + offsetAt(instant) === local,
    );
  if (candidates.length !== 1)
    throw new LocalTimeError(candidates.length ? "fold" : "gap");
  return new Date(candidates[0]);
}
