import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A highlighted heading and a short introduction beside a ruled list of
 * facts, on white. Every fact must describe something the product does today.
 */
export function Facts({
  heading,
  intro,
  facts,
}: {
  heading: ReactNode;
  intro: ReactNode;
  facts: ReactNode[];
}) {
  return (
    <section className="border-y border-border bg-surface">
      <div className="page-shell grid gap-x-16 gap-y-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 className="text-display text-balance">{heading}</h2>
          <p className="mt-6 max-w-prose text-lead text-muted-foreground">
            {intro}
          </p>
        </div>
        <ul className="home-ruled home-ruled-closed self-start" data-reveal="">
          {facts.map((fact, index) => (
            <li key={index} className="py-5 text-lead">
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

type Door = { title: string; body: string; href: string; label: string };

/**
 * The two doors a public page ends on: the next thing to do, as an action,
 * and a quieter alternative beside it.
 */
export function TwoDoors({ first, second }: { first: Door; second: Door }) {
  return (
    <section className="bg-surface">
      <div className="page-shell grid md:grid-cols-2">
        <div className="py-12 md:py-20 md:pe-16">
          <h2 className="text-headline">{first.title}</h2>
          <p className="mt-4 max-w-prose text-body text-muted-foreground">
            {first.body}
          </p>
          <p className="mt-8">
            <Link className="action action-primary" href={first.href}>
              {first.label}
              <ArrowRight className="home-arrow" size={20} aria-hidden="true" />
            </Link>
          </p>
        </div>
        <div className="border-t border-border py-12 md:border-s md:border-t-0 md:py-20 md:ps-16">
          <h2 className="text-headline">{second.title}</h2>
          <p className="mt-4 max-w-prose text-body text-muted-foreground">
            {second.body}
          </p>
          <p className="mt-6">
            <Link className="home-cue" href={second.href}>
              {second.label}
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
