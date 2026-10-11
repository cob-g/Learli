"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isValidTimeZone } from "@/lib/time/time-zone";

const visitZoneKey = "learli-preview-timezone";
/** Enhances a working GET form; no learner data or persistent account mutation. */
export function ProfileZone({
  needsBrowserZone,
  timezone,
  explicitZone,
}: {
  needsBrowserZone: boolean;
  timezone: string;
  explicitZone: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (explicitZone) {
      try {
        sessionStorage.setItem(visitZoneKey, timezone);
      } catch {
        /* Optional visit preference. */
      }
      return;
    }
    if (!needsBrowserZone) return;
    let detected = "";
    try {
      detected = sessionStorage.getItem(visitZoneKey) ?? "";
    } catch {
      /* Fall back to browser zone. */
    }
    if (!isValidTimeZone(detected))
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(detected)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("displayTimezone", detected);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [explicitZone, needsBrowserZone, router, timezone]);
  return null;
}
