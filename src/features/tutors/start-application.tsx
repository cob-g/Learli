"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function StartApplication() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const alert = useRef<HTMLParagraphElement>(null);

  async function start() {
    if (pending) return;
    setPending(true);
    setError("");
    let failure = "";
    try {
      const response = await fetch("/api/tutor/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (response.ok) return router.push("/tutor/profile");
      // Signed out: come back here after signing in or creating an account.
      if (response.status === 401)
        return router.push("/sign-in?next=%2Fbecome-a-tutor");
      failure =
        response.status === 503
          ? "Tutor applications are not open right now."
          : "This account can't start a tutor application. Contact support.";
    } catch {
      failure =
        "We couldn't reach Learli. Check your connection, then try again.";
    }
    setError(failure);
    setPending(false);
    requestAnimationFrame(() => alert.current?.focus());
  }

  return (
    <div className="mt-8">
      {error && (
        <p
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="mb-4 max-w-prose text-body text-error"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        className="action action-primary"
        aria-disabled={pending}
        onClick={start}
      >
        {pending ? "Starting application…" : "Start tutor application"}
      </button>
    </div>
  );
}
