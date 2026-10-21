import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  ListFilter,
  ListChecks,
  MessageSquare,
  ShieldAlert,
  Shuffle,
  Star,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceLink } from "@/components/workspace/navigation";
import {
  groupWorkspaceLinks,
  type GroupedNavLink,
} from "@/components/workspace/link-groups";

/**
 * Presentation grouping for the Admin work areas. It only arranges the links
 * `workspaceLinks("admin", …)` already returned; it never adds a destination.
 */
export const adminGroups = [
  {
    id: "reviews",
    label: "Reviews",
    description:
      "Review work assigned to you, including Tutor screening and learner records.",
    icon: ListChecks,
  },
  {
    id: "operations",
    label: "Operations",
    description: "Maintain subjects and open assigned operational records.",
    icon: CalendarDays,
  },
  {
    id: "support",
    label: "Support",
    description: "Handle assigned support work and safety reporting.",
    icon: MessageSquare,
  },
] as const;
export type AdminGroupId = (typeof adminGroups)[number]["id"];

// Listed in display order within each group.
const placement: [href: string, group: AdminGroupId | null, LucideIcon][] = [
  ["/admin", null, LayoutGrid],
  ["/admin/requests", "reviews", ListFilter],
  ["/admin/tutors", "reviews", UserCheck],
  ["/admin/learner-admission", "reviews", FileText],
  ["/admin/reviews", "reviews", Star],
  ["/admin/publication-reviews", "reviews", ClipboardCheck],
  ["/admin/bookings", "operations", CalendarDays],
  ["/admin/subjects", "operations", BookOpen],
  ["/admin/accounts", "operations", Users],
  ["/admin/support", "support", MessageSquare],
  ["/admin/support/dispatch", "support", Shuffle],
  ["/admin/safeguarding", "support", ShieldAlert],
];

export type AdminNavLink = GroupedNavLink;

export function groupAdminLinks(links: readonly WorkspaceLink[]) {
  return groupWorkspaceLinks(links, adminGroups, placement);
}
