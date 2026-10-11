"use client";
import Link from "next/link";
export default function BookingError({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">We couldn&apos;t load bookings</h1>
      <p className="mt-4 text-body">
        Try again, or contact support if this keeps happening.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button className="action action-outline" onClick={reset}>
          Try again
        </button>
        <Link className="action action-outline" href="/contact">
          Contact support
        </Link>
      </div>
    </div>
  );
}
