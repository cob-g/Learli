import Link from "next/link";
import { CircleAlert } from "lucide-react";
import type { FamilyWorkspace } from "./model";

export function DashboardUnavailable({
  workspace,
}: {
  workspace: FamilyWorkspace;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Bookings unavailable</h1>
      <div
        role="alert"
        className="mt-6 flex max-w-prose gap-3 rounded-surface border border-error bg-error-soft p-6"
      >
        <CircleAlert
          className="size-5 shrink-0 text-error"
          aria-hidden="true"
        />
        <p className="text-body">
          We couldn&apos;t load bookings on this account. Try again, or contact
          support if this keeps happening.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href={`/${workspace}`} className="action action-outline">
          Try again
        </Link>
        <Link href="/account" className="inline-flex min-h-11 items-center">
          Account settings
        </Link>
      </div>
      <DashboardHelp />
    </div>
  );
}

export function DashboardHelp() {
  return (
    <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-small">
      <Link className="inline-flex min-h-11 items-center" href="/contact">
        Contact support
      </Link>
      <Link
        className="inline-flex min-h-11 items-center"
        href="/report-a-concern"
      >
        Report a concern
      </Link>
    </footer>
  );
}
