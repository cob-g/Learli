"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { authClient } from "@/lib/auth-client";
import { syntheticEmail } from "@/lib/local-mode";
import { mailboxSchema } from "@/lib/email/mailbox";
import {
  signUpFailure,
  signUpUncertainMessage,
  type SignUpErrors,
} from "./sign-up-feedback";
import { safeBookingReturnPath } from "@/features/bookings/selection";
import {
  isParentOnboardingPath,
  parentContinuation,
  parentOnboardingHref,
} from "@/features/parent-onboarding/continuation";
import {
  isStudentOnboardingPath,
  studentContinuation,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset" | "verify";
const labels: Record<Mode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  forgot: "Request reset link",
  reset: "Save new password",
  verify: "Resend verification",
};
export function AuthForm({
  mode,
  next,
  token,
  invalidToken = false,
  hosted = false,
  localWorkflow = false,
  presentation = "standard",
}: {
  mode: Mode;
  next?: string;
  token?: string;
  invalidToken?: boolean;
  hosted?: boolean;
  localWorkflow?: boolean;
  presentation?: "standard" | "reference" | "sign-up-reference";
}) {
  const signInReference = mode === "sign-in" && presentation === "reference";
  const signUpReference =
    mode === "sign-up" && presentation === "sign-up-reference";
  const reference = signInReference || signUpReference;
  const prefix = signUpReference ? "sign-up" : "sign-in";
  const ready = useHydrated();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signUpReceived, setSignUpReceived] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<SignUpErrors>({});
  const signUpInFlight = useRef(false);
  const [signUpDetails, setSignUpDetails] = useState({ name: "", email: "" });
  const emailField = useRef<HTMLInputElement>(null);
  const [accountType, setAccountType] = useState(
    isParentOnboardingPath(next)
      ? "parent"
      : isStudentOnboardingPath(next)
        ? "student"
        : "later",
  );
  const status = useRef<HTMLParagraphElement>(null);
  const studentIntent = isStudentOnboardingPath(next);
  const unwrappedStudent = studentIntent ? studentContinuation(next) : next;
  const returnTo =
    mode === "sign-up" && accountType === "parent"
      ? parentOnboardingHref(unwrappedStudent)
      : mode === "sign-up" && accountType === "student"
        ? studentOnboardingHref(
            isParentOnboardingPath(next) ? parentContinuation(next) : next,
          )
        : mode === "sign-up" && studentIntent
          ? safeBookingReturnPath(unwrappedStudent)
          : studentIntent
            ? studentOnboardingHref(next)
            : safeBookingReturnPath(next);
  const notice = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
    requestAnimationFrame(() => status.current?.focus());
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      mode === "sign-up" &&
      (!ready || signUpInFlight.current || signUpReceived)
    )
      return;
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const displayName = String(data.get("name") ?? "");
    if (mode === "sign-up") {
      const errors: SignUpErrors = {};
      if (!displayName.trim()) errors.name = "Enter your display name.";
      else if (displayName.length > 100)
        errors.name = "Use 100 characters or fewer for your display name.";
      if (!email || emailField.current?.validity.typeMismatch)
        errors.email = "Enter a valid email address.";
      else if (email.length > 254)
        errors.email = "Use an email address with 254 characters or fewer.";
      else if (localWorkflow && !mailboxSchema.safeParse(email).success)
        errors.email = "Enter a valid email address.";
      else if (!localWorkflow && !syntheticEmail(email))
        errors.email =
          "This preview only accepts addresses ending in .test. Use a test email address.";
      if (password.length < 12 || password.length > 128)
        errors.password = "Use 12–128 characters.";
      setSignUpErrors(errors);
      if (Object.keys(errors).length) {
        notice("Check the highlighted fields and try again.", true);
        return;
      }
      signUpInFlight.current = true;
      setSignUpDetails({ name: displayName, email });
      setFailed(false);
    }
    setPending(true);
    setMessage("");
    const credential =
      form.querySelector<HTMLInputElement>('[name="password"]');
    if (credential) {
      credential.value = "";
      if (reference) credential.type = "password";
    }
    setShowPassword(false);
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
        if (result.error) {
          const feedback = signUpFailure(result.error);
          setSignUpErrors(feedback.fields);
          notice(feedback.message, true);
        } else {
          setSignUpReceived(true);
          notice("Registration request received.");
        }
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
              : localWorkflow
                ? "If an account matches this address, its reset message was captured locally. Run npm run mail:open in your Learli terminal to open it. No email was sent."
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
              : localWorkflow
                ? "If verification is needed, its message was captured locally. Run npm run mail:open in your Learli terminal to open it. No email was sent."
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
      notice(
        mode === "sign-up"
          ? signUpUncertainMessage
          : "The account service could not be reached. Try again.",
        true,
      );
    } finally {
      if (mode === "sign-up") signUpInFlight.current = false;
      setPending(false);
    }
  }
  const passwordInput = (
    <input
      className={reference ? `${prefix}-input` : "field"}
      id="password"
      name="password"
      type={reference && showPassword ? "text" : "password"}
      autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
      minLength={12}
      maxLength={128}
      required
      aria-describedby={
        mode === "sign-up" && signUpErrors.password
          ? "password-help password-error"
          : "password-help"
      }
      aria-invalid={
        mode === "sign-up" && signUpErrors.password ? true : undefined
      }
      placeholder={reference ? "12 characters or more" : undefined}
    />
  );
  if (mode === "reset" && (!token || invalidToken))
    return (
      <p role="alert" className="mt-8 text-body">
        This reset link is missing or expired.{" "}
        <Link href="/forgot-password">Request a new reset link</Link>.
      </p>
    );
  if (mode === "sign-up" && signUpReceived)
    return (
      <section
        className={signUpReference ? "sign-up-received" : "mt-8 space-y-6"}
        aria-labelledby="sign-up-verification-title"
      >
        <h2 id="sign-up-verification-title" className="text-section-title">
          Verify your email
        </h2>
        <p
          ref={status}
          role="status"
          tabIndex={-1}
          className="text-body font-medium text-deep-teal"
        >
          Registration request received.
        </p>
        <p className="text-body">
          {hosted
            ? "For a new account, use the verification link for the address you entered, then sign in."
            : localWorkflow
              ? "For a new account, open the captured verification message, follow its link, then sign in."
              : "For a new account, open the verification link in the local test mailbox, then sign in."}
        </p>
        <p className="text-small text-muted-foreground">
          {hosted
            ? "This screen does not confirm email delivery."
            : localWorkflow
              ? "Run npm run mail:open in your Learli terminal to open the latest captured message. No email was sent."
              : "Local test messages are captured rather than sent to an inbox."}
        </p>
        <Link
          className={
            signUpReference ? "sign-up-submit" : "action action-primary w-full"
          }
          href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        >
          Sign in
          {signUpReference && (
            <span className="sign-up-submit-arrow" aria-hidden="true">
              <ChevronRight size={16} />
            </span>
          )}
        </Link>
        <p className="text-small">
          Already have an account? Sign in or{" "}
          <Link href="/forgot-password">reset your password</Link>.
        </p>
        <nav
          aria-label="Verification help"
          className="flex flex-col items-start gap-2 text-small"
        >
          <Link
            className="inline-flex min-h-11 items-center"
            href={`/verify-email?next=${encodeURIComponent(returnTo)}`}
          >
            Request another verification link
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-deep-teal underline"
            onClick={() => {
              setSignUpDetails((details) => ({ ...details, email: "" }));
              setSignUpReceived(false);
              setSignUpErrors({});
              setMessage("");
              setFailed(false);
              setShowPassword(false);
              requestAnimationFrame(() => emailField.current?.focus());
            }}
          >
            Use a different email
          </button>
        </nav>
      </section>
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
        noValidate={mode === "sign-up"}
        onSubmit={submit}
        className={
          reference ? `${prefix}-form` : "space-y-6 [p+&]:mt-6 [section+&]:mt-6"
        }
        aria-busy={pending}
      >
        <fieldset
          disabled={!ready || pending}
          className={reference ? `${prefix}-fields` : "space-y-6"}
        >
          <legend className="sr-only">Account access</legend>
          {signUpReference && (
            <fieldset className="sign-up-choices">
              <legend>Account type</legend>
              {[
                ["parent", "Parent or guardian", "For my child"],
                ["student", "College Student", "For myself"],
                ["later", "Choose later", ""],
              ].map(([value, label, description]) => (
                <label
                  className="sign-up-option"
                  key={value}
                  data-later={value === "later" ? "" : undefined}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={value}
                    checked={accountType === value}
                    onChange={() => setAccountType(value)}
                    aria-labelledby={`account-${value}-label`}
                    aria-describedby={
                      description ? `account-${value}-help` : undefined
                    }
                  />
                  <span>
                    <span id={`account-${value}-label`}>{label}</span>
                    {description && (
                      <small id={`account-${value}-help`}>{description}</small>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {mode === "sign-up" && !signUpReference && (
            <div className="space-y-2">
              <label className="block text-label" htmlFor="accountType">
                Account type
              </label>
              <select
                className="field"
                id="accountType"
                name="accountType"
                value={accountType}
                onChange={(event) =>
                  setAccountType(
                    event.target.value === "parent"
                      ? "parent"
                      : event.target.value === "student"
                        ? "student"
                        : "later",
                  )
                }
              >
                <option value="later">Choose later</option>
                <option value="parent">Parent or guardian</option>
                <option value="student">College Student</option>
              </select>
            </div>
          )}
          {mode === "sign-up" && (
            <div className={signUpReference ? "sign-up-field" : "space-y-2"}>
              <label className="block text-label" htmlFor="name">
                Display name
              </label>
              <input
                className={signUpReference ? "sign-up-input" : "field"}
                id="name"
                name="name"
                autoComplete="nickname"
                maxLength={100}
                required
                defaultValue={signUpDetails.name}
                aria-invalid={signUpErrors.name ? true : undefined}
                aria-describedby={signUpErrors.name ? "name-error" : undefined}
                placeholder={signUpReference ? "Your display name" : undefined}
              />
              {signUpErrors.name && (
                <p id="name-error" className="text-small text-error">
                  {signUpErrors.name}
                </p>
              )}
            </div>
          )}
          {mode !== "reset" && (
            <div className={reference ? `${prefix}-field` : "space-y-2"}>
              <label className="block text-label" htmlFor="email">
                Email
              </label>
              <input
                className={reference ? `${prefix}-input` : "field"}
                id="email"
                name="email"
                type="email"
                ref={mode === "sign-up" ? emailField : undefined}
                defaultValue={
                  mode === "sign-up" ? signUpDetails.email : undefined
                }
                autoComplete="email"
                required
                maxLength={254}
                aria-describedby={
                  mode === "sign-up" && signUpErrors.email
                    ? "email-help email-error"
                    : "email-help"
                }
                aria-invalid={
                  mode === "sign-up" && signUpErrors.email ? true : undefined
                }
                placeholder={
                  reference
                    ? localWorkflow
                      ? "you@example.com"
                      : "you@example.test"
                    : undefined
                }
              />
              <p
                id="email-help"
                className="text-small wrap-anywhere text-muted-foreground"
              >
                {localWorkflow
                  ? "Use a valid email address. Account messages are captured locally."
                  : hosted
                    ? "Use an allowed address ending in .test."
                    : "Use an address ending in .test in this environment."}
              </p>
              {mode === "sign-up" && signUpErrors.email && (
                <p id="email-error" className="text-small text-error">
                  {signUpErrors.email}
                </p>
              )}
            </div>
          )}
          {["sign-in", "sign-up", "reset"].includes(mode) && (
            <div className={reference ? `${prefix}-field` : "space-y-2"}>
              <label className="block text-label" htmlFor="password">
                {mode === "reset" ? "New password" : "Password"}
              </label>
              {reference ? (
                <div className={`${prefix}-password-control`}>
                  {passwordInput}
                  {reference && (
                    <button
                      type="button"
                      className={`${prefix}-toggle`}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      aria-controls="password"
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
              ) : (
                passwordInput
              )}
              {signInReference && (
                <Link className="sign-in-forgot" href="/forgot-password">
                  Forgot password?
                </Link>
              )}
              <p
                id="password-help"
                className="text-small text-muted-foreground"
              >
                Use 12–128 characters.
              </p>
              {mode === "sign-up" && signUpErrors.password && (
                <p id="password-error" className="text-small text-error">
                  {signUpErrors.password}
                </p>
              )}
            </div>
          )}
          {message && (
            <p
              ref={status}
              tabIndex={-1}
              role={failed ? "alert" : "status"}
              className={
                failed
                  ? "rounded-control border border-error p-4 text-body text-error"
                  : "rounded-control border border-border bg-subtle p-4 text-body"
              }
            >
              {message}
            </p>
          )}
          <button
            className={
              reference
                ? `${prefix}-submit`
                : "action action-primary w-full transition-none"
            }
            type="submit"
            disabled={pending}
          >
            {pending
              ? mode === "sign-up"
                ? "Creating account…"
                : "Please wait…"
              : labels[mode]}
            {reference && (
              <span className={`${prefix}-submit-arrow`} aria-hidden="true">
                <ChevronRight size={16} />
              </span>
            )}
          </button>
        </fieldset>
      </form>
      {mode === "sign-up" && pending && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-control bg-surface p-4 text-small"
        >
          Creating account… Your registration request is in progress.
        </p>
      )}
      <nav
        aria-label="Account help"
        className={
          reference
            ? `${prefix}-help`
            : "mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-small"
        }
      >
        {signUpReference && <span>Already have an account?</span>}
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
              Create account
            </Link>
            {!reference && (
              <Link
                className="inline-flex min-h-11 items-center"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            )}
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
        {mode === "sign-up" && failed && (
          <>
            <Link
              className="inline-flex min-h-11 items-center"
              href={`/verify-email?next=${encodeURIComponent(returnTo)}`}
            >
              Request another verification link
            </Link>
            <Link
              className="inline-flex min-h-11 items-center"
              href="/forgot-password"
            >
              Reset your password
            </Link>
          </>
        )}
      </nav>
    </>
  );
}
