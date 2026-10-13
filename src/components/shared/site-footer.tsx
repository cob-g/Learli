import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { FooterAccent } from "@/components/shared/footer-accent";
import { BrandLogo } from "@/components/shared/brand-logo";

/** The same seven destinations as before, sorted by what a visitor is after. */
const groups = [
  {
    title: "Learli",
    links: [
      ["/how-it-works", "How it works"],
      ["/subjects", "Subjects"],
    ],
  },
  {
    title: "Help",
    links: [
      ["/contact", "Contact support"],
      ["/report-a-concern", "Report a concern"],
    ],
  },
  {
    title: "Policies",
    links: [
      ["/privacy", "Privacy draft"],
      ["/terms", "Terms draft"],
      ["/cancellations", "Cancellations draft"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer data-surface="inverse" className="mt-auto">
      <FooterAccent />
      <div className="page-shell pt-10 pb-6 md:pt-20 md:pb-8">
        <div className="grid gap-8 md:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <div>
            {/* Pulled back by its own padding so the artwork meets the margin. */}
            <Link
              href="/"
              className="brand-home -ms-3"
              aria-label="Learli home"
            >
              <BrandLogo reverse className="w-28 sm:w-36" />
            </Link>
            <p className="mt-4 text-headline text-balance md:mt-6">
              Learning made <span className="brand-highlight">personal.</span>
            </p>
            <p className="mt-3 max-w-prose text-body text-on-inverse-muted md:mt-4">
              One-to-one tutoring. Lessons on Zoom or Google Meet.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:pt-3"
          >
            {groups.map((group) => (
              <div key={group.title} className="min-w-0">
                <h2 className="text-label-strong text-on-inverse-muted">
                  {group.title}
                </h2>
                <ul role="list" className="mt-1 md:mt-2">
                  {group.links.map(([href, label]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="inline-flex min-h-11 max-w-full items-center text-body wrap-anywhere no-underline hover:underline"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-1 border-t border-rule-inverse pt-4 md:mt-16 md:pt-5">
          <p className="max-w-prose text-small text-on-inverse-muted">
            Learli is a tutoring marketplace. Tutors teach independently.
          </p>
          <a
            href="#main-content"
            className="inline-flex min-h-11 items-center gap-2 text-label no-underline hover:underline"
          >
            Back to top
            <ArrowUp size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
