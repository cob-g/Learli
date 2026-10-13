"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeBookingReturnPath } from "@/features/bookings/selection";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset" | "verify";
const labels: Record<Mode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create test account",
  forgot: "Request reset link",
  reset: "Save new password",
  verify: "Resend verification",
};
const subscribe = () => () => {};
export function AuthForm({
  mode,
  next,
  token,
  invalidToken = false,
  hosted = false,
}: {
  mode: Mode;
  next?: string;
  token?: string;
  invalidToken?: boolean;
  hosted?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);
  const returnTo = safeBookingReturnPath(next);
  const notice = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
    requestAnimationFrame(() => status.current?.focus());
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const displayName = String(data.get("name") ?? "");
    const credential =
      form.querySelector<HTMLInputElement>('[name="password"]');
    if (credential) credential.value = "";
    const callbackURL = `/sign-in?verified=1&next=${encodeURIComponent(returnTo)}`;
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error)
          notice(
            "Sign-in could not be completed. Check your details and verify your email. If you have tried repeatedly, wait a minute before retrying.",
            true,
          );
        else {
          if (
            result.data &&
            "twoFactorRedirect" in result.data &&
            result.data.twoFactorRedirect === true
          ) {
            form.reset();
            window.location.replace(
              `/two-factor?next=${encodeURIComponent(returnTo)}`,
            );
            return;
          }
          // Clear prior private bootstrap data when reauthenticating as a
          // different account; returnTo retains the existing path validation.
          window.location.replace(returnTo);
        }
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: displayName,
          email,
          password,
          callbackURL,
        });
        if (result.error)
          notice(
            "Account creation could not be completed. Check your details or try again later.",
            true,
          );
        else
          notice(
            hosted
              ? "If this address can be registered, a verification request was accepted. Check the address before signing in; delivery has not been established."
              : "If this address can be registered, a verification message is available in your local mailbox. Verify it before signing in.",
          );
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        if (result.error)
          notice(
            "The reset request could not be completed. Try again later.",
            true,
          );
        else
          notice(
            hosted
              ? "If an account matches this address, a reset request was accepted. Check the address for the link; delivery has not been established."
              : "If an account matches this address, a reset message is available in your local mailbox.",
          );
      } else if (mode === "verify") {
        const result = await authClient.sendVerificationEmail({
          email,
          callbackURL,
        });
        if (result.error)
          notice(
            "The verification request could not be completed. Try again later.",
            true,
          );
        else
          notice(
            hosted
              ? "If verification is needed, a message request was accepted. Check the address; delivery has not been established."
              : "If verification is needed, a message is available in your local mailbox.",
          );
      } else {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: token ?? "",
        });
        if (result.error)
          notice(
            "This reset link could not be used. Request a new link and try again.",
            true,
          );
        else {
          notice("Your password was changed. Sign in with your new password.");
          router.refresh();
        }
      }
    } catch {
      notice("The account service could not be reached. Try again.", true);
    } finally {
      setPending(false);
    }
  }
  if (mode === "reset" && (!token || invalidToken))
    return (
      <p role="alert" className="mt-8 text-body">
        This reset link is missing or expired.{" "}
        <Link href="/forgot-password">Request a new reset link</Link>.
      </p>
    );
  return (
    <>
      {!ready && (
        <p className="mt-4 text-body">
          Enable JavaScript to use account forms here. Account navigation
          remains available.
        </p>
      )}
      <form
        method="post"
        action="/api/auth/sign-in/email"
        onSubmit={submit}
        className="mt-8 space-y-6"
        aria-busy={pending}
      >
        <fieldset disabled={!ready || pending} className="space-y-6">
          <legend className="sr-only">Account access</legend>
          {mode === "sign-up" && (
            <div className="space-y-2">
              <label className="block text-label" htmlFor="name">
                Display name
              </label>
              <input
                className="field"
                id="name"
                name="name"
                autoComplete="nickname"
                maxLength={100}
                required
              />
            </div>
          )}
          {mode !== "reset" && (
            <div className="space-y-2">
              <label className="block text-label" htmlFor="email">
                Test email
              </label>
              <input
                className="field"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-describedby="email-help"
              />
              <p id="email-help" className="text-small text-muted-foreground">
                {hosted
                  ? "Use an explicitly configured synthetic .test account."
                  : "Use a synthetic address, such as learner@example.test."}
              </p>
            </div>
          )}
          {["sign-in", "sign-up", "reset"].includes(mode) && (
            <div className="space-y-2">
              <label className="block text-label" htmlFor="password">
                {mode === "reset" ? "New password" : "Password"}
              </label>
              <input
                className="field"
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                minLength={12}
                maxLength={128}
                required
                aria-describedby="password-help"
              />
              <p
                id="password-help"
                className="text-small text-muted-foreground"
              >
                Use 12–128 characters.
              </p>
            </div>
          )}
          {message && (
            <p
              ref={status}
              tabIndex={-1}
              role={failed ? "alert" : "status"}
              className={failed ? "text-body text-error" : "text-body"}
            >
              {message}
            </p>
          )}
          <button
            className="action action-primary transition-none"
            type="submit"
            disabled={pending}
          >
            {pending ? "Please wait…" : labels[mode]}
          </button>
        </fieldset>
      </form>
      <nav
        aria-label="Account help"
        className="mt-8 flex flex-wrap gap-x-6 gap-y-2"
      >
        {mode !== "sign-in" && (
          <Link
            className="inline-flex min-h-11 items-center"
            href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
          >
            Sign in
          </Link>
        )}
        {mode === "sign-in" && (
          <>
            <Link
              className="inline-flex min-h-11 items-center"
              href={`/sign-up?next=${encodeURIComponent(returnTo)}`}
            >
              Create test account
            </Link>
            <Link
              className="inline-flex min-h-11 items-center"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
            <Link
              className="inline-flex min-h-11 items-center"
              href={`/verify-email?next=${encodeURIComponent(returnTo)}`}
            >
              Verify email
            </Link>
          </>
        )}
        {mode === "reset" && (
          <Link
            className="inline-flex min-h-11 items-center"
            href="/forgot-password"
          >
            Request a new reset link
          </Link>
        )}
      </nav>
    </>
  );
}
