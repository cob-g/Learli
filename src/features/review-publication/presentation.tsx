import { publicationStateLabels } from "./input";
import type { PublicationReview, PublicReviewProjection } from "./query";
export function PublicationNotice() {
  return (
    <p className="mt-4 max-w-prose text-body">
      Synthetic readiness only. Completion is an administrative booking outcome;
      no attendance or real publication policy has been verified.
    </p>
  );
}
/** Public selections only; W6 authorizes the learner and reads current policy times. */
export function PublicationBookingHandoff({
  slug,
  subjectSlug,
}: {
  slug: string;
  subjectSlug?: string;
}) {
  const query = new URLSearchParams({ tutorSlug: slug });
  if (subjectSlug) query.set("subjectSlug", subjectSlug);
  return (
    <section className="mt-8" aria-labelledby="readiness-booking-title">
      <h2 id="readiness-booking-title" className="text-section-title">
        Synthetic booking options
      </h2>
      <p className="mt-2 max-w-prose text-body">
        Fictional readiness only. Sign in and choose your own admitted learner
        to see current synthetic booking times. Real booking policies remain
        unavailable.
      </p>
      <a
        className="action action-outline mt-4"
        href={`/bookings/demo?${query}`}
      >
        Review synthetic booking options
      </a>
    </section>
  );
}
export function PublicationReviewView({
  review,
}: {
  review: PublicationReview;
}) {
  return (
    <section className="mt-8" aria-labelledby="saved-review-title">
      <h2 id="saved-review-title" className="text-section-title">
        Saved review
      </h2>
      <p className="mt-4 text-body">Rating: {review.rating} out of 5</p>
      <p className="mt-2 text-body">{publicationStateLabels[review.state]}</p>
      {review.comment && (
        <p className="mt-4 max-w-prose text-prose wrap-anywhere whitespace-pre-line">
          {review.comment}
        </p>
      )}
      <h3 className="mt-8 text-item-title">Saved moderation history</h3>
      <ol className="mt-2 space-y-2">
        {review.history.map((e) => (
          <li key={e.revision} className="text-body">
            {publicationStateLabels[e.nextState]}
            {e.privacyChecked ? " · Privacy review recorded" : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}
export function PublicReviewSection({
  result,
}: {
  result: PublicReviewProjection | null | undefined;
}) {
  if (result === null) return null;
  return (
    <section aria-labelledby="published-reviews-title" className="mt-12">
      <h2 id="published-reviews-title" className="text-section-title">
        Synthetic published reviews
      </h2>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">
        Local synthetic readiness test. These reviews do not establish real
        lessons, attendance or an approved public review policy.
      </p>
      {result === undefined ? (
        <p role="alert" className="mt-4 text-body">
          We couldn&apos;t load reviews. Reload this profile to try again.
        </p>
      ) : result.count === 0 ? (
        <p className="mt-4 text-body">No reviews yet</p>
      ) : (
        <>
          <p className="mt-4 text-body">
            {result.count} {result.count === 1 ? "review" : "reviews"} · Average{" "}
            {result.average} out of 5
          </p>
          <ul className="mt-4 divide-y divide-border">
            {result.reviews.map((review, index) => (
              <li key={index} className="py-4">
                <h3 className="text-item-title">{review.authorLabel}</h3>
                <p className="mt-2 text-body">{review.rating} out of 5</p>
                {review.comment && (
                  <p className="mt-2 max-w-prose text-prose wrap-anywhere whitespace-pre-line">
                    {review.comment}
                  </p>
                )}
                <time
                  dateTime={review.date}
                  className="mt-2 block text-small text-muted-foreground"
                >
                  {new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${review.date}T00:00:00Z`))}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
