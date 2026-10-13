import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";

export function SiteFooter() {
  return (
    <footer data-surface="inverse" className="mt-auto">
      <div className="page-shell flex flex-col gap-8 py-12 md:flex-row md:justify-between md:gap-16 md:py-16">
        <div>
          <Link href="/" className="brand-home" aria-label="Learli home">
            <BrandLogo reverse />
          </Link>
          <p className="mt-4 font-reading text-reading">
            Learning made personal.
          </p>
          <p className="mt-3 max-w-prose text-small text-on-inverse-muted">
            One-to-one tutoring. Lessons on Zoom or Google Meet.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="grid grid-cols-2 content-start gap-x-8 gap-y-2 sm:gap-x-12"
        >
          <Link className="nav-link" href="/how-it-works">
            How it works
          </Link>
          <Link className="nav-link" href="/subjects">
            Subjects
          </Link>
          <Link className="nav-link" href="/contact">
            Contact support
          </Link>
          <Link className="nav-link" href="/report-a-concern">
            Report a concern
          </Link>
          <Link className="nav-link" href="/privacy">
            Privacy draft
          </Link>
          <Link className="nav-link" href="/terms">
            Terms draft
          </Link>
          <Link className="nav-link" href="/cancellations">
            Cancellations draft
          </Link>
        </nav>
      </div>
    </footer>
  );
}
