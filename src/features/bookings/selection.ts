import { z } from "zod";
import { safeReturnPath } from "@/lib/permissions/return-path";
import {
  publicLevelInput,
  publicSlugInput,
  publicZoneInput,
} from "@/features/public-availability/input";
import { demoBookingPolicy } from "./demo-policy";

/** Visitor-selected public filters, never a learner/booking/participant record. */
export const publicBookingSelectionInput = z
  .strictObject({
    tutorSlug: publicSlugInput,
    subjectSlug: publicSlugInput,
    level: publicLevelInput,
    displayTimezone: publicZoneInput,
    startAtUtc: z.iso.datetime(),
    endAtUtc: z.iso.datetime(),
  })
  .refine(
    (choice) =>
      new Date(choice.endAtUtc).getTime() -
        new Date(choice.startAtUtc).getTime() ===
      demoBookingPolicy.durationMinutes * 60_000,
  );
export type PublicBookingSelection = z.infer<
  typeof publicBookingSelectionInput
>;
export type SearchValues = Record<string, string | string[] | undefined>;

/** Public discovery handoff before the learner's current policy/slot is known.
 * Exact two-field shape; never downgrade a malformed time tuple to discovery. */
const publicBookingDiscoveryInput = z.strictObject({
  tutorSlug: publicSlugInput,
  subjectSlug: publicSlugInput,
});
export type PublicBookingDiscovery = z.infer<
  typeof publicBookingDiscoveryInput
>;
export function parsePublicBookingDiscovery(
  params: SearchValues,
): PublicBookingDiscovery | null {
  const parsed = publicBookingDiscoveryInput.safeParse(params);
  return parsed.success ? parsed.data : null;
}
export function bookingDiscoveryHref(input: PublicBookingDiscovery) {
  const discovery = publicBookingDiscoveryInput.parse(input);
  return `/bookings/demo?${new URLSearchParams(discovery)}`;
}
export function discoveryFromReturnPath(
  next: unknown,
): PublicBookingDiscovery | null {
  const path = safeReturnPath(typeof next === "string" ? next : undefined);
  const url = new URL(path, "http://learli.invalid");
  if (
    url.pathname !== "/bookings/demo" ||
    url.search.length > 2048 ||
    url.hash ||
    [...url.searchParams.keys()].some(
      (key) => url.searchParams.getAll(key).length !== 1,
    )
  )
    return null;
  return parsePublicBookingDiscovery(Object.fromEntries(url.searchParams));
}

export function parsePublicBookingSelection(
  params: SearchValues,
): PublicBookingSelection | null {
  // Native radios submit one compound interval; only the canonical split fields
  // travel through authentication. Reject duplicate/forged interval fields.
  let input: SearchValues = params;
  if ("time" in params) {
    const { time, ...rest } = params;
    if (typeof time !== "string" || "startAtUtc" in rest || "endAtUtc" in rest)
      return null;
    const instants = time.split("|");
    if (instants.length !== 2) return null;
    input = { ...rest, startAtUtc: instants[0], endAtUtc: instants[1] };
  }
  const choice = publicBookingSelectionInput.safeParse(input);
  return choice.success ? choice.data : null;
}

/** Canonical URL from validated fields only; no caller-provided next destination. */
export function bookingSelectionHref(input: PublicBookingSelection) {
  const choice = publicBookingSelectionInput.parse(input);
  return `/bookings/demo?${new URLSearchParams({ ...choice, startAtUtc: new Date(choice.startAtUtc).toISOString(), endAtUtc: new Date(choice.endAtUtc).toISOString() })}`;
}

export function selectionFromReturnPath(
  next: unknown,
): PublicBookingSelection | null {
  const path = safeReturnPath(typeof next === "string" ? next : undefined);
  const url = new URL(path, "http://learli.invalid");
  if (
    url.pathname !== "/bookings/demo" ||
    url.search.length > 2048 ||
    url.hash ||
    [...url.searchParams.keys()].some(
      (key) => url.searchParams.getAll(key).length !== 1,
    )
  )
    return null;
  return parsePublicBookingSelection(Object.fromEntries(url.searchParams));
}

/** Preserve existing safe returns; strip malformed/private fields on this flow. */
export function safeBookingReturnPath(next: unknown) {
  const path = safeReturnPath(typeof next === "string" ? next : undefined);
  const url = new URL(path, "http://learli.invalid");
  if (url.pathname !== "/bookings/demo") return path;
  const choice = selectionFromReturnPath(path);
  if (choice) return bookingSelectionHref(choice);
  const discovery = discoveryFromReturnPath(path);
  return discovery ? bookingDiscoveryHref(discovery) : "/bookings/demo";
}
