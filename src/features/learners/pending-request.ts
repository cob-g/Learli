/**
 * Remembers the requestId before a create attempt is sent so a reload, even
 * before a response arrives, replays the same server request instead of minting a
 * second profile. The server replays only when the submitted fields match, so
 * the id is reused only for an identical fingerprint. Storage is optional.
 */
const prefix = "learli:pending-request:";
type Stored = { id: string; fingerprint: string };

/** A timeout/client disconnect can arrive after the server committed a write. */
export function isUncertainRequestStatus(status: number): boolean {
  return status === 408 || status === 499 || status >= 500;
}

export function requestFingerprint(fields: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((key) => [key, fields[key] ?? null]),
  );
}

export function reusableRequestId(
  scope: string,
  fingerprint: string,
  fallback: string,
): string {
  try {
    const raw = window.sessionStorage.getItem(prefix + scope);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Partial<Stored>;
    return stored.fingerprint === fingerprint &&
      typeof stored.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(stored.id)
      ? stored.id
      : fallback;
  } catch {
    return fallback;
  }
}

export function rememberRequestId(
  scope: string,
  fingerprint: string,
  id: string,
) {
  try {
    window.sessionStorage.setItem(
      prefix + scope,
      JSON.stringify({ id, fingerprint } satisfies Stored),
    );
  } catch {
    /* storage unavailable: retry uses the page's own id */
  }
}

export function clearRequestId(scope: string) {
  try {
    window.sessionStorage.removeItem(prefix + scope);
  } catch {
    /* storage unavailable */
  }
}
