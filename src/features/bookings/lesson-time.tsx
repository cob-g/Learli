// Labels are formatted on the server and passed to client components unchanged.
export type LessonTimeValue = {
  startAtUtc: string;
  endAtUtc: string;
  date: string;
  time: string;
  zone: string;
};
export function LessonTime({ value }: { value: LessonTimeValue }) {
  return (
    <span className="block space-y-1">
      <time dateTime={value.startAtUtc} className="block text-time">
        {value.date}
      </time>
      <time dateTime={value.endAtUtc} className="block text-time">
        {value.time}
      </time>
      <span className="block text-small text-muted-foreground">
        {value.zone}
      </span>
    </span>
  );
}
