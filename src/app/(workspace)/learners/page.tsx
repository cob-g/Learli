import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { requireIdentity } from "@/lib/permissions/access";
import type { Metadata } from "next";
import Link from "next/link";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readLearnerCreationContext } from "@/features/learners/service";
import { listLearnerGroups } from "@/features/learners/composition";
import { levelNames } from "@/features/subjects/catalog";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { Plus, UsersRound } from "lucide-react";
import { nameInitials } from "@/lib/initials";
import "@/features/parent-children/parent-pages.css";
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
      const localWorkflow = getLocalWorkflow(runtime) !== null;
      const ordinaryParent =
        localWorkflow &&
        (await requireIdentity(runtime, headers)).roles.includes("parent");
      return {
        ...base,
        ordinaryParent,
        localWorkflow,
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
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {groups.ordinaryParent ? "Parent workspace" : "Student workspace"}
          </p>
          <h1>Your learners</h1>
          <p>
            {groups.ordinaryParent
              ? "Your private child profiles are ready for tutoring when current guardian access is authorized."
              : groups.localWorkflow
                ? "Only learners with current authorized access appear here."
                : privateWorkflow
                  ? "Only learners with current authorized access appear here. Check admission requests for pending reviews."
                  : "Local testing only. Use fictional learner details."}
          </p>
        </div>
        <div className="pp-actions">
          {canCreate && (
            <LearnerLink
              className="action action-primary pp-submit"
              href="/learners/new"
              label="Create a local learner"
            />
          )}
          {groups.admissionEnabled && (
            <LearnerLink
              href={
                groups.ordinaryParent
                  ? "/parent/children/new"
                  : groups.localWorkflow
                    ? "/student/onboarding"
                    : "/learner-admission/new"
              }
              className={
                privateWorkflow
                  ? "action action-primary pp-submit"
                  : "action action-outline pp-submit"
              }
              leading={
                groups.ordinaryParent || privateWorkflow ? (
                  <Plus className="size-4" aria-hidden="true" />
                ) : undefined
              }
              label={
                groups.ordinaryParent
                  ? "Add Child"
                  : groups.localWorkflow
                    ? "Set up your Student profile"
                    : privateWorkflow
                      ? "Add a learner"
                      : "Request admission review"
              }
            />
          )}
          {privateWorkflow && !groups.localWorkflow && (
            <LearnerLink
              href="/learner-admission"
              className="pp-link"
              label="Admission requests"
            />
          )}
        </div>
      </header>
      {learners.length ? (
        <ul className="pp-children">
          {learners.map((learner) => (
            <li key={learner.id} className="pp-child">
              <span className="pp-avatar" aria-hidden="true">
                {nameInitials(learner.displayName) || <UsersRound size={20} />}
              </span>
              <div className="pp-child-main">
                <h2 className="wrap-anywhere">{learner.displayName}</h2>
                <p>
                  {levelNames([learner.level]).join()}
                  {learner.grade != null ? ` · Grade ${learner.grade}` : ""}
                </p>
                <p className="mt-2">
                  <span
                    className="workspace-pill"
                    data-dot
                    data-tone={
                      groups.readiness.some((row) => row.id === learner.id)
                        ? "success"
                        : undefined
                    }
                  >
                    {groups.readiness.some((row) => row.id === learner.id)
                      ? groups.localWorkflow
                        ? "Current authorized access"
                        : privateWorkflow
                          ? "Reviewed admission"
                          : "Synthetic reviewed admission"
                      : "Local demonstration"}
                  </span>
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
        <section className="workspace-blank">
          <span className="pp-icon" aria-hidden="true">
            <UsersRound size={20} />
          </span>
          <h2>No learner profiles available</h2>
          <p>
            {groups.ordinaryParent
              ? "Add your child and confirm your guardian authority and consent to start arranging tutoring."
              : groups.localWorkflow
                ? "Set up your Student profile and confirm your independent eligibility to start arranging tutoring."
                : privateWorkflow
                  ? "Request an admission review to add a learner. A pending request does not grant profile or booking access."
                  : "This account has no authorized local learner profiles. Create a fictional profile for the local demonstration."}
          </p>
        </section>
      )}
      <Link href="/account" className="pp-link self-start">
        Account settings
      </Link>
    </div>
  );
}
