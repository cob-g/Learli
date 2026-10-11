import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listCases } from "@/features/support/service";
import { DemoNotice, CaseRows } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
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
  const page = (await searchParams).page ?? 1;
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
      <h1 className="text-page-title">Your reports</h1>
      <DemoNotice />
      <CaseRows result={result} reviewer={false} />
      <Link className="action action-primary mt-4" href="/contact">
        Create fictional report
      </Link>
    </div>
  );
}
