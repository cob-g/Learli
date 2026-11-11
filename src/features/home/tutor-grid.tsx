"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Globe } from "lucide-react";
import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import "./tutor-grid.css";

/** What one photo card shows; every field comes from the public tutor read. */
export type TutorGridCard = {
  slug: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  subject: string;
  levels: string;
  summary: string;
  languages: string[];
  href: string;
  /**
   * Only while the visitor has a lesson-time preference: the tutor's next
   * open time that fits it, or null when none does ("Other times").
   */
  timeFit?: { label: string; dateTime: string } | null;
};

const touchOnly = () => window.matchMedia("(hover: none)").matches;

/** "Hover a tutor…" where pointers hover; "Tap a tutor…" on touch screens. */
export function TutorGridHint() {
  return (
    <p className="tutor-grid-hint">
      <span data-hover="">Hover a tutor to see their summary</span>
      <span data-touch="">Tap a tutor to see their summary</span>
    </p>
  );
}

/**
 * Tutor photo cards (owner's "Tutor List" reference), shared by the landing
 * page and Find a tutor. A card's summary opens on hover, keyboard focus or,
 * on touch screens, a tap. Enter moves to View profile; Escape closes the
 * card and keeps focus on it. `entrance` fades cards up as they appear.
 */
export function TutorGrid({
  cards,
  entrance = false,
}: {
  cards: TutorGridCard[];
  entrance?: boolean;
}) {
  // Touch: the one card a tap opened. Keyboard: the card Escape closed.
  const [open, setOpen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  function tap(event: MouseEvent<HTMLElement>, slug: string) {
    if (!touchOnly() || (event.target as Element).closest("a")) return;
    setOpen((current) => (current === slug ? null : slug));
  }
  function key(event: KeyboardEvent<HTMLElement>, slug: string) {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      setDismissed(null);
      event.currentTarget.querySelector<HTMLAnchorElement>("a")?.focus();
    } else if (event.key === "Escape") {
      setOpen(null);
      setDismissed(slug);
      event.currentTarget.focus();
    }
  }
  function leave(slug: string) {
    setDismissed((current) => (current === slug ? null : current));
  }

  return (
    <ul className="tutor-grid" data-entrance={entrance || undefined}>
      {cards.map((card, index) => (
        <li key={card.slug} style={{ "--i": index } as CSSProperties}>
          <article
            className="tutor-tile"
            tabIndex={0}
            aria-label={`${card.name}, ${card.subject}`}
            data-open={open === card.slug || undefined}
            data-dismissed={dismissed === card.slug || undefined}
            onClick={(event) => tap(event, card.slug)}
            onKeyDown={(event) => key(event, card.slug)}
            onMouseLeave={() => leave(card.slug)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                leave(card.slug);
            }}
          >
            <div className="tutor-tile-photo">
              {card.photoUrl ? (
                <Image
                  src={card.photoUrl}
                  alt=""
                  fill
                  sizes="(max-width: 440px) 100vw, (max-width: 760px) 50vw, (max-width: 1100px) 33vw, 300px"
                  unoptimized
                />
              ) : (
                <span className="tutor-tile-initials" aria-hidden="true">
                  {card.initials}
                </span>
              )}
            </div>
            {card.timeFit === undefined ? (
              <span className="tutor-tile-tag" aria-hidden="true">
                {card.subject}
              </span>
            ) : (
              <span
                className="tutor-tile-tag"
                data-tone={card.timeFit ? "fit" : "other"}
              >
                {card.timeFit ? "Fits your time" : "Other times"}
              </span>
            )}
            <div className="tutor-tile-sheet">
              <span className="tutor-tile-band" aria-hidden="true" />
              <div className="tutor-tile-panel">
                <h3 className="tutor-tile-name">{card.name}</h3>
                <p className="tutor-tile-sub">
                  <span>{card.subject}</span>
                  {card.levels}
                </p>
                {card.timeFit && (
                  <p className="tutor-tile-times">
                    <Clock size={13} aria-hidden="true" />
                    <time dateTime={card.timeFit.dateTime}>
                      Next fit: {card.timeFit.label}
                    </time>
                  </p>
                )}
                <p className="tutor-tile-summary">{card.summary}</p>
                <div className="tutor-tile-foot">
                  <p className="tutor-tile-languages">
                    <Globe size={14} aria-hidden="true" />
                    <span>
                      {card.languages.length
                        ? card.languages.join(", ")
                        : "No teaching languages listed"}
                    </span>
                  </p>
                  <Link
                    className="tutor-tile-view"
                    href={card.href}
                    aria-label={`View profile: ${card.name}`}
                  >
                    View profile
                    <span aria-hidden="true">
                      <ArrowRight size={12} strokeWidth={2.4} />
                    </span>
                  </Link>
                </div>
              </div>
              <span className="tutor-tile-orb" aria-hidden="true" />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
