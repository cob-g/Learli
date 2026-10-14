"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Admission unavailable</h1>
      <p
        role="alert"
        className="mt-4 max-w-prose text-body text-muted-foreground"
      >
        This request could not be opened. Try again to reload its current
        status, or return to home.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="action action-primary"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(() => {
              reset();
              router.refresh();
            })
          }
        >
          {pending ? "Trying again…" : "Try again"}
        </button>
        <Link href="/">Go to home</Link>
      </div>
    </div>
  );
}
