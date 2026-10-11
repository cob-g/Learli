import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listCases } from "@/features/support/service";
import { DemoNotice, CaseRows } from "@/features/support/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminShell } from "@/features/admin/admin-shell";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned support cases",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = (await searchParams).page ?? 1;
  const result = await loadPrivatePage("/admin/support", (runtime, headers) =>
    listCases(runtime, headers, "reviewer", page),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Support cases unavailable"
        message="We cannot open support cases on this account. Return to your account or try again later."
      />
    );
  return (
    <AdminShell current="support">
      <h1 className="text-page-title">Assigned support cases</h1>
      <DemoNotice />
      <CaseRows result={result} reviewer={true} />
    </AdminShell>
  );
}
