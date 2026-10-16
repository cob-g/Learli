import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { requireIdentity } from "@/lib/permissions/access";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { ParentOnboardingForm } from "@/features/parent-onboarding/form";
import {
  parentContinuation,
  parentOnboardingHref,
} from "@/features/parent-onboarding/continuation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up parent workspace",
  robots: { index: false, follow: false },
};

export default async function ParentOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? parentContinuation(raw) : "/parent";
  const identity = await loadPrivateAccountPage(
    parentOnboardingHref(next),
    requireIdentity,
  );
  if (!identity)
    return (
      <UnavailablePage
        title="Parent setup unavailable"
        message="Verify your email and check your account access before continuing."
      />
    );
  if (identity.roles.includes("parent")) redirect(next);
  return (
    <div className="page-shell page-space">
      <div className="max-w-xl">
        <h1 className="text-page-title">Set up your parent workspace</h1>
        <p className="mt-4 text-body">
          Organize tutoring for the children you are authorized to manage.
        </p>
        <p className="mt-4 text-small text-muted-foreground">
          This adds Parent to your account. Each child still needs an authorized
          guardian relationship before you can manage their profile or bookings.
        </p>
        <ParentOnboardingForm next={next} />
        <Link
          href="/account"
          className="mt-6 inline-flex min-h-11 items-center"
        >
          Back to account settings
        </Link>
      </div>
    </div>
  );
}
