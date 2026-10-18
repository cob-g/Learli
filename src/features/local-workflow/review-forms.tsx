"use client";

import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  localReviewClaimInput,
  localReviewHref,
  type LocalReviewKind,
} from "./review-input";

export function ClaimLocalReview({
  kind,
  targetId,
}: {
  kind: LocalReviewKind;
  targetId: string;
}) {
  const ready = useHydrated();
  const submitting = useRef(false);
  const request = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const notice = useRef<HTMLParagraphElement>(null);
  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    request.current ??= crypto.randomUUID();
    setPending(true);
    setMessage("");
    try {
      const input = localReviewClaimInput.parse({
        kind,
        targetId,
        requestId: request.current,
      });
      const response = await fetch("/api/admin/requests/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setMessage(
          typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof result.message === "string" &&
            result.message.length <= 500
            ? result.message
            : "This request could not be claimed. Refresh the queue and try again.",
        );
        return;
      }
      window.location.assign(localReviewHref(kind, targetId));
    } catch {
      setMessage(
        "We couldn't confirm the assignment. Refresh the queue or retry; the same request won't create a second assignment.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }
  return (
    <form
      method="post"
      action="/api/admin/requests/claim"
      onSubmit={claim}
      className="mt-3"
    >
      <button
        type="submit"
        className="action action-outline"
        disabled={!ready || pending}
        aria-busy={pending}
      >
        {pending ? "Claiming review…" : "Claim review"}
      </button>
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role="alert"
          className="mt-3 max-w-prose text-small"
        >
          {message}
        </p>
      )}
      <noscript>
        <p className="mt-3 text-small">
          Enable JavaScript to claim this review. No assignment has been
          changed.
        </p>
      </noscript>
    </form>
  );
}

export function ClaimLocalAccount() {
  const [targetId, setTargetId] = useState("");
  return (
    <div className="mt-4">
      <label htmlFor="account-support-id" className="text-label">
        Account ID
      </label>
      <input
        id="account-support-id"
        className="field mt-2"
        value={targetId}
        onChange={(event) => setTargetId(event.target.value)}
        maxLength={128}
        autoComplete="off"
      />
      {targetId && (
        <ClaimLocalReview key={targetId} kind="account" targetId={targetId} />
      )}
    </div>
  );
}
