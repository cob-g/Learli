import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { AccessError } from "@/lib/permissions/access";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listDispatchCases } from "@/features/support/dispatch-service";
import { listCases } from "@/features/support/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminSupportCases } from "@/features/admin/admin-support-cases";
import { safePage } from "@/features/support/input";
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
  const page = safePage((await searchParams).page);
  const result = await loadPrivatePage(
    "/admin/support",
    async (runtime, headers) => {
      try {
        return {
          cases: await listCases(runtime, headers, "reviewer", page),
          privateWorkflow: hasPersistentWorkflow(runtime),
          localWorkflow: getLocalWorkflow(runtime) !== null,
        };
      } catch (error) {
        if (!(error instanceof AccessError) || error.status !== 403)
          throw error;
        const dispatch = await listDispatchCases(runtime, headers);
        if (!dispatch.cases.length) throw error;
        return {
          cases: { cases: [], page: 1, hasMore: false },
          privateWorkflow: hasPersistentWorkflow(runtime),
          localWorkflow: getLocalWorkflow(runtime) !== null,
        };
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
    <AdminSupportCases
      cases={result.cases}
      privateWorkflow={result.privateWorkflow}
      localWorkflow={result.localWorkflow}
    />
  );
}
