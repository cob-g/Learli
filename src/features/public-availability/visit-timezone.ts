import { isValidTimeZone } from "@/lib/time/time-zone";

/** Non-sensitive display preference; never account or booking authority. */
export const visitTimeZoneKey = "learli-preview-timezone";

export function parseVisitTimeZone(value: string | undefined) {
  if (!value || value.length > 300) return undefined;
  try {
    const zone = decodeURIComponent(value);
    return isValidTimeZone(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}

export function browserVisitTimeZone() {
  try {
    const saved = parseVisitTimeZone(
      sessionStorage.getItem(visitTimeZoneKey) ?? undefined,
    );
    if (saved) return saved;
  } catch {
    // Optional storage can be unavailable.
  }
  try {
    return parseVisitTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return undefined;
  }
}

export function writeVisitTimeZoneCookie(zone: string) {
  if (!isValidTimeZone(zone)) return;
  // Session lifetime only. HTTPS gets Secure; local HTTP remains usable.
  try {
    document.cookie = `${visitTimeZoneKey}=${encodeURIComponent(zone)}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    // Preference storage is optional; native selection remains available.
  }
}
