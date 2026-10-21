import {
  CalendarDays,
  CalendarOff,
  Clock,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { WorkspaceLink } from "@/components/workspace/navigation";
import {
  groupWorkspaceLinks,
  type LinkPlacement,
} from "@/components/workspace/link-groups";

const tutorGroups = [
  { id: "teaching", label: "Teaching" },
  { id: "listing", label: "Your listing" },
] as const;
type TutorGroupId = (typeof tutorGroups)[number]["id"];

const placement: LinkPlacement<TutorGroupId>[] = [
  ["/tutor", "teaching", CalendarDays],
  ["/tutor/availability", "teaching", Clock],
  ["/tutor/time-off", "teaching", CalendarOff],
  ["/tutor/profile", "listing", UserRound],
  ["/tutor/screening", "listing", ShieldCheck],
];

/** Presentation grouping for the Tutor workspace sidebar. */
export function groupTutorLinks(links: readonly WorkspaceLink[]) {
  return groupWorkspaceLinks(links, tutorGroups, placement);
}
