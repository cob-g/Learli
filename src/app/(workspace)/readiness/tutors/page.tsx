import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readinessDirectory } from "@/features/tutor-screening/discovery";
import { learnerLevels } from "@/lib/db/schema/app";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { redirect } from "next/navigation";
const levelLabels = Object.fromEntries(learnerLevelOptions);
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Synthetic screened discovery",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string }>;
}) {
  const q = await searchParams;
  const runtime = await getDomainAuthRuntime();
  if (runtime && hasPersistentWorkflow(runtime)) {
    const query = new URLSearchParams();
    if (typeof q.subject === "string") query.set("subject", q.subject);
    if (typeof q.level === "string") query.set("level", q.level);
    redirect(`/tutors${query.size ? `?${query}` : ""}`);
  }
  const level = learnerLevels.find((l) => l === q.level);
  const tutors = await loadPrivatePage("/readiness/tutors", (runtime) =>
    readinessDirectory(runtime, {
      ...(q.subject ? { subject: q.subject } : {}),
      ...(level ? { level } : {}),
    }),
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Synthetic screened tutor discovery</h1>
      <p className="mt-4 max-w-prose text-body">
        Fictional readiness records only. No actual tutor screening, real
        booking or verified claim.
      </p>
      <form method="get" className="mt-6 space-y-4">
        <label className="block text-label">
          Subject slug
          <input
            name="subject"
            className="field mt-2"
            defaultValue={q.subject ?? ""}
          />
        </label>
        <label className="block text-label">
          Learner level
          <select
            name="level"
            className="field mt-2"
            defaultValue={level ?? ""}
          >
            <option value="">Any level</option>
            {learnerLevels.map((l) => (
              <option key={l} value={l}>
                {levelLabels[l]}
              </option>
            ))}
          </select>
        </label>
        <button className="action action-outline">
          Apply discovery filters
        </button>
      </form>
      {tutors === null ? (
        <p className="mt-6 text-body">
          New discovery workflows are disabled or unavailable.
        </p>
      ) : !tutors.length ? (
        <p className="mt-6 text-body">
          No currently eligible synthetic tutors match.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {tutors.map((t) => (
            <li key={t.slug} className="py-4">
              <h2 className="text-item-title">{t.displayName}</h2>
              <p className="mt-2 text-body">
                {t.offerings.map((o) => o.subjectName).join(" · ")}
              </p>
              <a
                className="inline-flex min-h-11 items-center"
                href={`/readiness/tutors/${t.slug}`}
              >
                View synthetic profile
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
