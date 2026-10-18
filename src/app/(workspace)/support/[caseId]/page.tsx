import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readCase } from "@/features/support/service";
import { CaseView } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Support case",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const result = await loadPrivatePage(
    `/support/${caseId}`,
    async (runtime, headers) => ({
      detail: await readCase(runtime, headers, caseId, "requester"),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  if (!result?.detail)
    return (
      <UnavailablePage
        title="Case unavailable"
        message="We cannot find that case on this account."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <CaseView
          detail={result.detail}
          reviewer={false}
          privateWorkflow={result.privateWorkflow}
          localWorkflow={result.localWorkflow}
        />
      </div>
    </div>
  );
}
