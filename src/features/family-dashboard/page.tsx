import { loadPrivatePage } from "@/lib/permissions/workspace";
import { FamilyDashboard } from "./dashboard";
import { DashboardUnavailable } from "./states";
import { readFamilyDashboard } from "./read";
import type { FamilyWorkspace } from "./model";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";

export async function FamilyDashboardPage({
  workspace,
  searchParams,
}: {
  workspace: FamilyWorkspace;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await loadPrivatePage(
    `/${workspace}`,
    async (runtime, headers) => ({
      data: await readFamilyDashboard(runtime, headers, workspace, query),
      privateWorkflow: hasPersistentWorkflow(runtime),
    }),
  );
  return result ? (
    <FamilyDashboard
      data={result.data}
      privateWorkflow={result.privateWorkflow}
    />
  ) : (
    <DashboardUnavailable workspace={workspace} />
  );
}
