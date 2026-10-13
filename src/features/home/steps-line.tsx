import type { ReactNode } from "react";
import { LessonTile } from "./lesson-tile";

type Step = {
  title: string;
  body: ReactNode;
  /** One of the lesson glyphs. Without it the tile shows the step's number. */
  glyph?: 1 | 2 | 3;
};

/**
 * Three steps on the page's line, on navy: the landing page's "how a lesson
 * comes together" band for the other public pages. Here the line rises to the
 * right, like the hero's, and the steps read left to right as they climb it
 * (home.css, `.home-rise`). A numbered tile is for a real sequence only, where
 * the order is something the reader needs.
 */
export function StepsLine({
  heading,
  intro,
  steps,
}: {
  heading: ReactNode;
  intro: ReactNode;
  steps: [Step, Step, Step];
}) {
  return (
    <section data-surface="inverse" className="home-lesson-section home-rise">
      <div className="page-shell home-lesson-top">
        <div className="home-lesson-head">
          <h2 className="text-display text-balance">{heading}</h2>
          <p className="max-w-prose text-lead">{intro}</p>
        </div>
      </div>
      <div className="page-shell home-lesson-body">
        <div
          className="home-lesson"
          data-reveal=""
          data-reveal-group="(min-width: 64rem)"
          data-scrub=""
        >
          <span className="home-line" aria-hidden="true">
            <span className="home-line-bead" />
          </span>
          <ol role="list" className="home-steps min-w-0 wrap-anywhere">
            {steps.map((step, index) => (
              <li key={step.title}>
                {step.glyph ? (
                  <LessonTile step={step.glyph} />
                ) : (
                  <div
                    className="glass glass-liquid home-tile"
                    data-glint=""
                    aria-hidden="true"
                  >
                    <span className="home-tile-number">{index + 1}</span>
                  </div>
                )}
                <h3 className="text-section-title">{step.title}</h3>
                <p className="mt-3 max-w-prose text-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
