import { randomUUID } from "node:crypto";
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
} from "@/features/bookings/selection";
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
  const selection = selectionFromReturnPath((await searchParams).next);
  const returnToBooking = selection
    ? bookingSelectionHref(selection)
    : undefined;
  const context = await loadPrivatePage(
    returnToBooking
      ? `/learners/new?next=${encodeURIComponent(returnToBooking)}`
      : "/learners/new",
    readLearnerCreationContext,
  );
  if (!context)
    return (
      <UnavailablePage
        title="Learner profiles unavailable"
        message="We cannot open learner profiles on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <LearnerLink
        className="inline-flex min-h-11 items-center"
        href="/learners"
        label="Your learners"
      />
      <h1 className="mt-4 text-page-title">Create a local learner</h1>
      <p className="mt-4 max-w-prose text-body">
        Local demonstration only: use fictional learner details. This flow does
        not verify real consent, age or guardian identity.
      </p>
      {context.modes.length ? (
        <CreateLearnerForm
          requestId={randomUUID()}
          modes={context.modes}
          timezone={context.timezone || "UTC"}
          zones={listTimeZoneOptions(new Date(), [context.timezone || "UTC"])}
          returnToBooking={returnToBooking}
        />
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">Your local profile already exists</h2>
          <p className="mt-2 text-body">
            Return to your learners to edit your existing profile.
          </p>
        </section>
      )}
    </div>
  );
}
