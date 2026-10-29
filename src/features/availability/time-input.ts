const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Format a stored minute offset as the local wall-clock value for a time input. */
export function formatTimeInputValue(minute: number) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 2879) return "";
  const minuteOfDay = minute % 1440;
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}

/** Parse a native time input value without falling back to a stale stored value. */
export function parseTimeInputValue(value: string) {
  if (!localTimePattern.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
