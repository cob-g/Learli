"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { nextStates, stateLabels, type ReviewState } from "./input";
export function ReviewForm({
  bookingId,
  reviewId,
  revision,
  state,
}: {
  bookingId?: string;
  reviewId?: string;
  revision: number;
  state?: ReviewState;
}) {
  const hydrated = useHydrated();
  const busy = useRef(false),
    request = useRef<string | undefined>(undefined),
    notice = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !hydrated) return;
    const form = event.currentTarget,
      data = new FormData(form);
    if (!form.reportValidity()) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    request.current ??= crypto.randomUUID();
    try {
      const response = await fetch(
        reviewId
          ? `/api/admin/reviews/${reviewId}`
          : `/api/bookings/${bookingId}/review`,
        {
          method: reviewId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: request.current,
            expectedRevision: revision,
            ...(reviewId
              ? { state: data.get("state") }
              : {
                  rating: Number(data.get("rating")),
                  comment: String(data.get("comment") ?? ""),
                }),
          }),
        },
      );
      const result = await response.json();
      if (response.ok) {
        window.location.replace(window.location.href);
        return;
      }
      setFailed(true);
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "The private review could not be saved.",
      );
    } catch {
      setFailed(true);
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
      onSubmit={save}
      className="mt-4 max-w-xl space-y-4"
      aria-busy={pending}
    >
      {!hydrated && (
        <p className="text-body">
          Enable JavaScript to save a private local review. These controls
          remain unavailable until then.
        </p>
      )}
      <fieldset disabled={!hydrated} className="space-y-4">
        <legend className="text-item-title">
          {reviewId
            ? "Change private local moderation"
            : "Submit one private synthetic review"}
        </legend>
        {reviewId && state ? (
          <div className="space-y-2">
            <label htmlFor="review-state" className="block text-label">
              Next local state
            </label>
            <select id="review-state" name="state" className="field">
              {nextStates(state).map((s) => (
                <option key={s} value={s}>
                  {stateLabels[s]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="review-rating" className="block text-label">
                Rating from 1 to 5
              </label>
              <select
                id="review-rating"
                name="rating"
                className="field"
                required
                defaultValue=""
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
              <label htmlFor="review-comment" className="block text-label">
                Comment <span className="text-caption">(optional)</span>
              </label>
              <textarea
                id="review-comment"
                name="comment"
                className="field min-h-32"
                maxLength={1000}
                aria-describedby="review-comment-help"
              />
              <p
                id="review-comment-help"
                className="text-small text-muted-foreground"
              >
                Up to 1,000 characters. Use synthetic text only. The submission
                cannot be edited.
              </p>
            </div>
          </>
        )}
        <button
          type="submit"
          className="action action-primary transition-none"
          aria-disabled={pending}
        >
          {pending && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending
            ? "Saving private review…"
            : reviewId
              ? "Save private local state"
              : "Save private synthetic review"}
        </button>
      </fieldset>
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          className={`flex items-start gap-2 text-body ${failed ? "text-error" : "text-success"}`}
        >
          {failed ? (
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          )}
          {message}
        </p>
      )}
      <a
        href={
          reviewId
            ? `/admin/reviews/${reviewId}`
            : `/bookings/${bookingId}/review`
        }
        className="text-body text-primary underline"
      >
        Reload private review
      </a>
    </form>
  );
}
