import "server-only";
import {
  bookingSelectionHref,
  type PublicBookingSelection,
  type PublicBookingDiscovery,
  bookingDiscoveryHref,
} from "@/features/bookings/selection";
/** Public selection only; admission rechecks policy before displaying child inputs.
 * Native navigation starts a new private document and never reserves a time. */
export function AdmissionDetour({
  choice,
  discovery = null,
}: {
  choice: PublicBookingSelection | null;
  discovery?: PublicBookingDiscovery | null;
}) {
  const next = choice
    ? bookingSelectionHref(choice)
    : discovery
      ? bookingDiscoveryHref(discovery)
      : null;
  const href = next
    ? `/learner-admission/new?next=${encodeURIComponent(next)}`
    : "/learner-admission/new";
  return (
    <div className="page-shell">
      <a className="mb-8 inline-flex min-h-11 items-center" href={href}>
        Learner admission and review
      </a>
      <p className="mb-8 max-w-prose text-body">
        Admission requires an available policy and assigned review. Selecting
        this path grants no learner access or reserved time.
      </p>
    </div>
  );
}
