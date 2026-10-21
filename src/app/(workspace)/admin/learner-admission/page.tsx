import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { admissionListCursor } from "@/features/learner-admission/input";
import { AdminLearnerRecords } from "@/features/admin/admin-learner-records";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { listAssignedAdmissions } from "@/features/learner-admission/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned learner reviews",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  const rawCursor = (await searchParams).after;
  let cursor: string | null = null;
  try {
    cursor = admissionListCursor(rawCursor);
  } catch {
    return (
      <UnavailablePage
        title="Learner reviews unavailable"
        message="Reload the learner review list with a valid cursor."
      />
    );
  }
  const result = await loadPrivatePage(
    cursor
      ? `/admin/learner-admission?after=${cursor}`
      : "/admin/learner-admission",
    async (runtime, headers) => ({
      admissions: await listAssignedAdmissions(
        admissionContext(runtime),
        headers,
        cursor,
      ),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Learner reviews unavailable"
        message="We cannot open assigned learner review records on this account."
      />
    );
  const { items: rows, nextCursor } = result.admissions;
  return (
    <AdminLearnerRecords
      rows={rows}
      cursor={cursor}
      nextCursor={nextCursor}
      localWorkflow={result.localWorkflow}
      privateWorkflow={result.privateWorkflow}
    />
  );
}
