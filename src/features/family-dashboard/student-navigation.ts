import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import type { WorkspaceLink } from "@/components/workspace/navigation";
import {
  groupWorkspaceLinks,
  type LinkPlacement,
} from "@/components/workspace/link-groups";

const studentGroups = [
  { id: "bookings", label: "Bookings" },
  { id: "learning", label: "Your learning" },
] as const;
type StudentGroupId = (typeof studentGroups)[number]["id"];

const placement: LinkPlacement<StudentGroupId>[] = [
  ["/student", "bookings", CalendarDays],
  ["/bookings/new?scope=student", "bookings", CalendarPlus],
  ["/bookings/new", "bookings", CalendarPlus],
  ["/learner-admission", "bookings", ClipboardList],
  ["/learners", "learning", GraduationCap],
];

/** Presentation grouping for the Student workspace sidebar. */
export function groupStudentLinks(links: readonly WorkspaceLink[]) {
  return groupWorkspaceLinks(links, studentGroups, placement);
}
