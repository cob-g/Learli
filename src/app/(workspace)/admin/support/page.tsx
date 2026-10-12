import type { Metadata } from "next";
import { AccessError } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listDispatchCases } from "@/features/support/dispatch-service";
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
  const result = await loadPrivatePage(
    "/admin/support",
    async (runtime, headers) => {
      try {
        return await listCases(runtime, headers, "reviewer", page);
      } catch (error) {
        if (!(error instanceof AccessError) || error.status !== 403)
          throw error;
        const dispatch = await listDispatchCases(runtime, headers);
        if (!dispatch.cases.length) throw error;
        return { cases: [], page: 1, hasMore: false };
      }
    },
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
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native cross-permission navigation replaces the private document. */}
      <a
        className="mt-4 inline-flex min-h-11 items-center"
        href="/admin/support/dispatch"
      >
        Manage local assignments
      </a>
      <CaseRows result={result} reviewer={true} />
    </AdminShell>
  );
}
