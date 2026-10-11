"use client";

import { useTransition, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";

/** Native GET without JS; hydrated navigation keeps pending feedback visible. */
export function DashboardFilterForm({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      action="/parent"
      method="get"
      className="mt-8"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const query = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget))
          if (typeof value === "string") query.append(key, value);
        startTransition(() => router.push(`/parent?${query}`));
      }}
    >
      {children}
      {pending && (
        <p role="status" className="mt-4 text-body">
          Loading your bookings…
        </p>
      )}
    </form>
  );
}

function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="ml-2 text-small">
      Loading your bookings…
    </span>
  ) : null;
}

export function DashboardLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex min-h-11 flex-wrap items-center"
    >
      {children}
      <LinkPending />
    </Link>
  );
}
