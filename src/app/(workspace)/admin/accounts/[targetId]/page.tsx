import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readTarget } from "@/features/account-restrictions/service";
import { TargetView } from "@/features/account-restrictions/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminShell } from "@/features/admin/admin-shell";
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
  searchParams: Promise<{ page?: string }>;
}) {
  const { targetId } = await params;
  const page = (await searchParams).page ?? 1;
  const detail = await loadPrivatePage(
    `/admin/accounts/${encodeURIComponent(targetId)}`,
    (runtime, headers) => readTarget(runtime, headers, targetId, page),
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
