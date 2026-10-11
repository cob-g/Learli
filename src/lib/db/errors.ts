/** PostgreSQL error code from a driver error or a Drizzle-wrapped one. */
export function pgErrorCode(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    const code = (candidate as { code?: unknown })?.code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
export const uniqueViolation = "23505";
