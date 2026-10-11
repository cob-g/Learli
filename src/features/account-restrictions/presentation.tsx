import { AccountReadLink } from "./pending";
import { Ban, Check } from "lucide-react";
import { reasonLabels } from "./input";
import type { TargetDetail, TargetSummary } from "./service";
import { ChangeAccessForm } from "./change-form";
export function LocalRestrictionNotice() {
  return (
    <p className="mt-4 max-w-prose text-body text-muted-foreground">
      Local synthetic account testing only. Each target requires an exact
      owner-provisioned staff grant. Reasons describe fictional tests, not
      findings about real people.
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
export function TargetRows({ targets }: { targets: TargetSummary[] }) {
  return targets.length ? (
    <ul className="mt-8 divide-y divide-border">
      {targets.map((t) => (
        <li
          key={t.id}
          className="flex min-w-0 flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 className="min-w-0 text-item-title wrap-anywhere">
            <AccountReadLink href={`/admin/accounts/${t.id}`}>
              {t.name}
            </AccountReadLink>
          </h2>
          <AccessStatus status={t.status} />
        </li>
      ))}
    </ul>
  ) : (
    <section className="mt-8 max-w-prose">
      <h2 className="text-item-title">No accounts authorized for you</h2>
      <p className="mt-2 text-body">
        Only synthetic targets assigned through trusted local fixture tooling
        appear here.
      </p>
    </section>
  );
}
export function TargetView({ detail }: { detail: TargetDetail }) {
  return (
    <>
      <h1 className="text-page-title wrap-anywhere">
        Account access for {detail.name}
      </h1>
      <LocalRestrictionNotice />
      <div className="mt-8">
        <AccessStatus status={detail.status} />
        <p className="mt-2 text-small text-muted-foreground">
          Saved revision {detail.revision}
        </p>
      </div>
      <ChangeAccessForm
        targetId={detail.id}
        name={detail.name}
        status={detail.status}
        revision={detail.revision}
      />
      <p className="mt-4 max-w-prose text-small text-muted-foreground">
        Viewing accounts and history works without JavaScript. Enable JavaScript
        to confirm a local account action.
      </p>
      <section className="mt-12 max-w-prose">
        <h2 className="text-section-title">Local access history</h2>
        {detail.history.length ? (
          <ol className="mt-4 divide-y divide-border">
            {detail.history.map((e) => (
              <li key={e.revision} className="py-4">
                <p className="text-body">
                  {e.previousStatus === "active" ? "Active" : "Suspended"} to{" "}
                  {e.nextStatus === "active" ? "active" : "suspended"} access ·{" "}
                  {reasonLabels[e.reason]}
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
            No local access actions have been recorded.
          </p>
        )}
        <nav
          className="mt-4 flex flex-wrap gap-4"
          aria-label="Access history pages"
        >
          {detail.page > 1 && (
            <AccountReadLink
              className="action action-outline"
              href={`?page=${detail.page - 1}`}
            >
              Newer actions
            </AccountReadLink>
          )}
          {detail.hasMore && (
            <AccountReadLink
              className="action action-outline"
              href={`?page=${detail.page + 1}`}
            >
              Older actions
            </AccountReadLink>
          )}
        </nav>
      </section>
      <AccountReadLink
        className="mt-8 inline-flex min-h-11 items-center"
        href="/admin/accounts"
      >
        Authorized accounts
      </AccountReadLink>
    </>
  );
}
