/** Each endpoint carries its actual offset, including a transition inside time off. */
export function timeOffInstantLabel(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(new Date(instant));
}
