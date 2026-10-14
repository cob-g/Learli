import type { Metadata } from "next";
import { AccountReadLink } from "@/features/account-restrictions/pending";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTargets } from "@/features/account-restrictions/service";
import {
  LocalRestrictionNotice,
  TargetRows,
} from "@/features/account-restrictions/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminShell } from "@/features/admin/admin-shell";
import { safePage } from "@/features/support/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Authorized local accounts",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = safePage((await searchParams).page);
  const result = await loadPrivatePage("/admin/accounts", (runtime, headers) =>
    listTargets(runtime, headers, page),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Accounts unavailable"
        message="We cannot open local account restrictions on this account. Return to your account or try again later."
      />
    );
  return (
    <AdminShell current="accounts">
      <h1 className="text-page-title">Authorized local accounts</h1>
      <LocalRestrictionNotice />
      <TargetRows targets={result.targets} />
      <nav className="mt-8 flex flex-wrap gap-4" aria-label="Account pages">
        {result.page > 1 && (
          <AccountReadLink
            className="action action-outline"
            href={`?page=${result.page - 1}`}
          >
            Previous accounts
          </AccountReadLink>
        )}
        {result.hasMore && (
          <AccountReadLink
            className="action action-outline"
            href={`?page=${result.page + 1}`}
          >
            More accounts
          </AccountReadLink>
        )}
        <AccountReadLink
          className="action action-outline"
          href="/admin/accounts"
        >
          Reload accounts
        </AccountReadLink>
      </nav>
    </AdminShell>
  );
}
