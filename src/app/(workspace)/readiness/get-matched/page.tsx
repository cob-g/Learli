import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readinessMatches } from "@/features/tutor-screening/discovery";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Synthetic tutor matching",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const matches = await loadPrivatePage("/readiness/get-matched", (runtime) =>
    readinessMatches(runtime, "math", "college_support"),
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Synthetic college math matches</h1>
      <p className="mt-4 max-w-prose text-body">
        Fictional software exercise using current required screening evidence
        and the existing rule based availability ranking. Times are advisory
        synthetic previews.
      </p>
      <ul className="mt-8 divide-y divide-border">
        {matches?.map((match) => (
          <li key={match.tutor.slug} className="py-4">
            <a
              className="inline-flex min-h-11 items-center"
              href={"/readiness/tutors/" + match.tutor.slug}
            >
              {match.tutor.displayName}
            </a>
          </li>
        ))}
      </ul>
      {!matches?.length && (
        <p className="mt-4 text-body">No current synthetic matches.</p>
      )}
    </section>
  );
}
