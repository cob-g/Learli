import { safeBookingReturnPath } from "@/features/bookings/selection";

export const parentOnboardingPath = "/parent/onboarding";

/** Intent only. No return path grants a role or a guardian relationship. */
export function isParentOnboardingPath(value: unknown) {
  return (
    new URL(safeBookingReturnPath(value), "http://learli.invalid").pathname ===
    parentOnboardingPath
  );
}

export function parentContinuation(value: unknown): string {
  let destination = safeBookingReturnPath(value);
  if (isParentOnboardingPath(destination)) {
    const nested = new URL(destination, "http://learli.invalid").searchParams;
    destination = safeBookingReturnPath(
      nested.getAll("next").length === 1 ? nested.get("next") : undefined,
    );
  }
  return destination === "/account" || isParentOnboardingPath(destination)
    ? "/parent"
    : destination;
}

export function parentOnboardingHref(next?: unknown) {
  const destination = parentContinuation(next);
  return destination === "/parent"
    ? parentOnboardingPath
    : `${parentOnboardingPath}?${new URLSearchParams({ next: destination })}`;
}
