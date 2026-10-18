import type { Metadata } from "next";
import Link from "next/link";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readLearnerCreationContext } from "@/features/learners/service";
import { listLearnerGroups } from "@/features/learners/composition";
import { levelNames } from "@/features/subjects/catalog";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your learners",
  robots: { index: false, follow: false },
};
export default async function LearnersPage() {
  const groups = await loadPrivatePage(
    "/learners",
    async (runtime, headers) => {
      const base = await listLearnerGroups(runtime, headers);
      // Same mode check /learners/new uses, so the button only leads
      // somewhere it can create a profile.
      const createModes = base.demoAllowed
        ? await readLearnerCreationContext(runtime, headers)
            .then((context) => context.modes)
            .catch(() => [])
        : [];
      return {
        ...base,
        createModes,
        privateWorkflow: hasPersistentWorkflow(runtime),
      };
    },
  );
  if (!groups)
    return (
      <UnavailablePage
        title="Learner profiles unavailable"
        message="We cannot open learner profiles on this account. Return to your account or try again later."
      />
    );
  const learners = [...groups.demo, ...groups.readiness];
  const { privateWorkflow } = groups;
  const canCreate =
    !privateWorkflow && groups.demoAllowed && groups.createModes.length > 0;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your learners</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        {privateWorkflow
          ? "Only learners with current authorized access appear here. Check admission requests for pending reviews."
          : "Local testing only. Use fictional learner details."}
      </p>
      {learners.length ? (
        <ul className="mt-8 max-w-5xl divide-y divide-border">
          {learners.map((learner) => (
            <li
              key={learner.id}
              className="flex min-w-0 flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="text-item-title wrap-anywhere">
                  {learner.displayName}
                </h2>
                <p className="mt-2 text-caption">
                  {groups.readiness.some((row) => row.id === learner.id)
                    ? privateWorkflow
                      ? "Reviewed admission"
                      : "Synthetic reviewed admission"
                    : "Local demonstration"}
                </p>
                <p className="mt-2 text-body">
                  {levelNames([learner.level]).join()}
                  {learner.grade != null ? ` · Grade ${learner.grade}` : ""}
                </p>
              </div>
              <LearnerLink
                className="action action-outline shrink-0"
                href={`/learners/${learner.id}`}
                ariaLabel={`Edit profile for ${learner.displayName}`}
                label="Edit profile"
              />
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">No learner profiles available</h2>
          <p className="mt-2 text-body">
            {privateWorkflow
              ? "Request an admission review to add a learner. A pending request does not grant profile or booking access."
              : "This account has no authorized local learner profiles. Create a fictional profile for the local demonstration."}
          </p>
        </section>
      )}
      {canCreate && (
        <LearnerLink
          className="action action-primary mt-8"
          href="/learners/new"
          label="Create a local learner"
        />
      )}
      {groups.admissionEnabled && (
        <LearnerLink
          href="/learner-admission/new"
          className={
            privateWorkflow
              ? "action action-primary mt-8"
              : "action action-outline ms-4 mt-8"
          }
          label={privateWorkflow ? "Add a learner" : "Request admission review"}
        />
      )}
      {privateWorkflow && (
        <LearnerLink
          href="/learner-admission"
          className="ms-4 mt-8 inline-flex min-h-11 items-center"
          label="Admission requests"
        />
      )}
      <Link
        className="ms-4 mt-8 inline-flex min-h-11 items-center"
        href="/account"
      >
        Account settings
      </Link>
    </div>
  );
}
