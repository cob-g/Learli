import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readTarget } from "@/features/account-restrictions/service";
import { TargetView } from "@/features/account-restrictions/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { safePage } from "@/features/support/input";
import { AdminShell } from "@/features/admin/admin-shell";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import {
  accountQueryFromSearch,
  accountSearchParams,
  accountTargetHref,
} from "@/features/account-restrictions/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local account access",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ targetId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { targetId } = await params;
  const query = await searchParams;
  const search = accountSearchParams(query);
  let path = `/admin/accounts/${encodeURIComponent(targetId)}`;
  try {
    const current = accountQueryFromSearch(search, true);
    path = accountTargetHref(
      targetId,
      current,
      "historyPage" in current ? Number(current.historyPage) : 1,
    );
  } catch {
    /* Invalid private filters show the guarded unavailable state. */
  }
  const detail = await loadPrivatePage(path, (runtime, headers) =>
    readTarget(
      runtime,
      headers,
      targetId,
      getLocalWorkflow(runtime) || getPrivateWorkflow(runtime)
        ? accountQueryFromSearch(search, true)
        : safePage(query.page),
    ),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Account unavailable"
        message="We cannot find that local account on this staff account."
      />
    );
  return (
    <AdminShell current="accounts">
      <TargetView detail={detail} />
    </AdminShell>
  );
}
