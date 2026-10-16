import "server-only";
import { LearnerLink } from "@/features/learners/learner-link";
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
  privateWorkflow = false,
}: {
  choice: PublicBookingSelection | null;
  discovery?: PublicBookingDiscovery | null;
  privateWorkflow?: boolean;
}) {
  const next = choice
    ? bookingSelectionHref(choice, privateWorkflow)
    : discovery
      ? bookingDiscoveryHref(discovery, privateWorkflow)
      : null;
  const href = next
    ? `/learner-admission/new?next=${encodeURIComponent(next)}`
    : "/learner-admission/new";
  return (
    <div className="page-shell">
      <a className="mb-8 inline-flex min-h-11 items-center" href={href}>
        {privateWorkflow
          ? "Add a learner for review"
          : "Learner admission and review"}
      </a>
      <p className="mb-8 max-w-prose text-body">
        {privateWorkflow
          ? "A learner must be authorized before you can book. Submit an admission request or check a pending review. Your selected time is not reserved."
          : "Admission requires an available policy and assigned review. Selecting this path grants no learner access or reserved time."}
      </p>
      {privateWorkflow && (
        <LearnerLink
          className="mb-8 inline-flex min-h-11 items-center"
          href="/learner-admission"
          label="View admission requests"
        />
      )}
    </div>
  );
}
