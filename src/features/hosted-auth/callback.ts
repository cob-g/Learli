import { safeBookingReturnPath } from "@/features/bookings/selection";

export function safeHostedCallback(
  value: unknown,
  origin: string,
  reset = false,
) {
  if (
    typeof value !== "string" ||
    !value ||
    /[\s\\\u0000-\u001f\u007f]/.test(value) ||
    value.startsWith("//")
  )
    return false;
  try {
    if (!value.startsWith("/") && !value.startsWith(`${origin}/`)) return false;
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password || url.hash)
      return false;
    if (reset) return url.pathname === "/reset-password" && !url.search;
    if (!["/", "/sign-in", "/account"].includes(url.pathname)) return false;
    for (const [key, entry] of url.searchParams) {
      if (url.searchParams.getAll(key).length !== 1) return false;
      if (key === "verified" && entry === "1") continue;
      if (
        key === "next" &&
        entry.startsWith("/") &&
        !entry.startsWith("//") &&
        !new URL(entry, origin).hash &&
        safeBookingReturnPath(entry) === entry &&
        !/[\\\u0000-\u001f\u007f]/.test(entry)
      )
        continue;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
