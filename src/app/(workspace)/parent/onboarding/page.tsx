import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { requireIdentity } from "@/lib/permissions/access";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { ParentOnboardingForm } from "@/features/parent-onboarding/form";
import {
  parentContinuation,
  parentOnboardingHref,
} from "@/features/parent-onboarding/continuation";
import "@/features/parent-children/parent-pages.css";

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
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Parent workspace</p>
          <h1>Set up your parent workspace</h1>
          <p>
            Organize tutoring for the children you are authorized to manage.
          </p>
        </div>
        <Link href="/account" className="pp-link">
          Back to account settings
        </Link>
      </header>
      <section className="pp-card max-w-xl">
        <div className="pp-card-body">
          <p className="pp-help">
            <span className="pp-icon" aria-hidden="true">
              <UsersRound size={18} />
            </span>
            <span>
              This adds Parent to your account. Each child still needs an
              authorized guardian relationship before you can manage their
              profile or bookings.
            </span>
          </p>
          <ParentOnboardingForm next={next} />
        </div>
      </section>
    </div>
  );
}
