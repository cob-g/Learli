import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { readParentChildIntake } from "@/features/parent-children/service";
import { ParentChildForm } from "@/features/parent-children/form";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { privateBookingHref } from "@/features/bookings/selection";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { admissionContext } from "@/features/learner-admission/context";
import { AdmissionForm } from "@/features/learner-admission/forms";
import { readAdmissionIntake } from "@/features/learner-admission/service";
import { CreateLearnerForm } from "@/features/learners/create-learner-form";
import { LearnerLink } from "@/features/learners/learner-link";
import { readLearnerCreationContext } from "@/features/learners/service";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Child",
  robots: { index: false, follow: false },
};

export default async function AddChildPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const selected = canonicalAdmissionSelection((await searchParams)?.next);
  const next = selected ? privateBookingHref(selected) : undefined;
  const result = await loadPrivatePage(
    next
      ? `/parent/children/new?next=${encodeURIComponent(next)}`
      : "/parent/children/new",
    async (runtime, headers) => {
      const identity = await requireIdentity(runtime, headers);
      if (!identity.roles.includes("parent")) throw new AccessError(403);
      if (getLocalWorkflow(runtime))
        return {
          kind: "parent" as const,
          intake: await readParentChildIntake(runtime, headers),
        };
      if (hasPersistentWorkflow(runtime))
        return {
          kind: "admission" as const,
          intake: await readAdmissionIntake(admissionContext(runtime), headers),
        };
      const creation = await readLearnerCreationContext(runtime, headers);
      if (!creation.modes.includes("guardian")) throw new AccessError(403);
      return { kind: "local" as const, timezone: creation.timezone || "UTC" };
    },
  );
  if (!result)
    return (
      <UnavailablePage
        title="Add Child unavailable"
        message="We cannot add a child on this parent account. Return to My Children or check your sign-in status."
      />
    );
  return (
    <div className="page-shell page-space">
      <LearnerLink
        href="/parent/children"
        label="My Children"
        className="inline-flex min-h-11 items-center"
      />
      <h1 className="mt-4 text-page-title">Add Child</h1>
      <p className="mt-4 max-w-prose text-body">
        {result.kind === "parent"
          ? "Create a private profile for your child. Confirm your guardian authority and consent, then save to start arranging tutoring."
          : result.kind === "admission"
            ? "Save your child’s details for an assigned admission review. Access stays pending until authorized."
            : "Save a fictional child profile for local testing. This does not verify real consent, age or guardian identity."}
      </p>
      <p className="mt-3 max-w-prose text-small text-muted-foreground">
        Grade is optional; choose the broad education level separately. Only
        provide information needed to arrange tutoring.
      </p>
      {result.kind === "parent" ? (
        result.intake.enabled ? (
          <ParentChildForm
            requestId={randomUUID()}
            policyVersion={result.intake.policyVersion}
            policyDigest={result.intake.policyDigest}
            noticeVersion={result.intake.noticeVersion}
            timezone={result.intake.timezone}
            zones={listTimeZoneOptions(new Date(), [result.intake.timezone])}
            next={next}
          />
        ) : (
          <p className="mt-8 text-body">
            Adding children is temporarily unavailable. Your existing profiles
            are unchanged; return to My Children or try again later.
          </p>
        )
      ) : result.kind === "admission" ? (
        result.intake.enabled ? (
          <div className="mt-8 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
            <AdmissionForm
              requestId={randomUUID()}
              policyVersion={result.intake.policyVersion}
              policyDigest={result.intake.policyDigest}
              zones={listTimeZoneOptions(new Date(), ["UTC"])}
              privateWorkflow
              parentChildFlow
            />
          </div>
        ) : (
          <p className="mt-8 text-body">
            Admission intake is unavailable. No child details are collected.
          </p>
        )
      ) : (
        <CreateLearnerForm
          requestId={randomUUID()}
          modes={["guardian"]}
          timezone={result.timezone}
          zones={listTimeZoneOptions(new Date(), [result.timezone])}
          parentChildFlow
        />
      )}
    </div>
  );
}
