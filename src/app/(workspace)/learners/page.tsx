import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listMyLearners } from "@/features/learners/service";
import { levelNames } from "@/features/subjects/catalog";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your learners",
  robots: { index: false, follow: false },
};
export default async function LearnersPage() {
  const learners = await loadPrivatePage("/learners", listMyLearners);
  if (!learners)
    return (
      <UnavailablePage
        title="Learner profiles unavailable"
        message="We cannot open learner profiles on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your learners</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Local testing only. Use fictional learner details.
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
                <p className="mt-2 text-body">
                  {levelNames([learner.level]).join()}
                </p>
              </div>
              <Link
                className="action action-outline shrink-0"
                href={`/learners/${learner.id}`}
                aria-label={`Edit profile for ${learner.displayName}`}
              >
                Edit profile
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">No learner profiles available</h2>
          <p className="mt-2 text-body">
            This account has no authorized local learner profiles. Profile
            creation is not available here.
          </p>
        </section>
      )}
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
