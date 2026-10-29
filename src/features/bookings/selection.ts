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

const privateBookingScopeInput = z.enum(["student", "guardian"]);
export type PrivateBookingScope = z.infer<typeof privateBookingScopeInput>;

/** Presentation intent only. Authorization still comes from the selected learner. */
export function parsePrivateBookingScope(
  value: unknown,
): PrivateBookingScope | null {
  const parsed = privateBookingScopeInput.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function bookingReturnUrl(next: unknown) {
  const path = safeReturnPath(typeof next === "string" ? next : undefined);
  const url = new URL(path, "http://learli.invalid");
  return { path, url };
}

function publicReturnParams(url: URL): SearchValues | null {
  if (
    !["/bookings/demo", "/bookings/new"].includes(url.pathname) ||
    url.search.length > 2048 ||
    url.hash
  )
    return null;
  const params = new URLSearchParams(url.searchParams);
  // Scope is private presentation metadata. It is never part of the strict
  // public tutor/subject/time contract, and is never accepted on the demo URL.
  if (url.pathname === "/bookings/new") params.delete("scope");
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
    return null;
  return Object.fromEntries(params);
}

export function privateBookingScopeFromReturnPath(
  next: unknown,
): PrivateBookingScope | null {
  const { url } = bookingReturnUrl(next);
  if (
    url.pathname !== "/bookings/new" ||
    url.search.length > 2048 ||
    url.hash ||
    url.searchParams.getAll("scope").length !== 1
  )
    return null;
  return parsePrivateBookingScope(url.searchParams.get("scope"));
}

/** Add only validated presentation scope to an already canonical private URL. */
export function withPrivateBookingScope(
  path: string,
  scope: PrivateBookingScope | null,
) {
  if (!scope) return path;
  const url = new URL(path, "http://learli.invalid");
  if (url.pathname !== "/bookings/new" || url.hash) return path;
  url.searchParams.set("scope", scope);
  return `${url.pathname}${url.search}`;
}

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
export function bookingDiscoveryHref(
  input: PublicBookingDiscovery,
  privateWorkflow = false,
) {
  const discovery = publicBookingDiscoveryInput.parse(input);
  return `${privateWorkflow ? "/bookings/new" : "/bookings/demo"}?${new URLSearchParams(discovery)}`;
}
export function discoveryFromReturnPath(
  next: unknown,
): PublicBookingDiscovery | null {
  const { url } = bookingReturnUrl(next);
  const params = publicReturnParams(url);
  return params ? parsePublicBookingDiscovery(params) : null;
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
export function bookingSelectionHref(
  input: PublicBookingSelection,
  privateWorkflow = false,
) {
  const choice = publicBookingSelectionInput.parse(input);
  return `${privateWorkflow ? "/bookings/new" : "/bookings/demo"}?${new URLSearchParams({ ...choice, startAtUtc: new Date(choice.startAtUtc).toISOString(), endAtUtc: new Date(choice.endAtUtc).toISOString() })}`;
}

export function selectionFromReturnPath(
  next: unknown,
): PublicBookingSelection | null {
  const { url } = bookingReturnUrl(next);
  const params = publicReturnParams(url);
  return params ? parsePublicBookingSelection(params) : null;
}

/** Preserve existing safe returns; strip malformed/private fields on this flow. */
export function safeBookingReturnPath(next: unknown) {
  const { path, url } = bookingReturnUrl(next);
  if (!["/bookings/demo", "/bookings/new"].includes(url.pathname)) return path;
  const privateWorkflow = url.pathname === "/bookings/new";
  const scope = privateBookingScopeFromReturnPath(path);
  const choice = selectionFromReturnPath(path);
  if (choice)
    return withPrivateBookingScope(
      bookingSelectionHref(choice, privateWorkflow),
      scope,
    );
  const discovery = discoveryFromReturnPath(path);
  const canonical = discovery
    ? bookingDiscoveryHref(discovery, privateWorkflow)
    : privateWorkflow
      ? "/bookings/new"
      : "/bookings/demo";
  return withPrivateBookingScope(canonical, scope);
}

/** Presentation conversion only; validators still canonicalize the public fields. */
export function privateBookingHref(path: string) {
  const safe = safeBookingReturnPath(path);
  return safe.replace(/^\/bookings\/demo(?=\?|$)/, "/bookings/new");
}
