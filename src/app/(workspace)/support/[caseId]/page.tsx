import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readCase } from "@/features/support/service";
import { CaseView } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
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
  const detail = await loadPrivatePage(
    `/support/${caseId}`,
    (runtime, headers) => readCase(runtime, headers, caseId, "requester"),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Case unavailable"
        message="We cannot find that case on this account."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <CaseView detail={detail} reviewer={false} />
      </div>
    </div>
  );
}
