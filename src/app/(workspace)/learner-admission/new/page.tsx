import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { readAdmissionIntake } from "@/features/learner-admission/service";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { AdmissionForm } from "@/features/learner-admission/forms";
import { LearnerLink } from "@/features/learners/learner-link";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import { privateBookingHref } from "@/features/bookings/selection";
import { initialAdmissionManagement } from "@/features/student-onboarding/continuation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request learner admission",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    management?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const canonicalNext = canonicalAdmissionSelection(params.next);
  const initialManagement = initialAdmissionManagement(params.management);
  const query = new URLSearchParams();
  if (initialManagement === "self") query.set("management", "self");
  if (canonicalNext) query.set("next", canonicalNext);
  const path = `/learner-admission/new${query.size ? `?${query}` : ""}`;
  const context = await loadPrivatePage(path, async (runtime, headers) => ({
    ...(await readAdmissionIntake(admissionContext(runtime), headers)),
    privateWorkflow: isPrivateWorkflow(runtime),
  }));
  if (!context)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open admission intake on this account."
      />
    );
  const { privateWorkflow } = context;
  const next =
    canonicalNext && privateWorkflow
      ? privateBookingHref(canonicalNext)
      : canonicalNext;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Request learner admission</h1>
      <p className="mt-4 max-w-prose text-body">
        {privateWorkflow
          ? "Add the learner details for an assigned review. The request stays pending until a reviewer authorizes access."
          : "Real admission is disabled until current guardian and independent eligibility policies are approved."}
      </p>
      {context.enabled ? (
        <>
          <p className="mt-4 max-w-prose rounded-control border border-border bg-subtle p-4 text-small text-muted-foreground">
            {privateWorkflow
              ? "Use fictional learner details. This staging review does not establish real age, consent or guardian identity."
              : "Synthetic readiness only. Use fictional details. A review does not establish real age, consent or guardian identity."}
          </p>
          <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
            <AdmissionForm
              requestId={randomUUID()}
              policyVersion={context.policyVersion}
              policyDigest={context.policyDigest}
              zones={listTimeZoneOptions(new Date(), ["UTC"])}
              next={next ?? undefined}
              privateWorkflow={privateWorkflow}
              initialManagement={initialManagement}
            />
          </div>
        </>
      ) : (
        <p className="mt-8 max-w-prose text-body">
          Admission intake is unavailable. No learner details are collected.
        </p>
      )}
      {next && (
        <LearnerLink
          href={next}
          label="Return to selected tutor and time"
          className="mt-8 inline-flex min-h-11 items-center"
        />
      )}
      <LearnerLink
        href="/learner-admission"
        label="Your admission requests"
        className="me-6 mt-8 inline-flex min-h-11 items-center"
      />
    </div>
  );
}
