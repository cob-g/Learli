import Link from "next/link";
import { AccountReadLink } from "./pending";
import {
  Ban,
  Check,
  LockKeyhole,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { PageSizeStepper } from "./page-size-stepper";
import {
  accountListHref,
  accountTargetHref,
  restrictionReasonLabel,
  type AccountQuery,
} from "./input";
import type { TargetDetail, TargetSummary } from "./service";
import { ChangeAccessForm } from "./change-form";
import { nameInitials } from "@/lib/initials";
export function LocalRestrictionNotice({
  privateWorkflow = false,
  localWorkflow = false,
  className = "mt-4 max-w-prose text-body text-muted-foreground",
}: {
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
  className?: string;
}) {
  return (
    <p className={className}>
      {localWorkflow
        ? "Only accounts assigned to you are available. Changes affect account access; existing bookings, history and separate eligibility decisions are retained."
        : privateWorkflow
          ? "Private fictional accounts only. Each account requires an explicit staff assignment within the current fictional audience. These test actions do not establish findings about real people."
          : "Local synthetic account testing only. Each target requires an exact owner-provisioned staff grant. Reasons describe fictional tests, not findings about real people."}
    </p>
  );
}
export function AccessStatus({ status }: { status: TargetSummary["status"] }) {
  const Icon = status === "active" ? Check : Ban;
  return (
    <span className="inline-flex items-center gap-1 rounded-tag border border-control bg-subtle px-2 py-1 text-label">
      <Icon aria-hidden="true" className="size-4" />
      {status === "active" ? "Active access" : "Suspended access"}
    </span>
  );
}
function RoleNames({ roles }: { roles: TargetSummary["roles"] }) {
  return (
    <>
      {roles?.length
        ? roles
            .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
            .join(", ")
        : "No roles assigned"}
    </>
  );
}
export function AccountFilters({ query }: { query: AccountQuery }) {
  return (
    <form
      method="get"
      action="/admin/accounts"
      className="account-filters"
      aria-label="Filter authorized accounts"
    >
      <div className="account-filter-row">
        <div className="account-field">
          <label className="text-label" htmlFor="account-query">
            Account name
          </label>
          <span className="account-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="field"
              id="account-query"
              name="q"
              maxLength={100}
              autoComplete="off"
              placeholder="Search by name"
              defaultValue={query.q}
            />
          </span>
        </div>
        <div className="account-field">
          <label className="text-label" htmlFor="account-role">
            Assigned role
          </label>
          <select
            className="field"
            id="account-role"
            name="role"
            defaultValue={query.role}
          >
            <option value="">All assigned roles</option>
            <option value="parent">Parent</option>
            <option value="student">Student</option>
            <option value="tutor">Tutor</option>
          </select>
        </div>
        <div className="account-field">
          <label className="text-label" htmlFor="account-status">
            Access status
          </label>
          <select
            className="field"
            id="account-status"
            name="status"
            defaultValue={query.status}
          >
            <option value="">All access statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="account-field">
          <label className="text-label" htmlFor="account-page-size">
            Accounts per page
          </label>
          <PageSizeStepper defaultValue={query.pageSize} />
        </div>
      </div>
      <div className="account-filter-foot">
        <p>
          <LockKeyhole size={14} aria-hidden="true" />
          Results are limited to your assigned access.
        </p>
        <div className="account-filter-actions">
          <Link className="account-clear" href="/admin/accounts">
            Clear
          </Link>
          <button className="action action-primary" type="submit">
            Filter accounts
          </button>
        </div>
      </div>
    </form>
  );
}
export function TargetRows({
  targets,
  query,
  localWorkflow = false,
  reloadHref,
}: {
  targets: TargetSummary[];
  query?: AccountQuery;
  localWorkflow?: boolean;
  /** Shown inside the empty state; the page shows it in its navigation otherwise. */
  reloadHref?: string;
}) {
  return targets.length ? (
    <ul className="account-list">
      {targets.map((t) => (
        <li key={t.id} className="account-card">
          <span className="account-avatar" aria-hidden="true">
            {nameInitials(t.name)}
          </span>
          <div className="min-w-0">
            <h2 className="wrap-anywhere">
              <AccountReadLink
                className="account-name"
                href={
                  query
                    ? accountTargetHref(t.id, query)
                    : `/admin/accounts/${t.id}`
                }
              >
                {t.name}
              </AccountReadLink>
            </h2>
            {query && (
              <p>
                Assigned roles: <RoleNames roles={t.roles} />
              </p>
            )}
          </div>
          <span
            className="workspace-pill"
            data-tone={t.status === "active" ? "success" : undefined}
          >
            {t.status === "active" ? (
              <Check aria-hidden="true" size={12} />
            ) : (
              <Ban aria-hidden="true" size={12} />
            )}
            {t.status === "active" ? "Active access" : "Suspended access"}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <section className="workspace-blank">
      <span className="account-blank-art" aria-hidden="true">
        <span>
          <UserRound size={26} />
        </span>
        <span>
          <UserRound size={26} />
        </span>
        <i />
      </span>
      <h2>
        {query
          ? "No matching authorized accounts"
          : "No accounts authorized for you"}
      </h2>
      <p>
        {localWorkflow
          ? "No accounts match these filters within your assigned access."
          : query
            ? "No fictional accounts match these filters within your assigned access."
            : "Only synthetic targets assigned through trusted local fixture tooling appear here."}
      </p>
      {reloadHref && (
        <AccountReadLink className="account-reload" href={reloadHref}>
          <RefreshCw size={15} aria-hidden="true" />
          Reload accounts
        </AccountReadLink>
      )}
    </section>
  );
}
export function TargetView({ detail }: { detail: TargetDetail }) {
  const privateWorkflow = !!detail.privateWorkflow;
  const localWorkflow = !!detail.localWorkflow;
  const query = detail.query;
  return (
    <>
      <h1 className="text-page-title wrap-anywhere">
        Account access for {detail.name}
      </h1>
      <LocalRestrictionNotice
        privateWorkflow={privateWorkflow}
        localWorkflow={localWorkflow}
      />
      <div className="mt-8">
        <AccessStatus status={detail.status} />
        {(privateWorkflow || localWorkflow) && (
          <section className="mt-4" aria-labelledby="account-assigned-roles">
            <h2 className="text-item-title" id="account-assigned-roles">
              Assigned roles
            </h2>
            <p className="mt-2 text-body">
              <RoleNames roles={detail.roles} />
            </p>
            <p className="mt-2 text-small text-muted-foreground">
              Roles are read-only. Current learner access and Tutor eligibility
              are checked separately.
            </p>
          </section>
        )}
        <p className="mt-2 text-small text-muted-foreground">
          Saved revision {detail.revision}
        </p>
      </div>
      <ChangeAccessForm
        targetId={detail.id}
        name={detail.name}
        status={detail.status}
        revision={detail.revision}
        privateWorkflow={privateWorkflow}
        localWorkflow={localWorkflow}
      />
      <p className="mt-4 max-w-prose text-small text-muted-foreground">
        Viewing accounts and history works without JavaScript. Enable JavaScript
        to confirm{" "}
        {localWorkflow ? "an" : privateWorkflow ? "a fictional" : "a local"}{" "}
        account action.
      </p>
      <section className="mt-12 max-w-prose">
        <h2 className="text-section-title">
          {privateWorkflow ? "Account access history" : "Local access history"}
        </h2>
        {detail.history.length ? (
          <ol className="mt-4 divide-y divide-border">
            {detail.history.map((e) => (
              <li key={e.revision} className="py-4">
                <p className="text-body">
                  {e.previousStatus === "active" ? "Active" : "Suspended"} to{" "}
                  {e.nextStatus === "active" ? "active" : "suspended"} access ·{" "}
                  {restrictionReasonLabel(e.reason, privateWorkflow)}
                </p>
                <p className="mt-2 text-small">
                  {e.actor} · Revision {e.revision}
                </p>
                <time
                  className="mt-2 block text-caption text-muted-foreground"
                  dateTime={new Date(e.createdAt).toISOString()}
                >
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "UTC",
                    dateStyle: "long",
                    timeStyle: "long",
                  }).format(new Date(e.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-body">
            {privateWorkflow
              ? "No account access actions have been recorded."
              : "No local access actions have been recorded."}
          </p>
        )}
        <nav
          className="mt-4 flex flex-wrap gap-4"
          aria-label="Access history pages"
        >
          {detail.page > 1 && (
            <AccountReadLink
              className="action action-outline"
              href={
                query
                  ? accountTargetHref(detail.id, query, detail.page - 1)
                  : `?page=${detail.page - 1}`
              }
            >
              Newer actions
            </AccountReadLink>
          )}
          {detail.hasMore && (
            <AccountReadLink
              className="action action-outline"
              href={
                query
                  ? accountTargetHref(detail.id, query, detail.page + 1)
                  : `?page=${detail.page + 1}`
              }
            >
              Older actions
            </AccountReadLink>
          )}
        </nav>
      </section>
      <AccountReadLink
        className="mt-8 inline-flex min-h-11 items-center"
        href={query ? accountListHref(query) : "/admin/accounts"}
      >
        Authorized accounts
      </AccountReadLink>
    </>
  );
}
