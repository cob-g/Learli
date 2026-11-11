"use client";
import { useId, useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
export function SignOut({
  className = "mt-8",
  variant = "button",
}: {
  className?: string;
  /** "tile" renders the account menu's action tile; behaviour is identical. */
  variant?: "button" | "tile";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const hint = useId();
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) setError(true);
      else {
        // A fresh document clears private bootstrap data and router caches
        // before another account can sign in on this browser.
        window.location.replace("/sign-in");
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={className}>
      {variant === "tile" ? (
        <button
          className="account-pass-action account-pass-signout"
          type="button"
          disabled={pending}
          onClick={signOut}
          aria-describedby={hint}
        >
          <LogOut size={20} aria-hidden="true" />
          <span>
            <b>{pending ? "Signing out…" : "Sign out"}</b>
            <small id={hint} aria-hidden="true">
              On this device
            </small>
          </span>
        </button>
      ) : (
        <button
          className="action action-outline"
          type="button"
          disabled={pending}
          onClick={signOut}
        >
          {pending ? "Signing out…" : "Sign out"}
        </button>
      )}
      {error && (
        <p
          className={
            variant === "tile"
              ? "account-pass-error"
              : "mt-2 text-body text-error"
          }
          role="alert"
        >
          Sign-out could not be completed. Try again.
        </p>
      )}
    </div>
  );
}
