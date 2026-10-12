import Link from "next/link";

export function SiteFooter() {
  return (
    <footer data-surface="inverse" className="mt-auto">
      <div className="page-shell flex flex-col gap-8 py-8 md:flex-row md:justify-between md:py-12">
        <div>
          {/* Development placeholder; reversed brand artwork is still required. */}
          <Link href="/" className="nav-link text-item-title">
            Learli
          </Link>
          <p className="mt-2 max-w-prose text-small text-on-inverse-muted">
            One-to-one tutoring. Lessons on Zoom or Google Meet.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex max-w-prose flex-wrap gap-x-6 gap-y-2"
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
