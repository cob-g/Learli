"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  Flag,
  Globe,
  Inbox,
  Menu,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/db/schema/app";
import { BrandLogo } from "@/components/shared/brand-logo";
import { SignedInAccount } from "@/components/shared/header-account";
import { SignOut } from "@/features/auth/sign-out";
import { groupAdminLinks } from "@/features/admin/admin-navigation";
import { groupTutorLinks } from "@/features/tutors/tutor-navigation";
import type { GroupedNavLink } from "./link-groups";
import {
  currentWorkspace,
  isCurrentLink,
  workspaceLabels,
  workspaceLinks,
} from "./navigation";

// Admin and Tutor chrome only; other workspaces keep their text-only links.
const sharedIcons: Record<string, LucideIcon> = {
  "/support": Inbox,
  "/account": Settings,
  "/contact": CircleHelp,
  "/report-a-concern": Flag,
};
function LinkIcon({ icon: Icon }: { icon?: LucideIcon | null }) {
  return Icon ? (
    <Icon className="workspace-link-icon" size={18} aria-hidden="true" />
  ) : null;
}

type Account = { id: string; name: string; roles: Role[] };
function parseAccount(value: unknown, userId: string): Account | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    value.id !== userId ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("roles" in value) ||
    !Array.isArray(value.roles)
  )
    return null;
  if (
    !value.roles.every(
      (role): role is Role =>
        typeof role === "string" && Object.hasOwn(workspaceLabels, role),
    )
  )
    return null;
  return {
    id: userId,
    name: value.name.trim() || "Your account",
    roles: [...new Set(value.roles)],
  };
}

/** Presentation only. Every page and endpoint retains its existing server guard. */
export function WorkspaceShell({
  children,
  initialAccount = null,
  screeningEnabled = false,
  privateWorkflow = false,
  privateAccounts = false,
  localWorkflow = false,
}: {
  children: ReactNode;
  /** The server's guarded account read for this document, if it succeeded. */
  initialAccount?: (Account & { sessionId: string }) | null;
  /** Deployment-level screening switch decided by the server layout. */
  screeningEnabled?: boolean;
  privateWorkflow?: boolean;
  privateAccounts?: boolean;
  localWorkflow?: boolean;
}) {
  const pathname = usePathname();
  const scope = useSearchParams().get("scope");
  const session = authClient.useSession();
  const { refetch } = session;
  useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener("learli:account-updated", refresh);
    return () => window.removeEventListener("learli:account-updated", refresh);
  }, [refetch]);
  const waiting = session.isPending || session.isRefetching;
  const userId =
    !session.isPending && !session.error ? session.data?.user.id : undefined;
  // Until the provider session first settles, show the account the server read
  // for this document so the first paint has the full sidebar. A settled
  // session for the same user and session keeps it (same key, no remount);
  // anything else discards it.
  const initial =
    initialAccount && parseAccount(initialAccount, initialAccount.id);
  const chromeUser =
    userId ?? (session.isPending && initial ? initial.id : undefined);
  const chromeSession = userId
    ? session.data?.session.id
    : initialAccount?.sessionId;
  return (
    <div className="workspace-shell">
      {chromeUser ? (
        <AccountChrome
          key={`${chromeUser}:${chromeSession}`}
          pathname={pathname}
          scope={scope}
          userId={chromeUser}
          screeningEnabled={screeningEnabled}
          privateWorkflow={privateWorkflow}
          privateAccounts={privateAccounts}
          localWorkflow={localWorkflow}
          // Better Auth also flags its first load as refetching; only a
          // refresh of a settled session discards the shown account.
          refreshing={session.isRefetching && !session.isPending}
          confirmed={Boolean(userId)}
          initial={
            initial?.id === chromeUser &&
            initialAccount?.sessionId === chromeSession
              ? initial
              : null
          }
        />
      ) : (
        <WorkspaceChrome
          pathname={pathname}
          account={null}
          roles={null}
          screeningEnabled={screeningEnabled}
          privateWorkflow={privateWorkflow}
          privateAccounts={privateAccounts}
          localWorkflow={localWorkflow}
          message={
            session.error
              ? "Account status unavailable."
              : waiting
                ? "Checking account…"
                : "Sign in to open your workspace."
          }
          retry={session.error ? () => void refetch() : undefined}
        />
      )}
      <main id="main-content" tabIndex={-1} className="workspace-main">
        {children}
      </main>
    </div>
  );
}

