import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { WorkflowBookingPage } from "@/features/booking-workflows/page";
import type { Metadata } from "next";
import { AdmissionDetour } from "@/features/learner-admission/detour";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { loadDemoBookingResume } from "@/features/bookings/resume";
import {
  parsePublicBookingSelection,
  bookingSelectionHref,
  parsePublicBookingDiscovery,
  bookingDiscoveryHref,
  type SearchValues,
} from "@/features/bookings/selection";
import { DemoBookingForm } from "@/features/bookings/demo-booking-form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Simulated booking",
  robots: { index: false, follow: false },
};
export default async function DemoBookingPage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const params = await searchParams;
  const choice = parsePublicBookingSelection(params);
  const discovery = parsePublicBookingDiscovery(params);
  const returnTo = choice
    ? bookingSelectionHref(choice)
    : discovery
      ? bookingDiscoveryHref(discovery)
      : "/bookings/demo";
  const policyPage = await loadPrivatePage(
    returnTo,
    async (runtime, headers) =>
      bookingWorkflowContext(runtime).booking.authority !== "disabled"
        ? {
            page: await WorkflowBookingPage({
              runtime,
              headers,
              query: params,
            }),
          }
        : null,
  );
  if (policyPage) return policyPage.page;
  const resumed = await loadPrivatePage(returnTo, (runtime, headers) =>
    loadDemoBookingResume(runtime, headers, choice),
  );
  if (!resumed)
    return (
      <>
        <UnavailablePage
          title="Simulated bookings unavailable"
          message="We cannot open simulated bookings on this account. Return to your account or try again later."
        />
        <AdmissionDetour choice={choice} discovery={discovery} />
      </>
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Simulated booking</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Local testing with fictional accounts only. This creates a temporary
        simulated reservation, with no confirmed lesson or payment.
      </p>
      {!resumed.options.learners.length && (
        <AdmissionDetour choice={choice} discovery={discovery} />
      )}
      <DemoBookingForm
        options={resumed.options}
        prefill={resumed.choice}
        prefilledTimes={resumed.times}
        requestedTime={resumed.requestedTime}
        initialNotice={
          resumed.message ||
          (Object.keys(params).length && !choice
            ? "The booking choice could not be used. Choose a tutor, subject and time again."
            : "")
        }
        zones={listTimeZoneOptions(new Date(), [
          resumed.choice?.displayTimezone ?? resumed.options.timezone,
        ])}
      />
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
