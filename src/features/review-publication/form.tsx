"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { LoaderCircle, CircleAlert } from "lucide-react";
import {
  publicationSubmission,
  publicationDecision,
  nextPublicationStates,
  publicationStateLabels,
  type PublicationState,
} from "./input";
export function PublicationForm({
  bookingId,
  completionEventId,
  bookingRevision,
  reviewId,
  revision = 0,
  state,
}: {
  bookingId?: string;
  completionEventId?: string;
  bookingRevision?: number;
  reviewId?: string;
  revision?: number;
  state?: PublicationState;
}) {
  const hydrated = useHydrated(),
    busy = useRef(false),
    request = useRef<string | undefined>(undefined),
    notice = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [target, setTarget] = useState(
      state ? nextPublicationStates(state)[0] : undefined,
    );
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  const path = reviewId
    ? `/api/admin/publication-reviews/${reviewId}`
    : `/api/bookings/${bookingId}/publication-review`;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    request.current ??= crypto.randomUUID();
    const input = reviewId
      ? {
          requestId: request.current,
          expectedRevision: revision,
          state: values.get("state"),
          privacyChecked: values.get("privacyChecked") === "on",
        }
      : {
          requestId: request.current,
          bookingRevision,
          completionEventId,
          rating: Number(values.get("rating")),
          comment: String(values.get("comment") ?? ""),
        };
    const parsed = reviewId
      ? publicationDecision.safeParse(input)
      : publicationSubmission.safeParse(input);
    if (!parsed.success) {
      setMessage(
        "Choose a rating and use up to 1,000 characters of plain text.",
      );
      return;
    }
    if (
      reviewId &&
      (target === "approved" || target === "published") &&
      values.get("privacyChecked") !== "on"
    ) {
      setMessage("Confirm the privacy review before approval or publication.");
      form.querySelector<HTMLInputElement>("[name=privacyChecked]")?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: reviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (response.ok) {
        window.location.replace(window.location.href);
        return;
      }
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "The review could not be saved. Reload to check the current state.",
      );
    } catch {
      setMessage(
        "The result is uncertain. Retry the same fields, or reload to check whether it was saved.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form
      method="post"
      action={path}
      onSubmit={save}
      aria-busy={pending}
      className="mt-8 max-w-xl space-y-4"
    >
      {!hydrated && (
        <p className="text-body">
          Enable JavaScript to save a synthetic review or moderation decision.
          These controls remain unavailable until then.
        </p>
      )}
      <fieldset disabled={!hydrated || pending} className="space-y-4">
        <legend className="text-item-title">
          {reviewId
            ? "Record moderation decision"
            : "Submit one immutable synthetic review"}
        </legend>
        {reviewId && state ? (
          <>
            <div className="space-y-2">
              <label htmlFor="publication-state" className="block text-label">
                Next review state
              </label>
              <select
                id="publication-state"
                name="state"
                className="field"
                value={target}
                onChange={(e) => setTarget(e.target.value as PublicationState)}
              >
                {nextPublicationStates(state).map((s) => (
                  <option key={s} value={s}>
                    {publicationStateLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            {(target === "approved" || target === "published") && (
              <label className="flex min-h-11 items-start gap-2 text-body">
                <input
                  name="privacyChecked"
                  type="checkbox"
                  className="mt-1 size-5"
                />
                <span>
                  I reviewed the text for private names, contact details,
                  learner information and meeting links, and approve the
                  anonymous public fields.
                </span>
              </label>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="publication-rating" className="block text-label">
                Rating from 1 to 5
              </label>
              <select
                id="publication-rating"
                name="rating"
                defaultValue=""
                className="field"
                required
              >
                <option value="">Choose a rating</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} out of 5
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="publication-comment" className="block text-label">
                Comment <span className="text-caption">(optional)</span>
              </label>
              <textarea
                id="publication-comment"
                name="comment"
                maxLength={1000}
                className="field min-h-32"
                aria-describedby="publication-help"
              />
              <p
                id="publication-help"
                className="max-w-prose text-small text-muted-foreground"
              >
                Up to 1,000 characters of synthetic plain text. Leave out names,
                contact details, learner information and meeting links; your
                submission cannot be edited.
              </p>
            </div>
          </>
        )}
        <button type="submit" className="action action-primary transition-none">
          {pending && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending
            ? "Saving review…"
            : reviewId
              ? "Save moderation decision"
              : "Save synthetic review"}
        </button>
      </fieldset>
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2 text-body text-error"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      <a
        className="inline-flex min-h-11 items-center text-body text-primary underline"
        href={
          reviewId
            ? `/admin/publication-reviews/${reviewId}`
            : `/bookings/${bookingId}/publication-review`
        }
      >
        Reload review
      </a>
    </form>
  );
}