function AccountChrome({
  pathname,
  userId,
  scope,
  refreshing,
  confirmed,
  initial,
  screeningEnabled,
  privateWorkflow,
  privateAccounts,
  localWorkflow,
}: {
  pathname: string;
  userId: string;
  scope: string | null;
  refreshing: boolean;
  /** False while only the server's read vouches for this user and session. */
  confirmed: boolean;
  initial: Account | null;
  screeningEnabled: boolean;
  privateWorkflow: boolean;
  privateAccounts: boolean;
  localWorkflow: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const pathKey = JSON.stringify([pathname, scope, refreshing]);
  const [visit, setVisit] = useState({ pathKey, revision: 0 });
  if (visit.pathKey !== pathKey)
    setVisit({ pathKey, revision: visit.revision + 1 });
  // A -> B -> A is a new read too, even when B has not finished loading.
  const requestKey = JSON.stringify([pathKey, visit.revision, attempt]);
  // The server already read this account for the document's first visit, so
  // that visit needs no repeat GET. Every later visit reads again as before.
  const [seed] = useState(() => (initial ? requestKey : null));
  const [result, setResult] = useState<{
    key: string;
    account: Account | null;
  } | null>(() => (seed && initial ? { key: seed, account: initial } : null));
  // The shown account stays through navigation and provider refreshes of this
  // same user and session; it is replaced only by a settled read (new data or a
  // failure). A different user or session remounts this component via its key.
  const pending = result?.key !== requestKey;
  const failed = !pending && !result?.account;
  useEffect(() => {
    if (refreshing || !confirmed || requestKey === seed) return;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/account/${encodeURIComponent(userId)}`,
          { cache: "no-store", signal: abort.signal },
        );
        const account = response.ok
          ? parseAccount(await response.json(), userId)
          : null;
        if (!account) throw new Error("Unavailable");
        if (!abort.signal.aborted) {
          setResult({ key: requestKey, account });
        }
      } catch {
        if (!abort.signal.aborted)
          setResult({ key: requestKey, account: null });
      }
    }
    void load();
    return () => abort.abort();
  }, [userId, requestKey, refreshing, confirmed, seed]);
  // Navigation and provider refreshes revalidate through this guarded GET. The
  // last validated name and roles stay visible while it is pending (display
  // only; server guards stay authoritative) and are replaced when it resolves or
  // dropped when it fails. Identity changes unmount this component.
  return (
    <WorkspaceChrome
      pathname={pathname}
      scope={scope}
      screeningEnabled={screeningEnabled}
      privateWorkflow={privateWorkflow}
      privateAccounts={privateAccounts}
      localWorkflow={localWorkflow}
      account={result?.account ?? null}
      roles={result?.account?.roles ?? null}
      preserveContext={result === null}
      message={
        refreshing
          ? "Checking account…"
          : failed
            ? "Workspace access unavailable."
            : pending
              ? "Checking workspace access…"
              : undefined
      }
      retry={failed ? () => setAttempt((value) => value + 1) : undefined}
      canSignOut
    />
  );
}

function WorkspaceChrome({
  pathname,
  account,
  roles,
  message,
  retry,
  canSignOut = false,
  scope,
  preserveContext = false,
  screeningEnabled = false,
  privateWorkflow = false,
  privateAccounts = false,
  localWorkflow = false,
}: {
  pathname: string;
  account: Account | null;
  roles: readonly Role[] | null;
  message?: string;
  retry?: () => void;
  canSignOut?: boolean;
  scope?: string | null;
  preserveContext?: boolean;
  screeningEnabled?: boolean;
  privateWorkflow?: boolean;
  privateAccounts?: boolean;
  localWorkflow?: boolean;
}) {
  const routeKey = JSON.stringify([pathname, scope]);
  const [openRoute, setOpenRoute] = useState<string | null>(null);
  const open = openRoute === routeKey;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const [context, setContext] = useState<Role | null>(null);
  const role = currentWorkspace(pathname, roles ?? [], context);
  // Adjust render-local context before children commit so rapid navigation,
  // denied routes and revoked grants cannot restore an older role selection.
  if (context !== role && !(roles === null && preserveContext))
    setContext(role);
  const title = role ? workspaceLabels[role] : "Your account";
  const admin = role === "admin";
  // Workspaces moved to the grouped, iconed sidebar so far.
  const styled = admin || role === "tutor";
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("a, summary")?.focus();
  }, [open]);
  const links = workspaceLinks(role, {
    screening: screeningEnabled,
    privateWorkflow,
    privateAccounts,
    localWorkflow,
  });
  // The sidebar's aria-current link already names the page for assistive tech.
  const common = [
    ...(role === null
      ? (roles ?? [])
          .filter((item) => item !== "admin")
          .map((item) => ({
            href: `/bookings?scope=${item === "parent" ? "guardian" : item}`,
            label: `${item.charAt(0).toUpperCase() + item.slice(1)} booking history`,
          }))
      : []),
    { href: "/support", label: "Support requests" },
    { href: "/account", label: "Account settings" },
  ];
  // The breadcrumb names the current role or shared destination.
  const page = [...links, ...common].find(
    (link) =>
      link.href !== "/admin" &&
      !link.href.startsWith("/bookings?") &&
      isCurrentLink(pathname, link, scope),
  );
  return (
    <>
      <header
        className="workspace-topbar"
        aria-label="Workspace account"
        data-workspace={role ?? undefined}
        data-styled={styled || undefined}
      >
        <div className="workspace-heading">
          <button
            ref={trigger}
            type="button"
            className="action action-outline workspace-menu-toggle"
            aria-label="Workspace menu"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpenRoute(open ? null : routeKey)}
            onKeyDown={(event) => {
              // The toggle sits outside the sidebar, so it handles Escape itself.
              if (event.key === "Escape" && open) {
                event.preventDefault();
                setOpenRoute(null);
              }
            }}
          >
            {open ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}{" "}
            Menu
          </button>
          {admin && (
            <span
              className="workspace-crumb workspace-crumb-root text-small"
              aria-hidden="true"
            >
              learli <span>/</span>
            </span>
          )}
          <p className="workspace-current text-label-strong">{title}</p>
          {styled && page && (
            <span className="workspace-crumb text-small" aria-hidden="true">
              <span>/</span>
              <b>{page.label}</b>
            </span>
          )}
        </div>
        <div className="workspace-account">
          {account ? (
            <SignedInAccount
              key={`${pathname}:${account.id}:${account.name}`}
              name={account.name}
              pathname={pathname}
            />
          ) : (
            <div className="workspace-account-fallback text-small">
              {/* Native entry always reauthorizes, including when scripts fail. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/account" className="nav-link">
                Account
              </a>
              <div
                className={retry ? "header-account-panel" : undefined}
                aria-live="polite"
              >
                <p>{message}</p>
                {retry && (
                  <button type="button" className="nav-link" onClick={retry}>
                    Try again
                  </button>
                )}
                {canSignOut && retry && <SignOut className="mt-2" />}
              </div>
            </div>
          )}
        </div>
      </header>
      <aside
        ref={panel}
        id={panelId}
        className="workspace-sidebar"
        data-open={open || undefined}
        data-workspace={role ?? undefined}
        data-styled={styled || undefined}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) {
            const chooser = panel.current?.querySelector("details[open]");
            if (chooser?.contains(document.activeElement))
              chooser.querySelector("summary")?.focus();
            chooser?.removeAttribute("open");
            setOpenRoute(null);
            if (open) trigger.current?.focus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpenRoute(null);
            trigger.current?.focus();
          }
        }}
      >
        <Link
          href="/account"
          className="workspace-brand"
          aria-label="Learli account"
        >
          <BrandLogo />
        </Link>
        {styled && (
          <p className="workspace-role">{admin ? "Admin" : "Tutor"}</p>
        )}
        {roles && (
          <div className="workspace-chooser">
            {roles.length > 1 ? (
              <details key={routeKey}>
                <summary className="nav-link">Switch workspace</summary>
                <nav aria-label="Your workspaces">
                  {roles.map((item) => (
                    <Link
                      key={item}
                      href={`/${item}`}
                      prefetch={false}
                      className="workspace-link"
                      aria-current={role === item ? "true" : undefined}
                    >
                      {workspaceLabels[item]}
                    </Link>
                  ))}
                </nav>
              </details>
            ) : roles.length === 1 && role === null ? (
              <Link
                href={`/${roles[0]}`}
                prefetch={false}
                className="workspace-link"
              >
                {workspaceLabels[roles[0]]}
              </Link>
            ) : roles.length === 0 ? (
              <p className="text-small text-muted-foreground">
                No workspace assigned.
              </p>
            ) : null}
          </div>
        )}
        {links.length > 0 && (
          <nav
            aria-label={`${role === "admin" ? "Admin" : role === "tutor" ? "Tutor" : role === "parent" ? "Parent" : "Student"} work areas`}
          >
            {styled ? (
              <GroupedLinks
                grouped={
                  admin ? groupAdminLinks(links) : groupTutorLinks(links)
                }
                pathname={pathname}
                scope={scope}
              />
            ) : (
              <ul>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      prefetch={false}
                      href={link.href}
                      className="workspace-link"
                      aria-current={
                        isCurrentLink(pathname, link, scope)
                          ? "page"
                          : undefined
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        )}
        <nav aria-label="Workspace navigation" className="workspace-secondary">
          {role === "tutor" && <p className="workspace-group-title">Account</p>}
          <ul>
            {common.map((link) => (
              <li key={link.href}>
                <Link
                  prefetch={false}
                  href={link.href}
                  className="workspace-link"
                  aria-current={
                    (
                      link.href.startsWith("/bookings?")
                        ? pathname.startsWith("/bookings") &&
                          link.href === `/bookings?scope=${scope}`
                        : isCurrentLink(pathname, link, scope)
                    )
                      ? "page"
                      : undefined
                  }
                >
                  {styled && <LinkIcon icon={sharedIcons[link.href]} />}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Website and help" className="workspace-secondary">
          {roles?.some((item) => item === "parent" || item === "student") && (
            <Link href="/tutors" className="workspace-link">
              Find a tutor
            </Link>
          )}
          <Link href="/contact" className="workspace-link">
            {styled && <LinkIcon icon={CircleHelp} />}
            Contact support
          </Link>
          <Link href="/report-a-concern" className="workspace-link">
            {styled && <LinkIcon icon={Flag} />}
            Report a concern
          </Link>
          {/* Replacing the private document keeps public/auth entry free of its bootstrap. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="workspace-link">
            {styled && <LinkIcon icon={Globe} />}
            Visit website <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </nav>
      </aside>
    </>
  );
}

function GroupedLinks({
  grouped: { ungrouped, groups },
  pathname,
  scope,
}: {
  grouped: {
    ungrouped: GroupedNavLink[];
    groups: { id: string; label: string; links: GroupedNavLink[] }[];
  };
  pathname: string;
  scope: string | null | undefined;
}) {
  const item = (link: GroupedNavLink) => (
    <li key={link.href}>
      <Link
        prefetch={false}
        href={link.href}
        className="workspace-link"
        aria-current={isCurrentLink(pathname, link, scope) ? "page" : undefined}
      >
        <LinkIcon icon={link.icon} />
        {link.label}
      </Link>
    </li>
  );
  return (
    <>
      {ungrouped.length > 0 && (
        <ul className="workspace-group">{ungrouped.map(item)}</ul>
      )}
      {groups.map((group) => (
        <div key={group.id} className="workspace-group">
          <p
            id={`workspace-group-${group.id}`}
            className="workspace-group-title"
          >
            {group.label}
          </p>
          <ul aria-labelledby={`workspace-group-${group.id}`}>
            {group.links.map(item)}
          </ul>
        </div>
      ))}
    </>
  );
}
