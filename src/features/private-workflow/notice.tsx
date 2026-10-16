import {
  demoStateLabels,
  type BookingState,
} from "@/features/bookings/lifecycle-model";

const privateBookingLabels: Partial<Record<BookingState, string>> = {
  provisional: "Provisional booking",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show recorded",
  expired: "Expired",
  cancelled: "Cancelled",
  replaced: "Rescheduled",
};

/** Presentation only; legacy fixture states retain their original labels. */
export function bookingStatusLabel(
  state: BookingState,
  privateWorkflow = false,
) {
  return privateWorkflow
    ? (privateBookingLabels[state] ?? demoStateLabels[state])
    : demoStateLabels[state];
}

export function PrivateWorkflowNotice() {
  return (
    <aside aria-label="Private staging" className="page-shell pt-6">
      <p className="rounded-control border border-border bg-subtle px-4 py-3 text-small">
        Private staging — fictional test data only. Payments are disabled.
      </p>
    </aside>
  );
}
