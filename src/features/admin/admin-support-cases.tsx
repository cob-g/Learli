import Link from "next/link";
import {
  ArrowRight,
  Check,
  Hourglass,
  Info,
  MessageSquare,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { DemoNotice } from "@/features/support/presentation";
import {
  categoryLabels,
  statusLabels,
  type CaseStatus,
} from "@/features/support/input";
import type { CaseList } from "@/features/support/service";
import "./admin-support-cases.css";

const statusIcons = { open: Hourglass, in_review: Info, closed: Check };
const categoryIcons = {
  general: MessageSquare,
  account: UserRound,
  safety: ShieldAlert,
};

/** Presentation only; the page loads assigned cases through its guard. */
export function AdminSupportCases({
  cases,
  privateWorkflow,
  localWorkflow,
}: {
  cases: Pick<CaseList, "page" | "hasMore"> & {
    cases: Pick<
      CaseList["cases"][number],
      "id" | "subject" | "category" | "status"
    >[];
  };
  privateWorkflow: boolean;
  localWorkflow: boolean;
}) {
  const otherWork = (
    // Native cross-permission navigation replaces the private document.
    <a
      className="action workspace-action support-other"
      href={localWorkflow ? "/admin/requests" : "/admin/support/dispatch"}
    >
      {localWorkflow ? "Unassigned reviews" : "Manage local assignments"}
      <span className="workspace-action-icon" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </a>
  );
  const keepOut = [
    localWorkflow ? "Contact details" : "Real personal details",
    "Dates of birth",
    "School names",
    "Private meeting links",
  ];
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Support</p>
          <h1>Assigned support cases</h1>
        </div>
      </header>
      <aside
        className="support-guard"
        data-surface="inverse"
        aria-label="Report guidance"
      >
        <span className="support-guard-icon" aria-hidden="true">
          <ShieldAlert size={20} />
        </span>
        <div className="min-w-0">
          <DemoNotice
            privateWorkflow={privateWorkflow}
            localWorkflow={localWorkflow}
            className=""
          />
          <div className="support-keep" aria-hidden="true">
            <small>Keep out</small>
            {keepOut.map((item) => (
              <span key={item}>
                <X size={13} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </aside>
      {cases.cases.length ? (
        <>
          <div className="support-list-heading">{otherWork}</div>
          <ul className="support-list">
            {cases.cases.map((row) => {
              const Icon = categoryIcons[row.category];
              const StatusIcon = statusIcons[row.status as CaseStatus];
              return (
                <li key={row.id} className="support-card">
                  <span className="support-card-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="wrap-anywhere">
                      <Link href={`/admin/support/${row.id}`}>
                        {row.subject}
                      </Link>
                    </h2>
                    <p>{categoryLabels[row.category]}</p>
                  </div>
                  <span
                    className="workspace-pill"
                    data-tone={
                      row.status === "open"
                        ? "waiting"
                        : row.status === "in_review"
                          ? "success"
                          : undefined
                    }
                  >
                    <StatusIcon size={12} aria-hidden="true" />
                    {statusLabels[row.status as CaseStatus]}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <section className="workspace-blank">
          <span className="support-blank-art" aria-hidden="true">
            <span>
              <i />
            </span>
            <span>
              <i />
            </span>
            <em />
          </span>
          <h2>No cases assigned to you</h2>
          <p>
            {localWorkflow
              ? "Claim an unassigned request to review it here."
              : "Only cases assigned through trusted local tooling appear here."}
          </p>
          {otherWork}
        </section>
      )}
      {(cases.page > 1 || cases.hasMore) && (
        <nav aria-label="Case pages" className="support-pages">
          {cases.page > 1 && (
            <Link
              className="action action-outline"
              href={`/admin/support?page=${cases.page - 1}`}
            >
              Previous cases
            </Link>
          )}
          {cases.hasMore && (
            <Link
              className="action action-outline"
              href={`/admin/support?page=${cases.page + 1}`}
            >
              More cases
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
