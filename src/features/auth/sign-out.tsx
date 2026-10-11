"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) setError(true);
      else {
        router.replace("/sign-in");
        router.refresh();
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-8">
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
