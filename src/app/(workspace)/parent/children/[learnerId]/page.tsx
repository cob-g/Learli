import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { readComposedLearner } from "@/features/learners/composition";
import { LearnerForm } from "@/features/learners/learner-form";
import { LearnerLink } from "@/features/learners/learner-link";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit child profile",
  robots: { index: false, follow: false },
};

export default async function ChildProfilePage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  const result = await loadPrivatePage(
    `/parent/children/${encodeURIComponent(learnerId)}`,
    async (runtime, headers) => {
      const identity = await requireIdentity(runtime, headers);
      if (!identity.roles.includes("parent")) throw new AccessError(403);
      const resolved = await readComposedLearner(runtime, headers, learnerId);
      if (resolved.profile.management !== "guardian")
        throw new AccessError(404);
      return {
        ...resolved,
        privateWorkflow: hasPersistentWorkflow(runtime),
        ordinaryParent: getLocalWorkflow(runtime) !== null,
      };
    },
  );
  if (!result)
    return (
      <UnavailablePage
        title="Child profile unavailable"
        message="We cannot find an authorized child profile on this account. Return to My Children or try again later."
      />
    );
  const { profile, reviewed, privateWorkflow, ordinaryParent } = result;
  return (
    <div className="page-shell page-space">
      <LearnerLink
        href="/parent/children"
        label="My Children"
        className="inline-flex min-h-11 items-center"
      />
      <h1 className="mt-4 text-page-title">Edit child profile</h1>
      <p className="mt-4 max-w-prose text-body wrap-anywhere">
        Profile for {profile.displayName}
      </p>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">
        {ordinaryParent
          ? "Your child’s private profile. Save permitted details and grade changes here."
          : reviewed
            ? "Authorized — current reviewed access. The reviewed education level cannot be changed here."
            : "Saved for local testing. Use fictional child details."}
      </p>
      {privateWorkflow && !ordinaryParent && (
        <p className="mt-2 max-w-prose text-small text-muted-foreground">
          This staging profile does not establish real consent or guardian
          identity.
        </p>
      )}
      <LearnerForm
        profile={profile}
        reviewed={reviewed}
        zones={listTimeZoneOptions(new Date(), [profile.timezone])}
      />
    </div>
  );
}
