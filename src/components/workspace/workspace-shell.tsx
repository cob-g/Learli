"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/db/schema/app";
import { BrandLogo } from "@/components/shared/brand-logo";
import { SignedInAccount } from "@/components/shared/header-account";
import { SignOut } from "@/features/auth/sign-out";
import {
  currentWorkspace,
  isCurrentLink,
  workspaceLabels,
  workspaceLinks,
} from "./navigation";

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
export function WorkspaceShell({ children }: { children: ReactNode }) {
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
  return (
    <div className="workspace-shell">
      {userId ? (
        <AccountChrome
          key={`${userId}:${session.data?.session.id}`}
          pathname={pathname}
          scope={scope}
          userId={userId}
          refreshing={session.isRefetching}
        />
      ) : (
        <WorkspaceChrome
          pathname={pathname}
          account={null}
          roles={null}
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
}: {
  pathname: string;
  userId: string;
  scope: string | null;
  refreshing: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const pathKey = JSON.stringify([pathname, scope, refreshing]);
  const [visit, setVisit] = useState({ pathKey, revision: 0 });
  if (visit.pathKey !== pathKey)
    setVisit({ pathKey, revision: visit.revision + 1 });
  // A -> B -> A is a new read too, even when B has not finished loading.
  const requestKey = JSON.stringify([pathKey, visit.revision, attempt]);
  const [result, setResult] = useState<{
    key: string;
    account: Account | null;
  } | null>(null);
  if (refreshing && result) setResult(null);
  const pending = result?.key !== requestKey;
  const failed = !pending && !result?.account;
  useEffect(() => {
    if (refreshing) return;
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
  }, [userId, requestKey, refreshing]);
  // Navigation revalidates through this guarded GET (including server session
  // and current grants). Only link presentation survives that wait, never names.
  // Provider refresh discards evidence; errors/identity changes unmount it.
  // The selected role enum may survive a refresh, but needs fresh grants to show.
  return (
    <WorkspaceChrome
      pathname={pathname}
      scope={scope}
      account={pending ? null : (result?.account ?? null)}
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
}: {
  pathname: string;
  account: Account | null;
  roles: readonly Role[] | null;
  message?: string;
  retry?: () => void;
  canSignOut?: boolean;
  scope?: string | null;
  preserveContext?: boolean;
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
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("a, summary")?.focus();
  }, [open]);
  const links = workspaceLinks(role);
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
  return (
    <>
      <header className="workspace-topbar" aria-label="Workspace account">
        <div className="workspace-heading">
          <button
            ref={trigger}
            type="button"
            className="action action-outline workspace-menu-toggle"
            aria-label="Workspace menu"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpenRoute(open ? null : routeKey)}
          >
            {open ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}{" "}
            Menu
          </button>
          <p className="workspace-current text-label-strong">{title}</p>
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
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    prefetch={false}
                    href={link.href}
                    className="workspace-link"
                    aria-current={
                      isCurrentLink(pathname, link, scope) ? "page" : undefined
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <nav aria-label="Workspace navigation" className="workspace-secondary">
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
            Contact support
          </Link>
          <Link href="/report-a-concern" className="workspace-link">
            Report a concern
          </Link>
          {/* Replacing the private document keeps public/auth entry free of its bootstrap. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="workspace-link">
            Visit website <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </nav>
      </aside>
    </>
  );
}
