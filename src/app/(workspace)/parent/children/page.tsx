import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { readParentChildIntake } from "@/features/parent-children/service";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { listLearnerGroups } from "@/features/learners/composition";
import { LearnerLink } from "@/features/learners/learner-link";
import { readLearnerCreationContext } from "@/features/learners/service";
import { admissionContext } from "@/features/learner-admission/context";
import { listMyAdmissions } from "@/features/learner-admission/service";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { levelNames } from "@/features/subjects/catalog";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { nameInitials } from "@/lib/initials";
import "@/features/parent-children/parent-pages.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Children",
  robots: { index: false, follow: false },
};

export default async function ParentChildrenPage() {
  const result = await loadPrivatePage(
    "/parent/children",
    async (runtime, headers) => {
      const identity = await requireIdentity(runtime, headers);
      if (!identity.roles.includes("parent")) throw new AccessError(403);
      const groups = await listLearnerGroups(runtime, headers);
      const privateWorkflow = hasPersistentWorkflow(runtime);
      const canCreateLocal =
        !privateWorkflow && groups.demoAllowed
          ? await readLearnerCreationContext(runtime, headers)
              .then((context) => context.modes.includes("guardian"))
              .catch(() => false)
          : false;
      const requests = await listMyAdmissions(
        admissionContext(runtime),
        headers,
      );
      const ordinaryParent = getLocalWorkflow(runtime) !== null;
      const childIntake = ordinaryParent
        ? await readParentChildIntake(runtime, headers)
        : null;
      return {
        groups,
        privateWorkflow,
        canCreateLocal,
        requests,
        ordinaryParent,
        childIntake,
      };
    },
  );
  if (!result)
    return (
      <UnavailablePage
        title="Children unavailable"
        message="We cannot open children on this parent account. Check your sign-in status or try again later."
      />
    );
  const {
    groups,
    privateWorkflow,
    canCreateLocal,
    requests,
    ordinaryParent,
    childIntake,
  } = result;
  const children = [...groups.demo, ...groups.readiness].filter(
    (profile) => profile.management === "guardian",
  );
  const childRequests = requests.items.filter(
    (request) =>
      request.management === "guardian" &&
      (!ordinaryParent ||
        request.policyVersion !== "local-guardian-admission-v2"),
  );
  const canAdd = ordinaryParent
    ? !!childIntake?.enabled
    : canCreateLocal || groups.admissionEnabled;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Parent workspace</p>
          <h1>My Children</h1>
          <p>
            {ordinaryParent
              ? "Manage your private child profiles and arrange tutoring. Add another child whenever you need to."
              : privateWorkflow
                ? "Manage children with current authorized access and check saved admission requests below."
                : "Manage fictional child profiles for local testing. These profiles do not establish real consent or guardian identity."}
          </p>
        </div>
        {canAdd && (
          <LearnerLink
            href="/parent/children/new"
            label="Add Child"
            className="action action-primary pp-submit"
            leading={<Plus className="size-4" aria-hidden="true" />}
          />
        )}
      </header>
      <div className="flex flex-col gap-10">
        <section className="pp-section" aria-labelledby="saved-children">
          <h2 id="saved-children" className="pp-section-title">
            Your child profiles
          </h2>
          {children.length ? (
            <ul className="pp-children">
              {children.map((child) => (
                <li key={child.id} className="pp-child">
                  <span className="pp-avatar" aria-hidden="true">
                    {nameInitials(child.displayName) || (
                      <UsersRound size={20} />
                    )}
                  </span>
                  <div className="pp-child-main">
                    <h3 className="wrap-anywhere">{child.displayName}</h3>
                    <p>
                      {levelNames([child.level]).join()}
                      {child.grade != null ? ` · Grade ${child.grade}` : ""}
                    </p>
                    <p className="mt-2">
                      <span
                        className="workspace-pill"
                        data-dot
                        data-tone={
                          groups.readiness.some(
                            (profile) => profile.id === child.id,
                          )
                            ? "success"
                            : undefined
                        }
                      >
                        {groups.readiness.some(
                          (profile) => profile.id === child.id,
                        )
                          ? ordinaryParent
                            ? "Ready for booking — current authorized access"
                            : "Authorized — current reviewed access"
                          : "Saved for local testing"}
                      </span>
                    </p>
                  </div>
                  <LearnerLink
                    href={`/parent/children/${child.id}`}
                    label="Edit child profile"
                    ariaLabel={`Edit child profile for ${child.displayName}`}
                    className="action action-outline shrink-0"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="workspace-blank">
              <span className="pp-icon" aria-hidden="true">
                <UsersRound size={20} />
              </span>
              <p>
                {ordinaryParent
                  ? "No child profiles yet. Add your child and confirm your guardian authority and consent to get started."
                  : privateWorkflow
                    ? "No currently authorized child profiles. Add a child to save a request for review; pending requests appear below."
                    : "No saved child profiles yet. Add a fictional child to get started."}
              </p>
            </div>
          )}
        </section>
        {groups.admissionEnabled &&
          (!ordinaryParent ||
            childRequests.length > 0 ||
            requests.nextCursor) && (
            <section className="pp-section" aria-labelledby="child-requests">
              <h2 id="child-requests" className="pp-section-title">
                {ordinaryParent
                  ? "Earlier child review records"
                  : "Child requests"}
              </h2>
              <p>
                {ordinaryParent
                  ? "These retained records cover child reviews created under an earlier workflow or for an exceptional case. New child profiles use self-service setup."
                  : "A saved request is not approval. Pending requests grant no profile or booking access. Review status does not replace current authorization."}
              </p>
              {childRequests.length ? (
                <ul className="pp-request-list">
                  {childRequests.map((request) => (
                    <li key={request.id}>
                      <p className="text-item-title">
                        {request.state === "pending"
                          ? "Saved — pending review"
                          : request.state.charAt(0).toUpperCase() +
                            request.state.slice(1)}
                      </p>
                      <p className="mt-2 text-small text-muted-foreground">
                        Requested{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        }).format(request.createdAt)}{" "}
                        UTC.
                      </p>
                      <LearnerLink
                        href={`/learner-admission/${request.id}`}
                        label={
                          ordinaryParent
                            ? "View child review record"
                            : "View child request"
                        }
                        className="mt-2 inline-flex min-h-11 items-center"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {ordinaryParent && requests.nextCursor
                    ? "Earlier child review records continue on an older page."
                    : "No child requests on this page."}
                </p>
              )}
              <LearnerLink
                href="/learner-admission"
                label={
                  requests.nextCursor
                    ? ordinaryParent
                      ? "View all learner review records and older pages"
                      : "View all requests and older pages"
                    : ordinaryParent
                      ? "View all learner review records"
                      : "View all admission requests"
                }
                className="pp-link self-start"
              />
            </section>
          )}
        <Link href="/parent/profile" className="pp-link self-start">
          Parent Profile
        </Link>
      </div>
    </div>
  );
}
