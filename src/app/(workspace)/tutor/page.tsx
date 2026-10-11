import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { readOwnTutorProfile } from "@/features/tutors/service";
import { ReviewNotice } from "@/features/tutors/review-notice";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tutor workspace",
  robots: { index: false, follow: false },
};
export default async function TutorWorkspacePage() {
  const data = await loadPrivatePage("/tutor", async (runtime, headers) => ({
    // The role check runs first, so a non-tutor learns nothing else.
    profile: await readOwnTutorProfile(runtime, headers),
    account: await readAccount(runtime, headers),
  }));
  if (!data)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Tutor workspace</h1>
      <p className="mt-4 text-body">Signed in as {data.account.email}</p>
      <div className="mt-8">
        <ReviewNotice
          status={data.profile?.reviewStatus ?? null}
          editHref="/tutor/profile"
          publicHref={data.profile ? `/tutors/${data.profile.slug}` : undefined}
        />
      </div>
      <p className="mt-8 max-w-prose text-body text-muted-foreground">
        Availability and bookings are not available yet.
      </p>
      <Link className="mt-4 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
      <SignOut />
    </div>
  );
}
