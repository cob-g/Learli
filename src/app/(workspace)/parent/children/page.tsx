import type { Metadata } from "next";
import Link from "next/link";
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
      return { groups, privateWorkflow, canCreateLocal, requests };
    },
  );
  if (!result)
    return (
      <UnavailablePage
        title="Children unavailable"
        message="We cannot open children on this parent account. Check your sign-in status or try again later."
      />
    );
  const { groups, privateWorkflow, canCreateLocal, requests } = result;
  const children = [...groups.demo, ...groups.readiness].filter(
    (profile) => profile.management === "guardian",
  );
  const childRequests = requests.items.filter(
    (request) => request.management === "guardian",
  );
  const canAdd = canCreateLocal || groups.admissionEnabled;
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <h1 className="text-page-title">My Children</h1>
        <p className="mt-4 max-w-prose text-body text-muted-foreground">
          {privateWorkflow
            ? "Manage children with current authorized access and check saved admission requests below."
            : "Manage fictional child profiles for local testing. These profiles do not establish real consent or guardian identity."}
        </p>
        {canAdd && (
          <LearnerLink
            href="/parent/children/new"
            label="Add Child"
            className="action action-primary mt-6"
          />
        )}
        <section className="mt-8" aria-labelledby="saved-children">
          <h2 id="saved-children" className="text-section-title">
            Your child profiles
          </h2>
          {children.length ? (
            <ul className="mt-4 divide-y divide-border">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex min-w-0 flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="text-item-title wrap-anywhere">
                      {child.displayName}
                    </h3>
                    <p className="mt-2 text-body">
                      {levelNames([child.level]).join()}
                      {child.grade != null ? ` · Grade ${child.grade}` : ""}
                    </p>
                    <p className="mt-2 text-small text-muted-foreground">
                      {groups.readiness.some(
                        (profile) => profile.id === child.id,
                      )
                        ? "Authorized — current reviewed access"
                        : "Saved for local testing"}
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
            <p className="mt-4 max-w-prose text-body">
              {privateWorkflow
                ? "No currently authorized child profiles. Add a child to save a request for review; pending requests appear below."
                : "No saved child profiles yet. Add a fictional child to get started."}
            </p>
          )}
        </section>
        {groups.admissionEnabled && (
          <section className="mt-12" aria-labelledby="child-requests">
            <h2 id="child-requests" className="text-section-title">
              Child requests
            </h2>
            <p className="mt-3 max-w-prose text-body text-muted-foreground">
              A saved request is not approval. Pending requests grant no profile
              or booking access. Review status does not replace current
              authorization.
            </p>
            {childRequests.length ? (
              <ul className="mt-4 divide-y divide-border">
                {childRequests.map((request) => (
                  <li key={request.id} className="py-5">
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
                      label="View child request"
                      className="mt-2 inline-flex min-h-11 items-center"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-body">No child requests on this page.</p>
            )}
            <LearnerLink
              href="/learner-admission"
              label={
                requests.nextCursor
                  ? "View all requests and older pages"
                  : "View all admission requests"
              }
              className="mt-4 inline-flex min-h-11 items-center"
            />
          </section>
        )}
        <Link
          href="/parent/profile"
          className="mt-8 inline-flex min-h-11 items-center"
        >
          Parent Profile
        </Link>
      </div>
    </div>
  );
}
