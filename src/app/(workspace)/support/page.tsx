import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listCases } from "@/features/support/service";
import { DemoNotice, CaseRows } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { safePage } from "@/features/support/input";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
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
  const result = await loadPrivatePage(
    "/support",
    async (runtime, headers) => ({
      cases: await listCases(runtime, headers, "requester", page),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
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
        <DemoNotice
          privateWorkflow={result.privateWorkflow}
          localWorkflow={result.localWorkflow}
        />
        <Link
          className="action action-primary mt-6 w-full sm:w-auto"
          href="/contact"
        >
          {result.localWorkflow ? "Create report" : "Create fictional report"}
        </Link>
        <CaseRows
          result={result.cases}
          reviewer={false}
          localWorkflow={result.localWorkflow}
        />
      </div>
    </div>
  );
}
