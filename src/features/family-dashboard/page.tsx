import { loadPrivatePage } from "@/lib/permissions/workspace";
import { FamilyDashboard } from "./dashboard";
import { DashboardUnavailable } from "./states";
import { readFamilyDashboard } from "./read";
import type { FamilyWorkspace } from "./model";

export async function FamilyDashboardPage({
  workspace,
  searchParams,
}: {
  workspace: FamilyWorkspace;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await loadPrivatePage(`/${workspace}`, (runtime, headers) =>
    readFamilyDashboard(runtime, headers, workspace, query),
  );
  return data ? (
    <FamilyDashboard data={data} />
  ) : (
    <DashboardUnavailable workspace={workspace} />
  );
}
