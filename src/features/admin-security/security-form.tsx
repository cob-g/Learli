"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { safeBookingReturnPath } from "@/features/bookings/selection";

type Action =
  | "enable"
  | "verify-totp"
  | "verify-backup-code"
  | "generate-backup-codes"
  | "disable";
const subscribe = () => () => {};
const hydrated = () => true;
const serverHydrated = () => false;
export function AdminSecurityForm({
  enrolled = false,
  challenge = false,
  next,
}: {
  enrolled?: boolean;
  challenge?: boolean;
  next?: string;
}) {
  const ready = useSyncExternalStore(subscribe, hydrated, serverHydrated);
  const [pending, setPending] = useState(false);
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) status.current?.focus();
  }, [notice]);
  // Secret material is confined to this live document and removed on restoration.
  useEffect(() => {
    const clear = () => {
      setSecret("");
      setCodes([]);
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", restored);
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>, action: Action) {
    event.preventDefault();
    if (!ready || pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const field = action.startsWith("verify-") ? "code" : "password";
    const value = String(values.get(field) ?? "");
    if (!value || (action === "verify-totp" && !/^\d{6}$/.test(value))) {
      setNotice(
        field === "code"
          ? "Enter the current authenticator code or a saved recovery code, then try again."
          : "Enter your current password, then try again.",
      );
      (form.elements.namedItem(field) as HTMLInputElement | null)?.focus();
      return;
    }
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/auth/two-factor/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      // Never interpolate provider errors or credentials into a message.
      form.reset();
      if (!response.ok) {
        setNotice(
          response.status >= 500
            ? "Security changes may be incomplete. Sign in again and verify your authenticator or recovery code before continuing."
            : "Security verification could not be completed. Check your password or code and try again; repeated attempts may require a wait.",
        );
        return;
      }
      const result: { secret?: string; backupCodes?: string[] } =
        await response.json();
      if (action === "enable") {
        setSecret(result.secret ?? "");
        setCodes(result.backupCodes ?? []);
      } else if (action === "generate-backup-codes") {
        setCodes(result.backupCodes ?? []);
        setNotice(
          "Recovery codes replaced. Save these codes privately, then verify your authenticator again before opening administration.",
        );
      } else {
        setSecret("");
        setCodes([]);
        window.location.replace(
          action === "disable"
            ? "/account/security"
            : challenge
              ? safeBookingReturnPath(next)
              : "/account/security",
        );
      }
    } catch {
      form.reset();
      setNotice(
        "Security could not be confirmed. Sign in again and verify before continuing.",
      );
    } finally {
      setPending(false);
    }
  }
  const verifying = challenge || enrolled || !!secret;
  return (
    <div className="mt-8 max-w-xl space-y-8">
      {!ready && (
        <p className="text-body">
          JavaScript is required for secure authenticator setup and
          verification. No security change is made without it.
        </p>
      )}
      {secret && (
        <section aria-label="Authenticator setup" className="space-y-4">
          <p className="text-body">
            Enter this setup key manually in your authenticator app for Learli.
            This key is shown only in this document.
          </p>
          <p className="font-mono text-body break-all" data-mfa-secret>
            {secret}
          </p>
        </section>
      )}
      {!!codes.length && (
        <section aria-label="Recovery codes" className="space-y-4">
          <h2 className="text-section-title">Save recovery codes privately</h2>
          <p className="text-body">
            Each code can be used once. These codes disappear when you leave
            this page.
          </p>
          <ul className="space-y-2 font-mono text-body" data-mfa-secret>
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          {enrolled && (
            <Link
              className="inline-flex min-h-11 items-center"
              href="/account/security"
              onClick={(event) => {
                event.preventDefault();
                window.location.replace("/account/security");
              }}
            >
              Close recovery codes
            </Link>
          )}
        </section>
      )}
      {notice && (
        <p
          ref={status}
          tabIndex={-1}
          role="alert"
          className="text-body text-error"
        >
          {notice}
        </p>
      )}
      <form
        method="post"
        action="/api/auth/two-factor/verify-totp"
        onSubmit={(event) =>
          submit(
            event,
            verifying
              ? backup
                ? "verify-backup-code"
                : "verify-totp"
              : "enable",
          )
        }
        aria-busy={pending}
        className="space-y-4"
      >
        <label className="block text-label" htmlFor="mfa-proof">
          {verifying
            ? backup
              ? "Recovery code"
              : "Authenticator code"
            : "Current password"}
        </label>
        <input
          className="field"
          id="mfa-proof"
          name={verifying ? "code" : "password"}
          type="password"
          inputMode={verifying && !backup ? "numeric" : "text"}
          autoComplete={verifying ? "one-time-code" : "current-password"}
          maxLength={verifying ? 64 : 128}
          required
        />
        <button
          className="action action-primary transition-none"
          type="submit"
          disabled={!ready}
          aria-disabled={pending}
        >
          {pending
            ? "Verifying security…"
            : verifying
              ? "Verify administrator access"
              : "Set up authenticator"}
        </button>
      </form>
      {verifying && !secret && (
        <button
          className="action action-outline transition-none"
          type="button"
          onClick={() => {
            setBackup(!backup);
            setNotice("");
          }}
        >
          {backup ? "Use authenticator code" : "Use recovery code"}
        </button>
      )}
      {enrolled && !challenge && (
        <section className="space-y-4">
          <h2 className="text-section-title">Change recovery settings</h2>
          <p className="text-body">
            Verify your authenticator or recovery code within five minutes, then
            enter your current password. Replacing codes or disabling the
            authenticator removes administrator access until you verify again.
          </p>
          <form
            method="post"
            action="/api/auth/two-factor/generate-backup-codes"
            onSubmit={(event) =>
              submit(
                event,
                (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) === "disable"
                  ? "disable"
                  : "generate-backup-codes",
              )
            }
            aria-busy={pending}
            className="space-y-4"
          >
            <label className="block text-label" htmlFor="mfa-password">
              Current password for security change
            </label>
            <input
              className="field"
              id="mfa-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
            <div className="flex flex-wrap gap-4">
              <button
                className="action action-outline transition-none"
                disabled={!ready}
                aria-disabled={pending}
                type="submit"
                value="rotate"
              >
                Replace recovery codes
              </button>
              <button
                className="action action-outline transition-none"
                disabled={!ready}
                aria-disabled={pending}
                type="submit"
                value="disable"
              >
                Disable authenticator
              </button>
            </div>
          </form>
          <p className="text-body">
            To replace the authenticator, disable it with your current proof and
            password, then enroll the replacement. Losing your password and
            every factor or recovery code requires deliberate owner-controlled
            recovery.
          </p>
        </section>
      )}
      <Link className="inline-flex min-h-11 items-center" href="/account">
        Return to account
      </Link>
    </div>
  );
}
