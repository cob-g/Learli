"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { passwordChangeInput } from "./input";

type Field = "currentPassword" | "newPassword" | "confirmPassword";
const fields: { name: Field; label: string; autoComplete: string }[] = [
  {
    name: "currentPassword",
    label: "Current password",
    autoComplete: "current-password",
  },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  {
    name: "confirmPassword",
    label: "Confirm new password",
    autoComplete: "new-password",
  },
];

export function PasswordForm({
  panel = false,
}: {
  /** Card layout used by the Admin account settings; behaviour is unchanged. */
  panel?: boolean;
} = {}) {
  const router = useRouter();
  const ready = useHydrated();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState<{
    message: string;
    failed: boolean;
    reauth?: boolean;
  }>();
  const message = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (notice) message.current?.focus();
  }, [notice]);
  const invalidFields = fields.filter((field) => errors[field.name]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
      confirmPassword: data.get("confirmPassword"),
    };
    setNotice(undefined);
    const parsed = passwordChangeInput.safeParse(input);
    if (!parsed.success) {
      const nextErrors: Partial<Record<Field, string>> = {};
      if (
        typeof input.currentPassword !== "string" ||
        !input.currentPassword.length ||
        input.currentPassword.length > 128
      )
        nextErrors.currentPassword =
          "Enter your current password, up to 128 characters.";
      if (
        typeof input.newPassword !== "string" ||
        input.newPassword.length < 12 ||
        input.newPassword.length > 128
      )
        nextErrors.newPassword =
          "Enter a new password of 12 to 128 characters.";
      if (
        typeof input.confirmPassword !== "string" ||
        input.confirmPassword !== input.newPassword
      )
        nextErrors.confirmPassword =
          "Enter the same new password in both fields.";
      setErrors(nextErrors);
      requestAnimationFrame(() => {
        const first = fields.find((field) => nextErrors[field.name]);
        if (first)
          form
            .querySelector<HTMLInputElement>(`[name="${first.name}"]`)
            ?.focus();
      });
      return;
    }
    setErrors({});
    submitting.current = true;
    setPending(true);
    // Keep credentials out of persistent form/status state and safe UI captures.
    form.reset();
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      const code =
        body && typeof body === "object" && "code" in body ? body.code : null;
      if (response.ok) {
        setNotice({
          message: "Password changed. Other sessions ended.",
          failed: false,
        });
        router.refresh();
      } else if (response.status === 401 || code === "SESSION_NOT_FRESH") {
        setNotice({
          message: "Sign out, then sign in again to change your password.",
          failed: true,
          reauth: true,
        });
      } else {
        const message =
          response.status === 400
            ? "Password change refused. Check your current password and try again."
            : response.status === 429
              ? "Too many password attempts. Wait a minute, then try again."
              : response.status === 409
                ? "Another password change is in progress. Check your sign-in status before trying again."
                : response.status === 403
                  ? "Password changes are unavailable on this account. Check your sign-in status or contact support."
                  : "We couldn't confirm the password change. Try signing in, or reset your password to recover access.";
        setNotice({ message, failed: true });
      }
    } catch {
      setNotice({
        message:
          "We couldn't confirm the password change. Try signing in, or reset your password to recover access.",
        failed: true,
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const heading = (
    <h2
      id="password-heading"
      className={panel ? undefined : "text-section-title"}
    >
      Change password
    </h2>
  );
  const help = (
    <p
      id="password-help"
      className={panel ? undefined : "mt-4 text-body text-muted-foreground"}
    >
      Use 12 to 128 characters. Changing your password ends your other signed-in
      sessions.
    </p>
  );
  const changeButton = (
    <button className="action action-outline w-full sm:w-auto" type="submit">
      {pending ? "Changing password…" : "Change password"}
    </button>
  );
  return (
    <section
      aria-labelledby="password-heading"
      className={
        panel
          ? "account-panel"
          : "mt-8 max-w-prose rounded-surface border border-border bg-surface p-6 sm:p-8"
      }
    >
      {panel ? (
        <div className="account-panel-head">
          <span className="account-panel-icon" aria-hidden="true">
            <LockKeyhole size={20} />
          </span>
          <div className="min-w-0">
            {heading}
            {help}
          </div>
        </div>
      ) : (
        <>
          {heading}
          {help}
        </>
      )}
      {!ready && (
        <p className={panel ? "account-panel-note" : "mt-4 text-body"}>
          Enable JavaScript to change your password here.
        </p>
      )}
      <form
        className={panel ? "account-panel-form" : "mt-6 space-y-6"}
        method="post"
        action="/api/account/password"
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-describedby="password-help"
      >
        {invalidFields.length >= 3 && (
          <div
            role="alert"
            tabIndex={-1}
            aria-labelledby="password-errors-heading"
            className="space-y-2 text-body text-error"
          >
            <p id="password-errors-heading" className="text-label">
              Check these password fields
            </p>
            <ul className="list-disc ps-6">
              {invalidFields.map((field) => (
                <li key={field.name}>
                  <a
                    className="inline-flex min-h-11 items-center"
                    href={`#password-${field.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document
                        .getElementById(`password-${field.name}`)
                        ?.focus();
                    }}
                  >
                    {field.label}: {errors[field.name]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset
          className={panel ? "account-panel-fields" : "space-y-6"}
          disabled={pending || !ready}
        >
          <legend className="sr-only">Password fields</legend>
          {fields.map((field) => (
            <div
              className={
                panel
                  ? field.name === "currentPassword"
                    ? "account-panel-field account-panel-wide"
                    : "account-panel-field"
                  : "space-y-2"
              }
              key={field.name}
            >
              <label
                className="block text-label"
                htmlFor={`password-${field.name}`}
              >
                {field.label}
              </label>
              <input
                className="field"
                type="password"
                id={`password-${field.name}`}
                name={field.name}
                autoComplete={field.autoComplete}
                required
                maxLength={128}
                minLength={field.name === "currentPassword" ? 1 : 12}
                aria-invalid={!!errors[field.name]}
                aria-describedby={
                  errors[field.name]
                    ? `password-${field.name}-error`
                    : undefined
                }
              />
              {errors[field.name] && (
                <p
                  id={`password-${field.name}-error`}
                  className="text-body text-error"
                >
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}
          {panel ? (
            <div className="account-panel-foot">{changeButton}</div>
          ) : (
            changeButton
          )}
        </fieldset>
        {pending && (
          <p role="status" className="text-body">
            Changing your password.
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
        {notice?.failed && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              className="inline-flex min-h-11 items-center"
              href="/sign-in?next=%2Faccount"
            >
              Sign in again
            </Link>
            <Link
              className="inline-flex min-h-11 items-center"
              href="/forgot-password"
            >
              Reset password
            </Link>
            <Link className="inline-flex min-h-11 items-center" href="/support">
              Contact support
            </Link>
          </div>
        )}
      </form>
    </section>
  );
}
