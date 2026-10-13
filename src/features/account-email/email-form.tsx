"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native recovery replaces potentially stale private identity state after credential mutation. */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { emailChangeInput } from "./input";

const subscribe = () => () => {};
export function EmailForm({
  currentEmail,
  hosted = false,
}: {
  currentEmail: string;
  hosted?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [stage, setStage] = useState<"start" | "current" | "new">("start");
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{
    newEmail?: string;
    code?: string;
  }>({});
  const [notice, setNotice] = useState<{
    message: string;
    failed: boolean;
    uncertain?: boolean;
  }>();
  const message = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    // Focus only after the result notice and its ref have committed.
    if (notice) message.current?.focus();
  }, [notice]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || notice?.uncertain) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input =
      stage === "start"
        ? { action: "start" }
        : {
            action: stage === "current" ? "request" : "confirm",
            newEmail: stage === "current" ? data.get("newEmail") : newEmail,
            code: data.get("code"),
          };
    const parsed = emailChangeInput.safeParse(input);
    if (!parsed.success) {
      // Retain only fixed instructions, never issue payloads or proof values.
      const invalidEmail = parsed.error.issues.some(
        (issue) => issue.path[0] === "newEmail",
      );
      const invalidCode = parsed.error.issues.some(
        (issue) => issue.path[0] === "code",
      );
      setErrors({
        newEmail: invalidEmail
          ? "Enter a synthetic .test email address."
          : undefined,
        code: invalidCode
          ? stage === "current"
            ? "Enter the six-digit current-address code."
            : "Enter the six-digit new-address code."
          : undefined,
      });
      setNotice(undefined);
      const firstInvalid = form.querySelector<HTMLInputElement>(
        stage === "current" && invalidEmail
          ? '[name="newEmail"]'
          : '[name="code"]',
      );
      requestAnimationFrame(() => firstInvalid?.focus());
      return;
    }
    setErrors({});
    submitting.current = true;
    setPending(true);
    setNotice(undefined);
    // Codes never persist in React state, URLs, browser storage or status text.
    const codeField = form.querySelector<HTMLInputElement>('[name="code"]');
    if (codeField) codeField.value = "";
    try {
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      const code =
        body && typeof body === "object" && "code" in body ? body.code : null;
      if (response.ok) {
        if (parsed.data.action === "confirm") {
          window.location.replace("/account");
          return;
        }
        if (parsed.data.action === "request") setNewEmail(parsed.data.newEmail);
        setErrors({});
        setStage(parsed.data.action === "start" ? "current" : "new");
        setNotice({
          message: hosted
            ? "A confirmation request was accepted. Check the requested address for its code; delivery has not been established."
            : parsed.data.action === "start"
              ? "A current-address confirmation code is available in your private local capture. No email was sent."
              : "If the new address can be used, its code is available in your private local capture. Your current email is still unchanged.",
          failed: false,
        });
      } else {
        setNotice({
          failed: true,
          uncertain: code === "CHANGE_UNCERTAIN" || response.status >= 500,
          message:
            response.status >= 500
              ? "Your email may already have changed, and other sessions may still be signed in. Open your account to check the saved address and manage sessions before starting another change."
              : code === "SESSION_NOT_FRESH" || response.status === 401
                ? "Sign out, then sign in again to change your email."
                : response.status === 429
                  ? "Too many confirmation attempts. Wait a minute, then try again."
                  : response.status === 409
                    ? "Account changes are busy. Try again shortly."
                    : response.status === 403
                      ? "Email changes are unavailable on this account. Check your sign-in status or contact support."
                      : "Confirmation refused. Check the address and code, or restart confirmation.",
        });
      }
    } catch {
      setNotice({
        failed: true,
        uncertain: true,
        message:
          "Your email may already have changed, and other sessions may still be signed in. Open your account to check the saved address and manage sessions before starting another change.",
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const label =
    stage === "start"
      ? "Send current-address code"
      : stage === "current"
        ? "Confirm current address"
        : "Confirm new address";
  return (
    <section aria-labelledby="email-confirm-heading" className="max-w-prose">
      <ol
        aria-label="Email confirmation progress"
        className="mb-6 grid gap-3 border-b border-border pb-4 text-small sm:grid-cols-3"
      >
        {[
          ["start", "1. Confirm ownership"],
          ["current", "2. Verify current address"],
          ["new", "3. Verify new address"],
        ].map(([step, label]) => (
          <li
            key={step}
            aria-current={stage === step ? "step" : undefined}
            className={
              stage === step
                ? "font-medium text-primary"
                : "text-muted-foreground"
            }
          >
            {label}
          </li>
        ))}
      </ol>
      <h2 id="email-confirm-heading" className="text-section-title">
        {stage === "start"
          ? "Confirm ownership"
          : stage === "current"
            ? "Verify current address"
            : "Verify new address"}
      </h2>
      <p className="mt-4 text-body wrap-anywhere">
        Current email: {currentEmail}
      </p>
      {stage === "new" && (
        <p className="mt-2 text-body wrap-anywhere">
          Pending new email: {newEmail}
        </p>
      )}
      <p id="email-help" className="mt-4 text-body text-muted-foreground">
        Both addresses must be verified before your email changes. Codes expire
        in five minutes. Completion ends your other signed-in sessions and keeps
        this session.
      </p>
      {!ready && (
        <p className="mt-4 text-body">
          Enable JavaScript to change your email here.
        </p>
      )}
      <form
        method="post"
        action="/api/account/email"
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-describedby="email-help"
        className="mt-6 space-y-6"
      >
        <fieldset
          disabled={!ready || pending || notice?.uncertain}
          className="space-y-6"
        >
          <legend className="sr-only">Email confirmation</legend>
          {stage === "current" && (
            <div className="space-y-2">
              <label htmlFor="email-new" className="block text-label">
                New test email
              </label>
              <input
                id="email-new"
                name="newEmail"
                type="email"
                autoComplete="email"
                className="field"
                required
                maxLength={254}
                aria-invalid={!!errors.newEmail}
                aria-describedby={
                  errors.newEmail ? "email-new-error" : undefined
                }
                onInput={() =>
                  setErrors((previous) => ({
                    ...previous,
                    newEmail: undefined,
                  }))
                }
              />
              {errors.newEmail && (
                <p id="email-new-error" className="text-body text-error">
                  {errors.newEmail}
                </p>
              )}
            </div>
          )}
          {stage !== "start" && (
            <div className="space-y-2">
              <label htmlFor="email-code" className="block text-label">
                {stage === "current"
                  ? "Current-address code"
                  : "New-address code"}
              </label>
              <input
                id="email-code"
                name="code"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                className="field"
                required
                minLength={6}
                maxLength={6}
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? "email-code-error" : undefined}
                onInput={() =>
                  setErrors((previous) => ({ ...previous, code: undefined }))
                }
              />
              {errors.code && (
                <p id="email-code-error" className="text-body text-error">
                  {errors.code}
                </p>
              )}
            </div>
          )}
          <button
            type="submit"
            className="action action-primary w-full transition-none sm:w-auto"
          >
            {pending ? "Confirming…" : label}
          </button>
        </fieldset>
        {pending && (
          <p role="status" className="text-body">
            Checking email confirmation.
          </p>
        )}
        {notice && (
          <p
            ref={message}
            tabIndex={-1}
            role={notice.failed ? "alert" : "status"}
            className={
              notice.failed
                ? "rounded-control border border-error p-4 text-body text-error"
                : "rounded-control border border-border bg-subtle p-4 text-body"
            }
          >
            {notice.message}
          </p>
        )}
        {stage !== "start" && !notice?.uncertain && (
          <button
            type="button"
            className="action action-outline"
            disabled={pending}
            onClick={() => {
              setStage("start");
              setNewEmail("");
              setNotice(undefined);
              setErrors({});
            }}
          >
            Restart confirmation
          </button>
        )}
      </form>
      {notice?.failed && (
        <nav
          aria-label="Email change recovery"
          className="mt-4 flex flex-wrap gap-x-6 gap-y-2"
        >
          <a className="inline-flex min-h-11 items-center" href="/account">
            Check saved account
          </a>
          <a
            className="inline-flex min-h-11 items-center"
            href="/account/sessions"
          >
            Manage account sessions
          </a>
          <a
            className="inline-flex min-h-11 items-center"
            href="/sign-in?next=%2Faccount%2Femail"
          >
            Sign in again
          </a>
          <a className="inline-flex min-h-11 items-center" href="/support">
            Contact support
          </a>
        </nav>
      )}
    </section>
  );
}
