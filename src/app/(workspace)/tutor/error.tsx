"use client";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function TutorBookingsError({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Bookings unavailable</h1>
      <p
        role="alert"
        className="mt-4 flex max-w-prose items-start gap-2 text-body"
      >
        <CircleAlert
          size={20}
          aria-hidden="true"
          className="shrink-0 text-error"
        />
        We couldn&apos;t load your bookings. Try again, or contact support if
        this keeps happening.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        <button type="button" className="action action-primary" onClick={reset}>
          Try again
        </button>
        <Link className="inline-flex min-h-11 items-center" href="/account">
          Account settings
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/contact">
          Contact support
        </Link>
      </div>
    </div>
  );
}
