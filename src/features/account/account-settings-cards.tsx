import Link from "next/link";
import {
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutGrid,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/db/schema/app";
import type { TimeZoneOption } from "@/lib/time/zones";
import { AccountForm } from "@/features/account/account-form";
import { PasswordForm } from "@/features/account-password/password-form";
import { SignOut } from "@/features/auth/sign-out";
import { AdmissionEntry } from "@/features/learner-admission/navigation";
import "./account-settings-cards.css";
import { nameInitials } from "@/lib/initials";

const roleIcons: Record<Role, LucideIcon> = {
  admin: LayoutGrid,
  parent: Users,
  student: GraduationCap,
  tutor: UserCheck,
};

function Row({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <Link className="settings-link" href={href}>
      <span className="settings-link-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      {children}
      <ChevronRight className="settings-chevron" size={16} aria-hidden="true" />
    </Link>
  );
}

/** Card layout for Admin and Tutor accounts. Presentation only; the page has already read the signed-in account. */
export function AccountSettingsCards({
  account,
  timeZones,
  workspaceRoles,
  localWorkflow,
}: {
  account: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    roles: Role[];
  };
  timeZones: TimeZoneOption[];
  workspaceRoles: Role[];
  localWorkflow: boolean;
}) {
  return (
    <div className="workspace-page">
      <header className="settings-me">
        <span className="settings-avatar" aria-hidden="true">
          {nameInitials(account.name) || <UserRound size={24} />}
        </span>
        <div className="min-w-0">
          <h1>Your account</h1>
          <p className="wrap-anywhere">Signed in as {account.email}</p>
        </div>
      </header>
      <div className="settings-columns">
        <div className="settings-main">
          <section
            aria-labelledby="account-profile-heading"
            className="account-panel"
          >
            <div className="account-panel-head">
              <span className="account-panel-icon" aria-hidden="true">
                <UserRound size={20} />
              </span>
              <h2 id="account-profile-heading">Profile settings</h2>
            </div>
            <AccountForm account={account} timeZones={timeZones} panel />
          </section>
          <PasswordForm panel />
        </div>
        <div className="settings-side">
          <div className="account-panel settings-links">
            <h2>Your workspaces</h2>
            {workspaceRoles.length ? (
              <nav aria-label="Your workspaces">
                {workspaceRoles.map((role) => (
                  <Row key={role} href={`/${role}`} icon={roleIcons[role]}>
                    {role === "parent"
                      ? "Parent Dashboard"
                      : `${role.charAt(0).toUpperCase() + role.slice(1)} workspace`}
                  </Row>
                ))}
              </nav>
            ) : (
              <p className="settings-empty">
                {account.roles.length
                  ? "No workspace with current access is available."
                  : "No workspace role has been assigned to this account."}
              </p>
            )}
            {!account.roles.includes("parent") && (
              <Row href="/parent/onboarding" icon={Users}>
                Set up parent workspace
              </Row>
            )}
            <Row href="/student/onboarding" icon={GraduationCap}>
              {account.roles.includes("student")
                ? "College Student setup and status"
                : "Set up College Student"}
            </Row>
            <AdmissionEntry
              localWorkflow={localWorkflow}
              className="settings-link"
              leading={
                <span className="settings-link-icon" aria-hidden="true">
                  <FileText size={16} />
                </span>
              }
              trailing={
                <ChevronRight
                  className="settings-chevron"
                  size={16}
                  aria-hidden="true"
                />
              }
            />
            <section aria-labelledby="account-access-heading">
              <h2 id="account-access-heading">Account access</h2>
              <nav aria-label="Account settings">
                <Row href="/account/email" icon={Mail}>
                  Change account email
                </Row>
                <Row href="/account/sessions" icon={MonitorSmartphone}>
                  Manage account sessions
                </Row>
                {account.roles.includes("admin") && (
                  <Row href="/account/security" icon={ShieldCheck}>
                    Administrator security
                  </Row>
                )}
              </nav>
            </section>
          </div>
          <div className="settings-signout">
            <p>Signed in on this device</p>
            <SignOut className="" />
          </div>
        </div>
      </div>
    </div>
  );
}
