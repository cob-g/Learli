"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  browserVisitTimeZone,
  visitTimeZoneKey,
  writeVisitTimeZoneCookie,
} from "./visit-timezone";

/** Establish the display preference before the visitor opens a tutor profile. */
export function BrowserTimeZone() {
  useEffect(() => {
    const zone = browserVisitTimeZone();
    if (zone) writeVisitTimeZoneCookie(zone);
  }, []);
  return null;
}
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
        sessionStorage.setItem(visitTimeZoneKey, timezone);
      } catch {
        /* Optional visit preference. */
      }
      writeVisitTimeZoneCookie(timezone);
      return;
    }
    if (!needsBrowserZone) return;
    const detected = browserVisitTimeZone();
    if (!detected) return;
    writeVisitTimeZoneCookie(detected);
    const url = new URL(window.location.href);
    url.searchParams.set("displayTimezone", detected);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [explicitZone, needsBrowserZone, router, timezone]);
  return null;
}
