import { Hourglass, Check, Ban, Info } from "lucide-react";
import { stateLabels } from "./input";
import type { ReviewContent } from "./query";
export function PrivateReviewNotice() {
  return (
    <p className="mt-4 flex max-w-xl items-start gap-2 text-body">
      <Info className="size-5 shrink-0" aria-hidden="true" />
      Local synthetic demonstration only. Every review stays private, including
      locally approved reviews. Fixture completion does not prove attendance.
      Real review rules remain undecided.
    </p>
  );
}
export function ReviewView({ review }: { review: ReviewContent }) {
  const Icon =
    review.state === "pending"
      ? Hourglass
      : review.state === "locally_approved"
        ? Check
        : Ban;
  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-section-title">Saved private review</h2>
      <p className="mt-4 flex items-center gap-2 text-body">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {stateLabels[review.state]}
      </p>
      <p className="mt-4 text-body">Rating: {review.rating} out of 5</p>
      <p className="mt-4 text-body wrap-anywhere whitespace-pre-wrap">
        {review.comment || "No comment was added."}
      </p>
      <h3 className="mt-8 text-item-title">Local state history</h3>
      <ol className="mt-4 space-y-4">
        {review.history.map((e) => (
          <li className="text-body" key={e.revision}>
            Revision {e.revision}: {stateLabels[e.nextState]}
          </li>
        ))}
      </ol>
    </section>
  );
}
