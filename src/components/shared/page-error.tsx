"use client";

import Link from "next/link";

export function PageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">We couldn&apos;t load this page</h1>
      <p role="alert" className="mt-4 max-w-prose text-body">
        Try again, or return to the home page.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button className="action action-primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link href="/">Go to home</Link>
      </div>
    </div>
  );
}
