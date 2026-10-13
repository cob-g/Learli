import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

type Card = { title: string; items: ReactNode[] };

/**
 * A photograph with two cards lying over its edges: a liquid-glass card low on
 * one side and a navy card high on the other (home.css, `.home-care`). The
 * cards hold text and never move; the photograph drifts inside its frame with
 * scroll and a fine pointer. Source order is the phone order: picture, glass
 * card, navy card.
 *
 * `focus` is where the photograph's subject sits, as a CSS object-position,
 * for the three frame shapes: stacked (5:4), row (16:9) and wide (4:5).
 */
export function LayeredScene({
  image,
  focus,
  glass,
  navy,
}: {
  image: { src: string; alt: string; width: number; height: number };
  focus: { stacked: string; row: string; wide: string };
  glass: Card;
  navy: Card;
}) {
  return (
    <div
      className="home-care"
      data-scrub=""
      data-tilt=""
      style={
        {
          "--focus": focus.stacked,
          "--focus-row": focus.row,
          "--focus-wide": focus.wide,
        } as CSSProperties
      }
    >
      <div className="home-care-photo rounded-surface">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          quality={90}
          sizes="(min-width: 64rem) 40rem, 100vw"
        />
      </div>
      <div
        className="glass glass-liquid home-care-card home-care-learli rounded-surface"
        data-glint=""
      >
        <h3 className="text-item-title">{glass.title}</h3>
        <ul className="home-ruled home-ruled-closed mt-4" data-reveal="">
          {glass.items.map((item, index) => (
            <li key={index} className="py-4">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="home-care-card home-care-tutor rounded-surface"
        data-surface="inverse"
      >
        <h3 className="text-item-title">{navy.title}</h3>
        <ul className="home-ruled home-ruled-closed mt-4" data-reveal="">
          {navy.items.map((item, index) => (
            <li key={index} className="py-4">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
