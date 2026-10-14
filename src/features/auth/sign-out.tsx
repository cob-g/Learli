"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export function SignOut({ className = "mt-8" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
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
      <button
        className="action action-outline"
        type="button"
        disabled={pending}
        onClick={signOut}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className="mt-2 text-body text-error" role="alert">
          Sign-out could not be completed. Try again.
        </p>
      )}
    </div>
  );
}
