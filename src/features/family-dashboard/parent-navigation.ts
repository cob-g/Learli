import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  UserRound,
  Users,
} from "lucide-react";
import type { WorkspaceLink } from "@/components/workspace/navigation";
import {
  groupWorkspaceLinks,
  type LinkPlacement,
} from "@/components/workspace/link-groups";

const parentGroups = [
  { id: "bookings", label: "Bookings" },
  { id: "family", label: "Your family" },
] as const;
type ParentGroupId = (typeof parentGroups)[number]["id"];

const placement: LinkPlacement<ParentGroupId>[] = [
  ["/parent", "bookings", LayoutDashboard],
  ["/bookings?scope=guardian", "bookings", CalendarDays],
  ["/bookings/new?scope=guardian", "bookings", CalendarPlus],
  ["/bookings/new", "bookings", CalendarPlus],
  ["/learner-admission", "bookings", ClipboardList],
  ["/parent/children", "family", Users],
  ["/parent/profile", "family", UserRound],
];

/** Presentation grouping for the Parent workspace sidebar. */
export function groupParentLinks(links: readonly WorkspaceLink[]) {
  return groupWorkspaceLinks(links, parentGroups, placement);
}
