import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readCase } from "@/features/support/service";
import { CaseView } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminShell } from "@/features/admin/admin-shell";
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
    `/admin/support/${caseId}`,
    async (runtime, headers) => ({
      detail: await readCase(runtime, headers, caseId, "reviewer"),
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
    <AdminShell current="support">
      <CaseView
        detail={result.detail}
        reviewer={true}
        privateWorkflow={result.privateWorkflow}
        localWorkflow={result.localWorkflow}
      />
    </AdminShell>
  );
}
