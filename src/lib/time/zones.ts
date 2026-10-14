// Server-side only by convention: Node and browsers carry different zone data,
// so labels are built in one runtime and passed to client components as props.

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
function offsetOf(zone: string, at: Date) {
  let formatter = offsetFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    });
    // Cache formatters, never offsets: each date must still honor its own DST.
    if (offsetFormatters.size >= 512)
      offsetFormatters.delete(offsetFormatters.keys().next().value!);
    offsetFormatters.set(zone, formatter);
  }
  const label =
    formatter.formatToParts(at).find((part) => part.type === "timeZoneName")
      ?.value ?? "GMT";
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(label);
  const minutes = match?.[1]
    ? (match[1] === "-" ? -1 : 1) *
      (Number(match[2]) * 60 + Number(match[3] ?? 0))
    : 0;
  return { label, minutes };
}

/** "Manila (GMT+8)". The identifier itself is never user-facing text. */
export function timeZoneLabel(zone: string, at = new Date()) {
  const city = zone.slice(zone.lastIndexOf("/") + 1).replaceAll("_", " ");
  return `${city} (${offsetOf(zone, at).label})`;
}

export type TimeZoneOption = { value: string; label: string };

/** Every supported zone, ordered by current offset and then by city. */
export function listTimeZoneOptions(
  at = new Date(),
  include: string[] = [],
): TimeZoneOption[] {
  return [
    ...new Set(["UTC", ...include, ...Intl.supportedValuesOf("timeZone")]),
  ]
    .map((value) => {
      const { label, minutes } = offsetOf(value, at);
      const city = value.slice(value.lastIndexOf("/") + 1).replaceAll("_", " ");
      return { value, label: `${city} (${label})`, minutes };
    })
    .sort(
      (a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label, "en"),
    )
    .map(({ value, label }) => ({ value, label }));
}
