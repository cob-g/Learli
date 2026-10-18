import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { WorkflowBookingPage } from "@/features/booking-workflows/page";
import {
  bookingDiscoveryHref,
  bookingSelectionHref,
  parsePublicBookingDiscovery,
  parsePublicBookingSelection,
  type SearchValues,
} from "@/features/bookings/selection";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { loadPrivatePage } from "@/lib/permissions/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request a booking",
  robots: { index: false, follow: false },
};

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const query = await searchParams;
  // A learner ID is private. Only validated public choices cross sign-in.
  const publicQuery = Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "learnerId"),
  );
  const choice = parsePublicBookingSelection(publicQuery);
  const discovery = parsePublicBookingDiscovery(publicQuery);
  const returnTo = choice
    ? bookingSelectionHref(choice, true)
    : discovery
      ? bookingDiscoveryHref(discovery, true)
      : "/bookings/new";
  const result = await loadPrivatePage(returnTo, async (runtime, headers) => {
    if (
      !hasPersistentWorkflow(runtime) ||
      bookingWorkflowContext(runtime).booking.authority === "disabled"
    )
      return null;
    return {
      page: await WorkflowBookingPage({
        runtime,
        headers,
        query,
        privateWorkflow: true,
      }),
    };
  });
  return result ? (
    result.page
  ) : (
    <UnavailablePage
      title="Booking request unavailable"
      message="We cannot open booking requests on this account. Return to your account or try again later."
    />
  );
}
