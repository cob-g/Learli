import { randomUUID } from "node:crypto";
import { admissionContext } from "@/features/learner-admission/context";
import { AccessError } from "@/lib/permissions/access";
import type { Metadata } from "next";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readLearnerCreationContext } from "@/features/learners/service";
import { CreateLearnerForm } from "@/features/learners/create-learner-form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import {
  bookingSelectionHref,
  selectionFromReturnPath,
  privateBookingHref,
} from "@/features/bookings/selection";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import "@/features/parent-children/parent-pages.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create a local learner",
  robots: { index: false, follow: false },
};
export default async function CreateLearnerPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const rawNext = (await searchParams).next;
  const runtime = await getDomainAuthRuntime();
  if (runtime && hasPersistentWorkflow(runtime)) {
    const next = canonicalAdmissionSelection(rawNext);
    redirect(
      next
        ? `/learner-admission/new?next=${encodeURIComponent(privateBookingHref(next))}`
        : "/learner-admission/new",
    );
  }
  const selection = selectionFromReturnPath(rawNext);
  const returnToBooking = selection
    ? bookingSelectionHref(selection)
    : undefined;
  const context = await loadPrivatePage(
    returnToBooking
      ? `/learners/new?next=${encodeURIComponent(returnToBooking)}`
      : "/learners/new",
    async (runtime, headers) => {
      const admissionEnabled =
        admissionContext(runtime).admission.authority === "synthetic_test";
      try {
        return {
          ...(await readLearnerCreationContext(runtime, headers)),
          admissionEnabled,
          demoUnavailable: false,
        };
      } catch (error) {
        if (
          admissionEnabled &&
          error instanceof AccessError &&
          error.status === 403
        )
          return {
            modes: [],
            timezone: "UTC",
            admissionEnabled,
            demoUnavailable: true,
          };
        throw error;
      }
    },
  );
  if (!context)
    return (
      <UnavailablePage
        title="Learner profiles unavailable"
        message="We cannot open learner profiles on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Student workspace</p>
          <h1>Create a local learner</h1>
          <p>
            Local demonstration only: use fictional learner details. This flow
            does not verify real consent, age or guardian identity.
          </p>
        </div>
        <LearnerLink
          className="pp-link"
          href="/learners"
          label="Your learners"
        />
      </header>
      {context.admissionEnabled && (
        <LearnerLink
          href={
            returnToBooking
              ? `/learner-admission/new?next=${encodeURIComponent(returnToBooking)}`
              : "/learner-admission/new"
          }
          className="action action-outline pp-submit"
          label="Request separate admission review"
        />
      )}
      {context.modes.length ? (
        <CreateLearnerForm
          requestId={randomUUID()}
          modes={context.modes}
          timezone={context.timezone || "UTC"}
          zones={listTimeZoneOptions(new Date(), [context.timezone || "UTC"])}
          returnToBooking={returnToBooking}
        />
      ) : (
        <section className="workspace-blank">
          <span className="pp-icon" aria-hidden="true">
            <UsersRound size={20} />
          </span>
          <h2>
            {context.demoUnavailable
              ? "A local demonstration role is required"
              : "Your local profile already exists"}
          </h2>
          <p>
            {context.demoUnavailable
              ? "Use the separate admission review to request a synthetic learner relationship."
              : "Return to your learners to edit your existing profile."}
          </p>
        </section>
      )}
    </div>
  );
}
