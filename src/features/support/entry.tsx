import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import "server-only";
import Link from "next/link";
import { z } from "zod";
import { headers } from "next/headers";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
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
    anonymous = false,
    privateWorkflow = false,
    localWorkflow = false;
  let booking: SupportBookingContext | undefined;
  try {
    const runtime = await getDomainAuthRuntime();
    if (runtime) {
      privateWorkflow = hasPersistentWorkflow(runtime);
      localWorkflow = getLocalWorkflow(runtime) !== null;
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
  const base = concern ? "/report-a-concern" : "/contact";
  // Same uuid rule the booking lookup applies; anything else is dropped.
  const returnTo =
    bookingId !== undefined && z.uuid().safeParse(bookingId).success
      ? `${base}?bookingId=${encodeURIComponent(bookingId)}`
      : base;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {concern ? "Report a concern" : "Contact support"}
      </h1>
      <DemoNotice
        privateWorkflow={privateWorkflow}
        localWorkflow={localWorkflow}
      />
      {available ? (
        <>
          {booking && (
            <SupportBookingSection
              booking={booking}
              privateWorkflow={privateWorkflow}
            />
          )}
          <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
            <CaseForm
              concern={concern}
              bookingId={bookingId}
              localWorkflow={localWorkflow}
            />
          </div>
          <Link
            href="/support"
            className="mt-8 inline-flex min-h-11 items-center"
          >
            Your reports
          </Link>
        </>
      ) : (
        <section className="mt-6 max-w-prose rounded-surface border border-border bg-surface p-6">
          <h2 className="text-item-title">
            {bookingId !== undefined && !anonymous
              ? "Booking context unavailable"
              : anonymous
                ? localWorkflow
                  ? "Sign in for support"
                  : "Sign in for fictional testing"
                : "Local reporting unavailable"}
          </h2>
          <p className="mt-2 text-body">
            {anonymous
              ? localWorkflow
                ? "Sign in with an active verified account to save a report."
                : privateWorkflow
                  ? "Use an active verified test account to save a fictional report."
                  : "Use an active verified synthetic account to save a fictional report."
              : localWorkflow
                ? "This report cannot be opened on your current account. Check your sign-in status or try again."
                : bookingId !== undefined
                  ? "This booking context is unavailable. You can try a standalone fictional report. Real support operations remain unavailable."
                  : "This account cannot use local reporting. Real support operations remain unavailable."}
          </p>
          {anonymous && (
            <Link
              className="action action-primary mt-4"
              href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
            >
              Sign in
            </Link>
          )}
          {bookingId !== undefined && !anonymous && (
            <Link
              className="mt-4 inline-flex min-h-11 items-center"
              href={concern ? "/report-a-concern" : "/contact"}
            >
              {localWorkflow
                ? "Create a standalone report"
                : "Create a standalone fictional report"}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
