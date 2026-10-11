import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { loadDemoBookingOptions } from "@/features/bookings/service";
import { DemoBookingForm } from "@/features/bookings/demo-booking-form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Simulated booking",
  robots: { index: false, follow: false },
};
export default async function DemoBookingPage() {
  const options = await loadPrivatePage(
    "/bookings/demo",
    loadDemoBookingOptions,
  );
  if (!options)
    return (
      <UnavailablePage
        title="Simulated bookings unavailable"
        message="We cannot open simulated bookings on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Simulated booking</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Local testing with fictional accounts only. This creates a temporary
        simulated reservation, with no confirmed lesson or payment.
      </p>
      <DemoBookingForm
        options={options}
        zones={listTimeZoneOptions(new Date(), [options.timezone])}
      />
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
