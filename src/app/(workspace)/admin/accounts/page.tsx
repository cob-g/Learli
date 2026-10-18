import type { Metadata } from "next";
import { AccountReadLink } from "@/features/account-restrictions/pending";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTargets } from "@/features/account-restrictions/service";
import {
  LocalRestrictionNotice,
  AccountFilters,
  TargetRows,
} from "@/features/account-restrictions/presentation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AdminShell } from "@/features/admin/admin-shell";
import { safePage } from "@/features/support/input";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import {
  accountListHref,
  accountQueryFromSearch,
  accountSearchParams,
} from "@/features/account-restrictions/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Authorized local accounts",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = accountSearchParams(params);
  let path = "/admin/accounts";
  try {
    path = accountListHref(accountQueryFromSearch(search));
  } catch {
    /* Invalid private filters show the guarded unavailable state. */
  }
  const result = await loadPrivatePage(path, (runtime, headers) =>
    listTargets(
      runtime,
      headers,
      getLocalWorkflow(runtime) || getPrivateWorkflow(runtime)
        ? accountQueryFromSearch(search)
        : safePage(params.page),
    ),
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
      <h1 className="text-page-title">
        {result.localWorkflow
          ? "Authorized accounts"
          : result.privateWorkflow
            ? "Authorized fictional accounts"
            : "Authorized local accounts"}
      </h1>
      <LocalRestrictionNotice
        privateWorkflow={result.privateWorkflow}
        localWorkflow={result.localWorkflow}
      />
      {result.query && <AccountFilters query={result.query} />}
      <TargetRows
        targets={result.targets}
        query={result.query}
        localWorkflow={result.localWorkflow}
      />
      <nav className="mt-8 flex flex-wrap gap-4" aria-label="Account pages">
        {result.page > 1 && (
          <AccountReadLink
            className="action action-outline"
            href={
              result.query
                ? accountListHref(result.query, result.page - 1)
                : `?page=${result.page - 1}`
            }
          >
            Previous accounts
          </AccountReadLink>
        )}
        {result.hasMore && (
          <AccountReadLink
            className="action action-outline"
            href={
              result.query
                ? accountListHref(result.query, result.page + 1)
                : `?page=${result.page + 1}`
            }
          >
            More accounts
          </AccountReadLink>
        )}
        <AccountReadLink
          className="action action-outline"
          href={
            result.query ? accountListHref(result.query) : "/admin/accounts"
          }
        >
          Reload accounts
        </AccountReadLink>
      </nav>
    </AdminShell>
  );
}
