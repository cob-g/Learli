import type { LessonTimeValue } from "./lesson-time";
const normalized = (value: string) => value.replace(/[\u202f\u2009]/g, " ");
export function formatLessonTime(
  start: Date,
  end: Date,
  timezone: string,
): LessonTimeValue {
  const opts = {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  } as const;
  const day = new Intl.DateTimeFormat("en-US", opts);
  const sameDay = day.format(start) === day.format(end);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  const zonePart = (style: "longGeneric" | "shortOffset") =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: style,
    })
      .formatToParts(start)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
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
            new Intl.DateTimeFormat("en-US", {
              ...opts,
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "shortOffset",
            }),
          ),
    ),
    time: sameDay ? normalized(endpointRange(time)) : "",
    zone: `${zonePart("longGeneric")} (${zonePart("shortOffset")})`,
  };
}
