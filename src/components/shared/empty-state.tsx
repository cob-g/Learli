import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  href,
  action,
  links = [],
}: {
  title: string;
  children?: ReactNode;
  href?: string;
  action?: string;
  /** At most two secondary links after the one action. */
  links?: { href: string; label: string }[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-item-title">{title}</h2>
      {children && <div className="max-w-prose text-body">{children}</div>}
      {(href && action) || links.length ? (
        <p className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
          {href && action && (
            <Link className="action action-outline" href={href}>
              {action}
            </Link>
          )}
          {links.map((link) => (
            <Link
              key={link.href}
              className="inline-flex min-h-11 items-center"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </p>
      ) : null}
    </section>
  );
}
