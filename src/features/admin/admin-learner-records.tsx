import { ArrowRight, FileText, GraduationCap, ShieldCheck } from "lucide-react";
import type { AdmissionState } from "@/lib/db/schema/learner-admission";
import { LearnerLink } from "@/features/learners/learner-link";
import "./admin-learner-records.css";

export type LearnerRecordRow = {
  id: string;
  management: "self" | "guardian";
  state: AdmissionState;
  policyVersion: string;
  createdAt: Date;
};

/** Presentation only; the page loads assigned records through its guard. */
export function AdminLearnerRecords({
  rows,
  cursor,
  nextCursor,
  localWorkflow,
  privateWorkflow,
}: {
  rows: LearnerRecordRow[];
  cursor: string | null;
  nextCursor: string | null;
  localWorkflow: boolean;
  privateWorkflow: boolean;
}) {
  const requested = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Reviews</p>
          <h1>
            {localWorkflow
              ? "Assigned learner review records"
              : "Assigned admission reviews"}
          </h1>
          <p>
            {localWorkflow
              ? "Review only retained historical or exceptional learner cases assigned to you."
              : privateWorkflow
                ? "Review only your assigned learner requests. These fictional records establish no real guardian consent, age or eligibility."
                : "Synthetic readiness only. No real guardian consent, age or eligibility is established."}
          </p>
        </div>
      </header>
      {localWorkflow && (
        <div className="learner-scope">
          <div>
            <span className="learner-scope-icon" aria-hidden="true">
              <FileText size={16} />
            </span>
            <p>
              <strong>In this list</strong>
              Retained historical or exceptional learner cases assigned to you.
            </p>
          </div>
          <div>
            <span className="learner-scope-icon" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
            <p>
              <strong>Not reviewed here</strong>
              New Parent children and eligible independent College Support
              learners use self-service onboarding.
            </p>
          </div>
        </div>
      )}
      <div className="learner-bar">
        <h2>
          Assigned to you{" "}
          <span className="workspace-count" aria-hidden="true">
            {rows.length}
            {nextCursor && "+"}
          </span>
        </h2>
      </div>
      {rows.length ? (
        <ul className="learner-list">
          {rows.map((row) => {
            const Icon =
              row.management === "self" ? GraduationCap : ShieldCheck;
            return (
              <li key={row.id} className="learner-record">
                <span className="learner-record-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <div className="min-w-0">
                  <h3>
                    {row.management === "self"
                      ? localWorkflow
                        ? "Independent College Support record"
                        : "Independent College Support"
                      : localWorkflow
                        ? "Guardian-managed record"
                        : "Guardian-managed request"}{" "}
                    <span
                      className="workspace-pill learner-state"
                      data-dot
                      data-tone={
                        row.state === "pending"
                          ? "waiting"
                          : row.state === "authorized"
                            ? "success"
                            : undefined
                      }
                    >
                      {row.state}
                    </span>
                  </h3>
                  <dl>
                    <div>
                      <dt>Policy</dt>
                      <dd className="learner-code">{row.policyVersion}</dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>
                        <time dateTime={row.createdAt.toISOString()}>
                          {requested.format(row.createdAt)} UTC
                        </time>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="learner-record-action">
                  <LearnerLink
                    href={`/admin/learner-admission/${row.id}`}
                    className="action workspace-action"
                    label={localWorkflow ? "Open record" : "Open request"}
                    trailing={
                      <span
                        className="workspace-action-icon"
                        aria-hidden="true"
                      >
                        <ArrowRight size={13} />
                      </span>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="learner-empty">
          {localWorkflow
            ? "No assigned learner review records are available."
            : "No admission requests are available."}
        </p>
      )}
      {(cursor || nextCursor) && (
        <nav
          aria-label={
            localWorkflow
              ? "Learner review record pages"
              : "Admission list pages"
          }
          className="learner-pages"
        >
          {cursor && (
            <LearnerLink
              href="/admin/learner-admission"
              label="First page"
              className="action action-outline"
            />
          )}
          {nextCursor && (
            <LearnerLink
              href={`/admin/learner-admission?after=${nextCursor}`}
              label="Next page"
              className="action action-outline"
            />
          )}
        </nav>
      )}
      <div className="learner-end">
        <LearnerLink
          href="/account"
          className="inline-flex min-h-11 items-center"
          label="Your account"
        />
      </div>
    </div>
  );
}
