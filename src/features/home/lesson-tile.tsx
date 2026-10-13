import { cn } from "@/lib/utils";
import { LessonGlyph } from "./lesson-glyph";

/**
 * A step's glass tile, shaped like the kit icon, holding that step's glyph.
 * The section's blue stroke runs behind it, so the glass has something to bend
 * and the white glyph stands in front (home.css). Decorative: the step heading
 * beside it carries the meaning.
 */
export function LessonTile({
  step,
  className,
}: {
  step: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn("glass glass-liquid home-tile", className)}
      data-glint=""
    >
      <LessonGlyph step={step} />
    </div>
  );
}
