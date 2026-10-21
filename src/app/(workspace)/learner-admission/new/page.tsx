import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/permissions/access";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
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
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { privateBookingHref } from "@/features/bookings/selection";
import {
  initialAdmissionManagement,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";
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
  const context = await loadPrivatePage(path, async (runtime, headers) => {
    const localWorkflow = getLocalWorkflow(runtime) !== null;
    if (localWorkflow) {
      const identity = await requireIdentity(runtime, headers);
      return {
        redirectTo:
          initialManagement !== "self" && identity.roles.includes("parent")
            ? canonicalNext
              ? `/parent/children/new?next=${encodeURIComponent(privateBookingHref(canonicalNext))}`
              : "/parent/children/new"
            : studentOnboardingHref(
                canonicalNext ? privateBookingHref(canonicalNext) : undefined,
              ),
      };
    }
    return {
      redirectTo: null,
      ...(await readAdmissionIntake(admissionContext(runtime), headers)),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow,
    };
  });
  if (!context)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open admission intake on this account."
      />
    );
  if (context.redirectTo !== null) redirect(context.redirectTo);
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
            {context.localWorkflow
              ? "Collect only the learner information needed to arrange tutoring. An assigned reviewer must check guardian authority or independent eligibility before access is granted."
              : privateWorkflow
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
