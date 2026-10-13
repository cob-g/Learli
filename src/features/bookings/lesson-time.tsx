// Labels are formatted on the server and passed to client components unchanged.
export type LessonTimeValue = {
  startAtUtc: string;
  endAtUtc: string;
  date: string;
  time: string;
  zone: string;
};
export function LessonTime({
  value,
  variant = "full",
}: {
  value: LessonTimeValue;
  /** time-only requires an adjacent date heading and explicit zone line. */
  variant?: "full" | "prominent" | "time-only";
}) {
  if (variant === "time-only")
    return (
      <time
        dateTime={value.startAtUtc}
        className="block min-w-0 text-time wrap-anywhere"
      >
        {value.time || value.date}
      </time>
    );
  const role = variant === "prominent" ? "text-section-title" : "text-time";
  return (
    <span className="block max-w-full min-w-0 space-y-1 wrap-anywhere">
      <time dateTime={value.startAtUtc} className={`block ${role}`}>
        {value.date}
      </time>
      <time dateTime={value.endAtUtc} className={`block ${role}`}>
        {value.time}
      </time>
      <span className="block text-small text-muted-foreground">
        {value.zone}
      </span>
    </span>
  );
}
