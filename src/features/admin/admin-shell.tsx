import type { ReactNode } from "react";

export const adminAreas = [
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
export type AdminArea = (typeof adminAreas)[number][0] | "bookings";

/** Content frame; the dedicated workspace shell owns administrative navigation. */
export function AdminShell({
  children,
}: {
  current?: AdminArea;
  children: ReactNode;
}) {
  return (
    <div className="page-shell page-space">
      <div className="min-w-0">{children}</div>
    </div>
  );
}
