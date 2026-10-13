import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const areas = [
  ["tutors", "/admin/tutors", "Tutor review queue"],
  ["subjects", "/admin/subjects", "Subjects"],
  ["support", "/admin/support", "Assigned support cases"],
  ["reviews", "/admin/reviews", "Private synthetic reviews"],
  [
    "publication-reviews",
    "/admin/publication-reviews",
    "Synthetic publication reviews",
  ],
  ["accounts", "/admin/accounts", "Authorized local accounts"],
] as const;
export type AdminArea = (typeof areas)[number][0];

/** Admin page frame. Render it only after the admin role check has passed. */
export function AdminShell({
  current,
  children,
}: {
  current?: AdminArea;
  children: ReactNode;
}) {
  return (
    <div className="page-shell page-space lg:flex lg:gap-8">
      <nav
        aria-label="Admin work areas"
        className="mb-8 rounded-surface border border-border bg-surface p-3 lg:mb-0 lg:w-64 lg:shrink-0 lg:self-start"
      >
        <ul className="flex flex-wrap gap-2 lg:flex-col">
          {areas.map(([area, href, label]) => (
            <li key={area} className="max-w-full min-w-0">
              <Link
                href={href}
                prefetch={false}
                aria-current={current === area ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-control border px-3 py-2 no-underline transition-colors",
                  current === area
                    ? "border-primary bg-primary text-label-strong text-on-inverse"
                    : "border-transparent text-label text-foreground hover:bg-subtle",
                )}
              >
                {current === area && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-brand-teal"
                  />
                )}
                <span className="min-w-0 wrap-anywhere">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
