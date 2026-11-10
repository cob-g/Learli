/** Parse the private database validity bound; a missing/invalid value fails closed. */
export function screeningValidityMillis(value: string | null): number | null {
  if (value === "infinity") return Number.POSITIVE_INFINITY;
  if (value === null) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

/** Expiry is exclusive, including when the lesson ends exactly at expiry. */
export function screeningCoversLesson(
  validUntil: number | null,
  end: Date,
): boolean {
  return validUntil !== null && end.getTime() < validUntil;
}
