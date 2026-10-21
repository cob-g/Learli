import type { LucideIcon } from "lucide-react";
import type { WorkspaceLink } from "./navigation";

export type GroupedNavLink = WorkspaceLink & { icon: LucideIcon | null };
export type LinkPlacement<Id extends string> = [
  href: string,
  group: Id | null,
  icon: LucideIcon,
];

/**
 * Presentation only: arranges the links a role's `workspaceLinks` already
 * returned into labelled groups. It never adds or removes a destination; a link
 * without a placement stays visible above the groups.
 */
export function groupWorkspaceLinks<
  Id extends string,
  Group extends { id: Id },
>(
  links: readonly WorkspaceLink[],
  groups: readonly Group[],
  // Listed in display order within each group.
  placement: readonly LinkPlacement<Id>[],
) {
  const order = (link: WorkspaceLink) => {
    const index = placement.findIndex(([href]) => href === link.href);
    return index === -1 ? placement.length : index;
  };
  const decorate = (link: WorkspaceLink): GroupedNavLink => ({
    ...link,
    icon: placement[order(link)]?.[2] ?? null,
  });
  const groupOf = (link: WorkspaceLink) => placement[order(link)]?.[1] ?? null;
  const sorted = [...links].sort((a, b) => order(a) - order(b));
  return {
    ungrouped: sorted.filter((link) => !groupOf(link)).map(decorate),
    groups: groups
      .map((group) => ({
        ...group,
        links: sorted
          .filter((link) => groupOf(link) === group.id)
          .map(decorate),
      }))
      .filter((group) => group.links.length > 0),
  };
}
