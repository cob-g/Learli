import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const areas = [
  ["tutors", "/admin/tutors", "Tutor review queue"],
  ["subjects", "/admin/subjects", "Subjects"],
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
        className="mb-8 border border-border bg-subtle p-4 lg:mb-0 lg:w-60 lg:shrink-0 lg:self-start"
      >
        <ul className="flex flex-wrap gap-2 lg:flex-col">
          {areas.map(([area, href, label]) => (
            <li key={area}>
              <Link
                href={href}
                aria-current={current === area ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-control border px-3 no-underline hover:bg-surface",
                  current === area
                    ? "border-control bg-surface text-label-strong text-primary"
                    : "border-transparent text-label text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
