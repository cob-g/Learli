"use client";
import type { ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
function LearnerLinkLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-live="polite" aria-busy={pending}>
      {pending ? "Loading learner profiles…" : label}
    </span>
  );
}
/** Awaited private HTML; hydrated navigation retains content and pending words. */
export function LearnerLink({
  href,
  label,
  ariaLabel,
  className,
  leading,
  trailing,
}: {
  href: string;
  label: string;
  ariaLabel?: string;
  className: string;
  /** Decorative content around the label; keep it aria-hidden. */
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      prefetch={false}
    >
      {leading}
      <LearnerLinkLabel label={label} />
      {trailing}
    </Link>
  );
}
