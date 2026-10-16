import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readOwnTutorProfile } from "@/features/tutors/service";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { readScreening } from "@/features/tutor-screening/service";
import { ScreeningRequest } from "@/features/tutor-screening/forms";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Tutor screening",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const data = await loadPrivatePage(
    "/tutor/screening",
    async (runtime, headers) => {
      const context = getScreeningContext(runtime);
      if (context.screening.mode === "disabled")
        return { disabled: true as const };
      const profile = await readOwnTutorProfile(runtime, headers);
      return {
        disabled: false as const,
        privateWorkflow: isPrivateWorkflow(runtime),
        profile,
        detail: profile
          ? await readScreening(context, headers, profile.id, "owner")
          : null,
      };
    },
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Tutor screening</h1>
      {!data || data.disabled ? (
        <p className="mt-4 max-w-prose text-body">
          New screening workflows are disabled. Actual screening policy and
          responsible reviewers are required before activation.
        </p>
      ) : !data.profile ? (
        <Link
          href="/tutor/profile"
          className="mt-4 inline-flex min-h-11 items-center"
        >
          Submit your tutor application
        </Link>
      ) : data.detail ? (
        <p className="mt-4 text-body">
          {data.privateWorkflow
            ? "Screening status: "
            : "Synthetic screening: "}
          {data.detail.state}. Required{" "}
          {data.privateWorkflow ? "test" : "fictional"} checks:{" "}
          {data.detail.requiredCodes.join(", ")}. Your assigned reviewer decides
          eligibility.
        </p>
      ) : (
        <ScreeningRequest tutorId={data.profile.id} />
      )}
    </section>
  );
}
