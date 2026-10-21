import Link from "next/link";
import { ArrowRight, ChevronRight, LockKeyhole } from "lucide-react";
import type { WorkspaceLink } from "@/components/workspace/navigation";
import { AdmissionReviewEntry } from "@/features/learner-admission/navigation";
import { SignOut } from "@/features/auth/sign-out";
import { groupAdminLinks } from "./admin-navigation";
import "./admin-overview.css";

// Shared destinations the sidebar also lists beside the Admin work areas.
const supportExtras: WorkspaceLink[] = [
  { href: "/support", label: "Support requests" },
  { href: "/report-a-concern", label: "Report a concern" },
];

/** Presentation only; the page has already required the Admin role. */
export function AdminOverview({
  email,
  summary,
  scope,
  links,
  localWorkflow,
}: {
  email: string;
  summary: string;
  /** Access limits that apply to this deployment's Admin work. */
  scope: string;
  /** The same links the workspace sidebar shows for this deployment. */
  links: WorkspaceLink[];
  localWorkflow: boolean;
}) {
  const { groups } = groupAdminLinks(links);
  return (
    <div className="workspace-page">
      <section
        className="admin-hero"
        data-surface="inverse"
        aria-labelledby="admin-overview-title"
      >
        <div className="min-w-0">
          <p className="admin-eyebrow">Overview</p>
          <h1 id="admin-overview-title" className="admin-hero-title">
            Admin <em>workspace</em>
          </h1>
          <p className="admin-who wrap-anywhere">Signed in as {email}</p>
          <p className="admin-lede">{summary}</p>
        </div>
        <div className="admin-hero-actions">
          {localWorkflow && (
            <Link
              className="action admin-hero-primary"
              href="/admin/requests"
              prefetch={false}
            >
              Unassigned reviews
              <span className="admin-hero-arrow" aria-hidden="true">
                <ArrowRight size={14} />
              </span>
            </Link>
          )}
          <AdmissionReviewEntry
            localWorkflow={localWorkflow}
            className="admin-hero-link"
          />
          <Link className="admin-hero-link" href="/account">
            Account settings
          </Link>
        </div>
        <span className="admin-hero-orb" aria-hidden="true" />
      </section>

      {groups.length > 0 && (
        <section aria-labelledby="admin-areas-title">
          <div className="admin-section-heading">
            <h2 id="admin-areas-title">Your work areas</h2>
            <p>Jump straight to a queue or record.</p>
          </div>
          <div className="admin-areas">
            {groups.map(({ id, label, description, icon: Icon, links }) => (
              <div
                key={id}
                className="admin-area"
                data-tone={id === "operations" ? "navy" : undefined}
              >
                <div className="admin-area-heading">
                  <span className="admin-area-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3 id={`admin-area-${id}`}>{label}</h3>
                </div>
                <p>{description}</p>
                <ul aria-labelledby={`admin-area-${id}`}>
                  {[...links, ...(id === "support" ? supportExtras : [])].map(
                    (link) => (
                      <li key={link.href}>
                        <Link
                          className="admin-area-row"
                          href={link.href}
                          prefetch={false}
                        >
                          <span className="min-w-0 wrap-anywhere">
                            {link.label}
                          </span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="admin-foot">
        <div className="admin-note">
          <LockKeyhole size={18} aria-hidden="true" />
          <p>
            <strong>Access scope.</strong> {scope}
          </p>
        </div>
        <SignOut className="" />
      </div>
    </div>
  );
}
