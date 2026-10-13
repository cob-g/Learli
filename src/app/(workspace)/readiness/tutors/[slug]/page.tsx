import { loadPrivatePage } from "@/lib/permissions/workspace";
import {
  readinessTutor,
  readinessCandidates,
} from "@/features/tutor-screening/discovery";
import { LessonTime } from "@/features/bookings/lesson-time";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Synthetic tutor profile",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPrivatePage(
    "/readiness/tutors/" + slug,
    async (runtime) => {
      const tutor = await readinessTutor(runtime, slug);
      if (!tutor) return null;
      const offering = tutor.offerings[0];
      const candidates = await readinessCandidates(runtime, {
        tutorSlugs: [slug],
        subjectSlug: offering.subjectSlug,
        level: offering.levels[0],
        displayTimezone: "Asia/Manila",
      });
      return { tutor, candidates };
    },
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">
        {data?.tutor.displayName ?? "Synthetic profile unavailable"}
      </h1>
      {data && (
        <>
          <p className="mt-4 max-w-prose text-body">
            Fictional readiness profile. Times use the existing synthetic demo
            duration and are advisory, not real booking offers.
          </p>
          <p className="mt-4 max-w-prose text-body">{data.tutor.bio}</p>
          <a
            className="mt-6 inline-flex min-h-11 items-center"
            href={`/bookings/demo?${new URLSearchParams({ tutorSlug: data.tutor.slug, subjectSlug: data.tutor.offerings[0].subjectSlug, displayTimezone: "Asia/Manila" })}`}
          >
            Review synthetic booking options
          </a>
          <h2 className="mt-8 text-section-title">Synthetic slot preview</h2>
          <ul className="mt-4 divide-y divide-border">
            {data.candidates.tutors[0]?.times.slice(0, 6).map((t) => (
              <li key={t.startAtUtc} className="py-4">
                <LessonTime value={t} />
              </li>
            ))}
          </ul>
          {!data.candidates.tutors[0]?.times.length && (
            <p className="mt-4 text-body">No open synthetic times right now.</p>
          )}
        </>
      )}
    </section>
  );
}
