"use client";
import type { ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
function ReadPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="ml-2 text-small">
      Loading account…
    </span>
  ) : null;
}
/** Native links stay usable without JavaScript and retain content while loading. */
export function AccountReadLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
      <ReadPending />
    </Link>
  );
}
