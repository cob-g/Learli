"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Copy, Settings, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { SignOut } from "@/features/auth/sign-out";
import { authClient } from "@/lib/auth-client";
import { nameInitials } from "@/lib/initials";

/** Presentation only. The account destination still authorizes every request. */
export function HeaderAccount() {
  const pathname = usePathname();
  const { data, isPending, isRefetching, error, refetch } =
    authClient.useSession();
  const previousPath = useRef(pathname);
  // After a failure the provider clears its error as a retry starts while still
  // holding old data. Stay neutral until a refetch settles cleanly.
  const [failed, setFailed] = useState(false);
  if (error && !failed) setFailed(true);
  if (failed && !error && !isPending && !isRefetching) setFailed(false);
  // Better Auth reports a refetch without a session as pending too, so a
  // signed-out visitor would see "Checking account…" on every navigation.
  // Once a clean result has settled, keep showing it while a refetch runs.
  const [settled, setSettled] = useState(false);
  if (!settled && !error && !isPending && !isRefetching) setSettled(true);
  const pending = isPending && !(settled && isRefetching);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // App account edits do not emit a Better Auth mutation signal. Revalidate
    // on navigation as well as the provider's focus/online/cross-tab refresh.
    void refetch();
  }, [pathname, refetch]);

  // A refetch keeps the last settled rendering (signed-in chip or Sign in), so
  // the header does not flicker on navigation or tab focus.
  if (error || pending || failed) {
    return (
      <div className="header-account-fallback">
        {/* Native navigation always reauthorizes the account document. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/account" className="nav-link">
          Account
        </a>
        <div
          className={
            error
              ? "header-account-panel text-small text-muted-foreground"
              : "text-small text-muted-foreground"
          }
          aria-live="polite"
        >
          {error ? (
            <>
              <p>Account status unavailable.</p>
              <button
                type="button"
                className="nav-link"
                disabled={isRefetching}
                onClick={() => void refetch()}
              >
                {isRefetching ? "Checking account…" : "Try again"}
              </button>
            </>
          ) : (
            // The native Account link is sufficient without scripts.
            <span className="header-account-checking">Checking account…</span>
          )}
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <Link
        href="/sign-in"
        className="nav-link"
        aria-current={pathname === "/sign-in" ? "page" : undefined}
      >
        Sign in
      </Link>
    );
  }

  const name = data.user.name.trim() || "Your account";
  return (
    <SignedInAccount
      key={`${pathname}:${data.user.id}:${name}`}
      name={name}
      email={data.user.email}
      pathname={pathname}
    />
  );
}

/** Copies the user's own address; the result is announced, never guessed. */
function CopyEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const reset = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(reset);
  }, [state]);
  return (
    <>
      <button
        type="button"
        className="account-pass-copy"
        aria-label="Copy email"
        onClick={() => {
          (navigator.clipboard
            ? navigator.clipboard.writeText(email)
            : Promise.reject(new Error("Clipboard unavailable"))
          ).then(
            () => setState("copied"),
            () => setState("failed"),
          );
        }}
      >
        {state === "copied" ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Email copied"
          : state === "failed"
            ? "The email could not be copied"
            : ""}
      </span>
    </>
  );
}

export function SignedInAccount({
  name,
  email,
  role,
  pathname,
}: {
  name: string;
  /** The signed-in user's own address, shown only inside their menu. */
  email?: string | null;
  /** The workspace being used, when there is one (e.g. "Tutor"). */
  role?: string | null;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const settingsHint = useId();
  const initials = nameInitials(name);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      ref={root}
      className="header-account"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Disabling SignOut while its request runs can blur it with no next
        // target. Keep its pending/error state mounted until focus actually
        // leaves the disclosure, or an outside pointer/Escape dismisses it.
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="header-account-trigger"
        type="button"
        aria-label={`Account ${name}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="header-account-initials text-label" aria-hidden="true">
          {initials}
        </span>
        <span className="header-account-label">
          <span className="text-small">Account</span>
          <bdi className="text-label-strong">{name}</bdi>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        // The account pass: who is signed in on the stub, the two account
        // actions below the tear. Still a disclosure of a link and a button.
        <div id={panelId} className="header-account-panel account-pass">
          <div className="account-pass-stub">
            <span className="account-pass-slot" aria-hidden="true" />
            <span className="account-pass-avatar" aria-hidden="true">
              {initials || <UserRound size={28} />}
            </span>
            <span className="account-pass-name" dir="auto">
              {name}
            </span>
            {role && <span className="account-pass-role">{role}</span>}
            {email && (
              <span className="account-pass-mail">
                <span dir="auto">{email}</span>
                <CopyEmail email={email} />
              </span>
            )}
          </div>
          <div className="account-pass-actions">
            {/* Clear the previous document before loading private account data. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/account"
              className="account-pass-action account-pass-settings"
              aria-current={pathname === "/account" ? "page" : undefined}
              aria-describedby={settingsHint}
            >
              <Settings size={20} aria-hidden="true" />
              <span>
                <b>Account settings</b>
                <small id={settingsHint} aria-hidden="true">
                  Profile and password
                </small>
              </span>
            </a>
            <SignOut variant="tile" className="account-pass-out" />
          </div>
        </div>
      )}
    </div>
  );
}
