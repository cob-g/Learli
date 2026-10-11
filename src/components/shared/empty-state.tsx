import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  href,
  action,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-item-title">{title}</h2>
      <div className="max-w-prose text-body">{children}</div>
      {href && action ? (
        <Link className="action action-outline mt-4" href={href}>
          {action}
        </Link>
      ) : null}
    </section>
  );
}
