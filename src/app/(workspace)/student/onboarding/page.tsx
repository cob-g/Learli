import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { LearnerLink } from "@/features/learners/learner-link";
import { readStudentOnboarding } from "@/features/student-onboarding/read";
import {
  independentAdmissionHref,
  studentContinuation,
  studentAdmissionRequestHref,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";
import { IndependentLearnerForm } from "@/features/independent-learner/form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up your Student profile",
  robots: { index: false, follow: false },
};
export default async function StudentOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = (await searchParams).next;
  const context = await loadPrivatePage(
    studentOnboardingHref(next),
    readStudentOnboarding,
  );
  if (!context)
    return (
      <UnavailablePage
        title="College Student setup unavailable"
        message="Verify your email and check your account access before continuing."
      />
    );
  if (context.admissionId)
    redirect(studentAdmissionRequestHref(context.admissionId, next));
  if (context.existingLearnerId) {
    const destination = studentContinuation(next);
    redirect(destination === "/account" ? "/student" : destination);
  }
  return (
    <div className="page-shell page-space">
      <div className="max-w-xl">
        {/* Ordinary local V2 creates the profile directly; the earlier private
            path still sends a request for an assigned review (ui-context). */}
        {context.kind === "independent" ? (
          <>
            <h1 className="text-page-title">Set up your Student profile</h1>
            <p className="mt-4 text-body">
              Create your own College Support learner profile when you are
              legally eligible to manage a tutoring account independently.
            </p>
            <p className="mt-4 text-body">
              College Support is an education level. It does not establish that
              you are an adult or otherwise legally eligible, and this setup
              does not create a guardian relationship.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-page-title">Set up College Student</h1>
            <p className="mt-4 text-body">
              Request your own College Support learner profile. Choosing College
              Student does not grant a workspace or booking access.
            </p>
            <p className="mt-4 text-body">
              An assigned reviewer must authorize independent eligibility. A
              pending request does not grant learner access, and no guardian
              relationship is created for an independent learner.
            </p>
          </>
        )}
        {context.enabled ? (
          context.kind === "independent" ? (
            <IndependentLearnerForm
              requestId={randomUUID()}
              policyVersion={context.policyVersion}
              policyDigest={context.policyDigest}
              noticeVersion={context.noticeVersion}
              timezone={context.timezone}
              zones={listTimeZoneOptions(new Date(), [context.timezone])}
              next={
                studentContinuation(next) === "/account"
                  ? undefined
                  : studentContinuation(next)
              }
            />
          ) : (
            <>
              <p className="mt-4 text-small text-muted-foreground">
                Use fictional details in private staging. This review does not
                establish real age, identity or eligibility. Your selected tutor
                and time will be checked again; no time is reserved.
              </p>
              <LearnerLink
                className="action action-primary mt-8"
                href={independentAdmissionHref(next)}
                label="Request independent admission"
              />
            </>
          )
        ) : (
          <p className="mt-8 text-body">
            Independent Student setup is unavailable. No learner details are
            collected. Check your account status or return later.
          </p>
        )}
        <Link
          href="/account"
          className="mt-6 inline-flex min-h-11 items-center"
        >
          Back to account settings
        </Link>
      </div>
    </div>
  );
}
