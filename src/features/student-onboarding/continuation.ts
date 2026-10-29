import {
  bookingDiscoveryHref,
  bookingSelectionHref,
  discoveryFromReturnPath,
  privateBookingScopeFromReturnPath,
  privateBookingHref,
  safeBookingReturnPath,
  selectionFromReturnPath,
  withPrivateBookingScope,
} from "@/features/bookings/selection";

export const studentOnboardingPath = "/student/onboarding";
const base = "http://learli.invalid";

/** College intent is navigation only; it never grants a workspace or eligibility. */
export function isStudentOnboardingPath(value: unknown) {
  return (
    new URL(safeBookingReturnPath(value), base).pathname ===
    studentOnboardingPath
  );
}

/** Carry only the existing canonical public selection/discovery. Unwrap once;
 * recursive, duplicate or unknown nested fields cannot become return authority. */
export function studentContinuation(value: unknown): string {
  if (typeof value !== "string" || value.length > 8192) return "/account";
  let destination = safeBookingReturnPath(value);
  const intent = new URL(destination, base);
  if (intent.pathname === studentOnboardingPath) {
    if (
      intent.hash ||
      [...intent.searchParams.keys()].some((key) => key !== "next") ||
      intent.searchParams.getAll("next").length !== 1
    )
      return "/account";
    destination = safeBookingReturnPath(intent.searchParams.get("next"));
  }
  const privateWorkflow =
    new URL(destination, base).pathname === "/bookings/new";
  const scope = privateBookingScopeFromReturnPath(destination);
  const selection = selectionFromReturnPath(destination);
  if (selection)
    return withPrivateBookingScope(
      bookingSelectionHref(selection, privateWorkflow),
      scope,
    );
  const discovery = discoveryFromReturnPath(destination);
  if (discovery)
    return withPrivateBookingScope(
      bookingDiscoveryHref(discovery, privateWorkflow),
      scope,
    );
  return privateWorkflow && scope
    ? withPrivateBookingScope("/bookings/new", scope)
    : "/account";
}

export function studentOnboardingHref(next?: unknown) {
  const destination = studentContinuation(next);
  return destination === "/account"
    ? studentOnboardingPath
    : `${studentOnboardingPath}?${new URLSearchParams({ next: destination })}`;
}

export function independentAdmissionHref(next?: unknown) {
  const destination = studentContinuation(next);
  const query = new URLSearchParams({ management: "self" });
  if (destination !== "/account")
    query.set("next", privateBookingHref(destination));
  return `/learner-admission/new?${query}`;
}

/** Reopening keeps this visit's public choice separate from the saved receipt. */
export function studentAdmissionRequestHref(
  admissionId: string,
  next?: unknown,
) {
  const path = `/learner-admission/${encodeURIComponent(admissionId)}`;
  const destination = studentContinuation(next);
  return destination === "/account"
    ? path
    : `${path}?${new URLSearchParams({ next: destination })}`;
}

/** Query intent selects a form default, never a trusted management/role grant. */
export function initialAdmissionManagement(
  value: unknown,
): "self" | "guardian" {
  return value === "self" ? "self" : "guardian";
}
