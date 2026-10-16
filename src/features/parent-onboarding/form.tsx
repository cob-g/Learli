"use client";

import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { parentContinuation } from "./continuation";

export function ParentOnboardingForm({ next }: { next?: string }) {
  const ready = useHydrated();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const alert = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/parent-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (response.ok && result?.ready === true) {
        // The replacement document loads the newly trusted role from the server.
        window.location.replace(parentContinuation(next));
        return;
      }
      setMessage(
        response.status === 401
          ? "Your session has ended. Sign in again to continue parent setup."
          : "Parent setup could not be completed. Check your account access and retry; a repeated request will not duplicate your workspace.",
      );
    } catch {
      setMessage(
        "We could not confirm parent setup. Check your connection and retry; a repeated request will not duplicate your workspace.",
      );
    } finally {
      busy.current = false;
      setPending(false);
      requestAnimationFrame(() => alert.current?.focus());
    }
  }

  return (
    <form
      method="post"
      action="/api/account/parent-onboarding"
      onSubmit={submit}
      aria-busy={pending}
      className="mt-8 space-y-6"
    >
      {!ready && (
        <p className="text-body">
          Enable JavaScript to complete parent setup. Your account remains
          available.
        </p>
      )}
      {message && (
        <p
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="text-body text-error"
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        className="action action-primary transition-none"
        disabled={!ready || pending}
      >
        {pending ? "Setting up parent workspace…" : "Continue as parent"}
      </button>
    </form>
  );
}
