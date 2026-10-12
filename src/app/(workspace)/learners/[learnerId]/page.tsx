import type { Metadata } from "next";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readMyLearner } from "@/features/learners/service";
import { LearnerForm } from "@/features/learners/learner-form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit learner profile",
  robots: { index: false, follow: false },
};
export default async function LearnerPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  const profile = await loadPrivatePage(
    `/learners/${encodeURIComponent(learnerId)}`,
    (runtime, headers) => readMyLearner(runtime, headers, learnerId),
  );
  if (!profile)
    return (
      <UnavailablePage
        title="Learner profile unavailable"
        message="We cannot find that learner profile on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <LearnerLink
        className="inline-flex min-h-11 items-center"
        href="/learners"
        label="Your learners"
      />
      <h1 className="mt-4 text-page-title">Edit learner profile</h1>
      <p className="mt-4 max-w-prose text-body wrap-anywhere">
        Profile for {profile.displayName}
      </p>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        Local testing only. Use fictional learner details.
      </p>
      <LearnerForm
        profile={profile}
        zones={listTimeZoneOptions(new Date(), [profile.timezone])}
      />
    </div>
  );
}
