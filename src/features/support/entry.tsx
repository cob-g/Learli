import "server-only";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuthRuntime } from "@/lib/auth";
import { AccessError } from "@/lib/permissions/access";
import { listCases } from "./service";
import { DemoNotice } from "./presentation";
import { CaseForm } from "./case-form";
import { readBookingForReport } from "@/features/support-bookings/service";
import { SupportBookingSection } from "@/features/support-bookings/presentation";
import type { SupportBookingContext } from "@/features/support-bookings/model";

export async function SupportEntry({
  concern = false,
  bookingId,
}: {
  concern?: boolean;
  bookingId?: string;
}) {
  let available = false,
    anonymous = false;
  let booking: SupportBookingContext | undefined;
  try {
    const runtime = getAuthRuntime();
    if (runtime) {
      await listCases(runtime, await headers(), "requester");
      if (bookingId !== undefined)
        booking = await readBookingForReport(
          runtime,
          await headers(),
          bookingId,
        );
      available = true;
    }
  } catch (error) {
    anonymous = error instanceof AccessError && error.status === 401;
  }
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {concern ? "Report a concern" : "Contact support"}
      </h1>
      <DemoNotice />
      {available ? (
        <>
          {booking && <SupportBookingSection booking={booking} />}
          <CaseForm concern={concern} bookingId={bookingId} />
          <Link
            href="/support"
            className="mt-8 inline-flex min-h-11 items-center"
          >
            Your reports
          </Link>
        </>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">
            {bookingId !== undefined && !anonymous
              ? "Booking context unavailable"
              : anonymous
                ? "Sign in for fictional testing"
                : "Local reporting unavailable"}
          </h2>
          <p className="mt-2 text-body">
            {anonymous
              ? "Use an active verified synthetic account to save a fictional report."
              : bookingId !== undefined
                ? "This booking context is unavailable. You can try a standalone fictional report. Real support operations remain unavailable."
                : "This account cannot use local reporting. Real support operations remain unavailable."}
          </p>
          {anonymous && (
            <Link
              className="action action-primary mt-4"
              href={`/sign-in?next=${encodeURIComponent(concern ? "/report-a-concern" : "/contact")}`}
            >
              Sign in
            </Link>
          )}
          {bookingId !== undefined && !anonymous && (
            <Link
              className="mt-4 inline-flex min-h-11 items-center"
              href={concern ? "/report-a-concern" : "/contact"}
            >
              Create a standalone fictional report
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
