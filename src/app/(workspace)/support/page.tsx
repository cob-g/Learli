import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listCases } from "@/features/support/service";
import { DemoNotice, CaseRows } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { safePage } from "@/features/support/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your reports",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = safePage((await searchParams).page);
  const result = await loadPrivatePage("/support", (runtime, headers) =>
    listCases(runtime, headers, "requester", page),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Support cases unavailable"
        message="We cannot open support cases on this account. Return to your account or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <h1 className="text-page-title">Your reports</h1>
        <DemoNotice />
        <Link
          className="action action-primary mt-6 w-full sm:w-auto"
          href="/contact"
        >
          Create fictional report
        </Link>
        <CaseRows result={result} reviewer={false} />
      </div>
    </div>
  );
}
