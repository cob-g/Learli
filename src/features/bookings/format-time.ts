import type { LessonTimeValue } from "./lesson-time";
const normalized = (value: string) => value.replace(/[\u202f\u2009]/g, " ");
export function formatLessonTime(
  start: Date,
  end: Date,
  timezone: string,
): LessonTimeValue {
  return createLessonTimeFormatter(timezone)(start, end);
}

/** Reuse within one computation; every endpoint and offset is still date-specific. */
export function createLessonTimeFormatter(
  timezone: string,
): (start: Date, end: Date) => LessonTimeValue {
  const opts = {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  } as const;
  const day = new Intl.DateTimeFormat("en-US", opts);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  const zoneFormatter = (style: "longGeneric" | "shortOffset") =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: style,
    });
  const genericZone = zoneFormatter("longGeneric");
  const offsetZone = zoneFormatter("shortOffset");
  let crossDay: Intl.DateTimeFormat | undefined;
  return (start, end) => {
    const sameDay = day.format(start) === day.format(end);
    const zonePart = (formatter: Intl.DateTimeFormat) =>
      formatter.formatToParts(start).find((p) => p.type === "timeZoneName")
        ?.value ?? "";
    // Intl range collapsing can omit offsets or collapse repeated wall times.
    const endpointRange = (formatter: Intl.DateTimeFormat) =>
      start.getTime() === end.getTime()
        ? formatter.format(start)
        : `${formatter.format(start)} – ${formatter.format(end)}`;
    return {
      startAtUtc: start.toISOString(),
      endAtUtc: end.toISOString(),
      date: normalized(
        sameDay
          ? day.format(start)
          : endpointRange(
              (crossDay ??= new Intl.DateTimeFormat("en-US", {
                ...opts,
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "shortOffset",
              })),
            ),
      ),
      time: sameDay ? normalized(endpointRange(time)) : "",
      zone: `${zonePart(genericZone)} (${zonePart(offsetZone)})`,
    };
  };
}
