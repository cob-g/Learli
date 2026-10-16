import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { LearnerLink } from "@/features/learners/learner-link";
import { readStudentOnboarding } from "@/features/student-onboarding/read";
import {
  independentAdmissionHref,
  studentAdmissionRequestHref,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up College Student",
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
  return (
    <div className="page-shell page-space">
      <div className="max-w-xl">
        <h1 className="text-page-title">Set up College Student</h1>
        <p className="mt-4 text-body">
          Request your own College Support learner profile. Choosing College
          Student does not grant a workspace or booking access.
        </p>
        <p className="mt-4 text-body">
          An assigned reviewer must authorize independent eligibility. A pending
          request does not grant learner access, and no guardian relationship is
          created for an independent learner.
        </p>
        {context.enabled ? (
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
        ) : (
          <p className="mt-8 text-body">
            Independent admission is unavailable. No learner details are
            collected. Real eligibility and operating policies must be approved
            before real learners can use this flow.
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
