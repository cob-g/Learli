"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

export type Review = {
  /** Who is speaking, by role. Learli publishes no reviewer names. */
  author: string;
  /** What the lessons were for. */
  context: string;
  quote: string;
  /** A square picture of a lesson moment. It must not show a face. */
  image: string;
};

/** Automatic reviews advance every six seconds of visible, unheld time. */
const REVIEW_INTERVAL_MS = 6000;
/** After a pointer or focus lets go, a review stays at least this much longer. */
const RESUME_MS = 2500;

const idle = () => () => {};
const stillQuery = "(prefers-reduced-motion: reduce)";
const onStillChange = (notify: () => void) => {
  const query = window.matchMedia(stillQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/**
 * Reviews as a circular stack: three pictures stand in a shallow 3D arc and
 * swing round as the review changes, while the quote arrives word by word
 * (home.css). The server markup is every review, readable in order; scripts
 * turn it into one-at-a-time and add the Next button.
 *
 * It moves on by itself once a review has been up long enough to read. The
 * clock only runs while the carousel is on screen in a visible tab, and a
 * review stays put while a pointer rests on it or keyboard focus is inside
 * it, so nobody loses one mid-sentence. Next moves on at once and the clock
 * starts again. Reduced motion turns the automatic change off.
 */
export function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const root = useRef<HTMLDivElement>(null);
  const hold = useRef({ hover: false, focus: false });
  const inView = useRef(false);
  const live = useSyncExternalStore(
    idle,
    () => true,
    () => false,
  );
  const still = useSyncExternalStore(
    onStillChange,
    () => window.matchMedia(stillQuery).matches,
    () => true,
  );
  const [shown, setShown] = useState<{
    active: number;
    leaving?: number;
    /** Chosen by the visitor, so worth announcing. */
    chosen: boolean;
  }>({ active: 0, chosen: false });
  const count = reviews.length;
  const { active, leaving, chosen } = shown;

  const step = useCallback(
    (delta: number, byVisitor: boolean) =>
      setShown((current) => ({
        active: (current.active + delta + count) % count,
        leaving: current.active,
        chosen: byVisitor,
      })),
    [count],
  );

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        inView.current = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.4 },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const playing = live && !still && count > 1;
  useEffect(() => {
    if (!playing) return;
    let elapsed = 0;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const away = !inView.current || document.hidden;
      const held = hold.current.hover || hold.current.focus;
      // Time counts while the review can be seen. A pointer or keyboard focus
      // keeps it up as long as it rests there, and a little longer after.
      if (!away) elapsed += now - last;
      if (held) elapsed = Math.min(elapsed, REVIEW_INTERVAL_MS - RESUME_MS);
      last = now;
      if (!away && elapsed >= REVIEW_INTERVAL_MS) {
        window.clearInterval(timer);
        step(1, false);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, active, step]);

  const place = (index: number) => {
    if (index === active) return "active";
    if (index === (active + 1) % count) return "next";
    if (index === (active - 1 + count) % count) return "prev";
    return "away";
  };
  const state = (index: number) => {
    if (!live) return undefined;
    if (index === active) return leaving === undefined ? "rest" : "in";
    return index === leaving ? "out" : "away";
  };

  return (
    <div
      ref={root}
      className="home-reviews"
      data-live={live ? "" : undefined}
      onPointerEnter={() => (hold.current.hover = true)}
      onPointerLeave={() => (hold.current.hover = false)}
      // Keyboard focus holds a review; the focus a mouse click leaves behind
      // on the button does not, or one click would stop it for good.
      onFocusCapture={(event) =>
        (hold.current.focus = event.target.matches(":focus-visible"))
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          hold.current.focus = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") step(-1, true);
        if (event.key === "ArrowRight") step(1, true);
      }}
    >
      <div className="home-reviews-stage" aria-hidden="true">
        <span className="home-reviews-sun" />
        {reviews.map((review, index) => (
          <div
            key={review.image}
            className="home-reviews-card rounded-surface"
            data-place={place(index)}
          >
            <Image
              src={review.image}
              alt=""
              width={900}
              height={900}
              quality={90}
              sizes="(min-width: 64rem) 24rem, 70vw"
            />
          </div>
        ))}
      </div>
      <div
        className="glass glass-liquid home-reviews-sheet rounded-surface"
        data-glint=""
      >
        <ul role="list" className="home-reviews-list">
          {reviews.map((review, index) => (
            <li key={review.image} data-state={state(index)}>
              <figure>
                <figcaption>
                  <span className="block text-item-title text-primary">
                    {review.author}
                  </span>
                  <span className="mt-1 block text-small text-muted-foreground">
                    {review.context}
                  </span>
                </figcaption>
                <blockquote className="mt-5 font-reading text-reading md:text-section-title md:font-normal">
                  <p>
                    {/* One sentence for assistive technology; the animated
                        words are a picture of it. */}
                    <span className="sr-only select-none">{review.quote}</span>
                    <span aria-hidden="true">
                      {review.quote.split(" ").map((word, at) => (
                        <Fragment key={at}>
                          <span
                            className="home-reviews-word"
                            style={{ "--i": at } as CSSProperties}
                          >
                            {word}
                          </span>{" "}
                        </Fragment>
                      ))}
                    </span>
                  </p>
                </blockquote>
              </figure>
            </li>
          ))}
        </ul>
        {live && count > 1 && (
          <div className="home-reviews-controls">
            <span
              className="home-reviews-track"
              aria-hidden="true"
              style={{ "--at": active } as CSSProperties}
            >
              {reviews.map((review) => (
                <span key={review.image} />
              ))}
              <span className="home-reviews-marker" />
            </span>
            <button
              type="button"
              className="action action-outline"
              aria-label="Next review"
              onClick={() => step(1, true)}
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        {/* Only a change the visitor asked for is announced; the automatic
            ones would interrupt someone reading elsewhere on the page. */}
        <p className="sr-only" role="status">
          {live && chosen ? `Review ${active + 1} of ${count}` : ""}
        </p>
      </div>
    </div>
  );
}
