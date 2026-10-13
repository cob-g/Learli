import { cn } from "@/lib/utils";

/**
 * The kit icon's parts (a ring, two stems, one teal dot) arranged for one step
 * of setting up a lesson: a lens, a clock, then two people under one arc.
 * Decorative; the step heading beside it carries the meaning. The pieces are
 * drawn at the origin and placed by the arrangements in home.css.
 */
export function LessonGlyph({
  step,
  className,
}: {
  step: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <svg
      viewBox="40 40 320 320"
      className={cn("lesson-glyph", className)}
      data-state={step}
      data-reveal=""
      aria-hidden="true"
      focusable="false"
    >
      <circle className="g-ring" r="96" />
      <rect
        className="g-stem g-stem-a"
        x="-11"
        y="-60"
        width="22"
        height="120"
      />
      <rect
        className="g-stem g-stem-b"
        x="-11"
        y="-60"
        width="22"
        height="120"
      />
      <circle className="g-pivot" r="11" />
      <circle className="g-head g-head-a" r="20" />
      <circle className="g-head g-head-b" r="20" />
      <circle className="g-dot" r="20" />
    </svg>
  );
}
