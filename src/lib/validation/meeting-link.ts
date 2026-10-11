export type MeetingProvider = "zoom" | "google_meet";

export type MeetingLinkResult =
  | { ok: true; provider: MeetingProvider; url: string }
  | { ok: false; code: "INVALID_MEETING_LINK" };

const MAX_URL_LENGTH = 2048;
const MAX_MEET_CODE_LENGTH = 128;
const ZOOM_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)?zoom\.us$/;

/**
 * Checks only supported joining syntax; never existence, attendance or access.
 * The successful URL is private data. Callers must authorize its use and must
 * not log it. See docs/meeting-link-validation.md for the supported subset.
 */
export function validateMeetingLink(input: unknown): MeetingLinkResult {
  const invalid: MeetingLinkResult = {
    ok: false,
    code: "INVALID_MEETING_LINK",
  };
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_URL_LENGTH ||
    // Do not let URL parsing trim controls, repair slashes or normalize IDNs.
    /[^\x21-\x7e]|[\\%#]/.test(input)
  ) {
    return invalid;
  }

  // Preserve raw authority/path to reject credentials, ports and dot-segment
  // repair, including syntax that the WHATWG parser otherwise accepts.
  const raw = /^https:\/\/([a-z0-9.-]+)(\/[^?]*)(\?[^#]*)?$/i.exec(input);
  if (!raw) return invalid;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    // Parser exceptions can contain the private input; never forward them.
    return invalid;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.hash !== "" ||
    parsed.hostname !== raw[1].toLowerCase() ||
    parsed.pathname !== raw[2]
  ) {
    return invalid;
  }

  const query = raw[3] ?? "";
  if (
    ZOOM_HOST.test(parsed.hostname) &&
    !parsed.hostname.startsWith("xn--") &&
    /^\/j\/[0-9]{9,11}$/.test(parsed.pathname) &&
    (query === "" || /^\?pwd=[A-Za-z0-9._~-]{1,256}$/.test(query))
  ) {
    return { ok: true, provider: "zoom", url: parsed.href };
  }

  if (
    parsed.hostname === "meet.google.com" &&
    /^\/[a-z]+-[a-z]+-[a-z]+$/.test(parsed.pathname) &&
    parsed.pathname.length - 1 <= MAX_MEET_CODE_LENGTH &&
    query === ""
  ) {
    return { ok: true, provider: "google_meet", url: parsed.href };
  }

  return invalid;
}
