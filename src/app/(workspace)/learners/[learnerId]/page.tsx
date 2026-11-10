import type { Metadata } from "next";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readComposedLearner } from "@/features/learners/composition";
import { LearnerForm } from "@/features/learners/learner-form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import "@/features/parent-children/parent-pages.css";
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
  const context = await loadPrivatePage(
    `/learners/${encodeURIComponent(learnerId)}`,
    async (runtime, headers) => ({
      ...(await readComposedLearner(runtime, headers, learnerId)),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  if (!context)
    return (
      <UnavailablePage
        title="Learner profile unavailable"
        message="We cannot find that learner profile on this account. Return to your account or try again later."
      />
    );
  const { profile, reviewed } = context;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Student workspace</p>
          <h1>Edit learner profile</h1>
          <p className="wrap-anywhere">Profile for {profile.displayName}</p>
          {!context.privateWorkflow && (
            <p className="mt-2 text-small text-muted-foreground">
              Local testing only. Use fictional learner details.
            </p>
          )}
        </div>
        <LearnerLink
          className="pp-link"
          href="/learners"
          label="Your learners"
        />
      </header>
      <LearnerForm
        profile={profile}
        reviewed={reviewed}
        editableLevel={
          context.localWorkflow && profile.management === "guardian"
        }
        zones={listTimeZoneOptions(new Date(), [profile.timezone])}
      />
    </div>
  );
}
