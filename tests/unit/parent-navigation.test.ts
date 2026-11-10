import { describe, expect, it } from "vitest";
import { workspaceLinks } from "@/components/workspace/navigation";
import { groupParentLinks } from "@/features/family-dashboard/parent-navigation";

const modes = {
  default: {},
  hosted: { privateWorkflow: true },
  local: { privateWorkflow: true, localWorkflow: true },
};

describe("Parent navigation grouping", () => {
  for (const [mode, options] of Object.entries(modes)) {
    it(`arranges exactly the ${mode} Parent links without adding or dropping any`, () => {
      const links = workspaceLinks("parent", options);
      const { ungrouped, groups } = groupParentLinks(links);
      const shown = [...ungrouped, ...groups.flatMap((group) => group.links)];
      expect(shown.map(({ href, label }) => [href, label]).sort()).toEqual(
        links.map(({ href, label }) => [href, label]).sort(),
      );
      expect(ungrouped).toEqual([]);
      expect(shown.every((link) => link.icon !== null)).toBe(true);
    });
  }

  it("orders the local groups as Bookings, then Your family", () => {
    const { groups } = groupParentLinks(workspaceLinks("parent", modes.local));
    expect(
      groups.map((group) => [group.label, group.links.map((l) => l.label)]),
    ).toEqual([
      ["Bookings", ["Parent Dashboard", "Bookings", "Book a session"]],
      ["Your family", ["My Children", "Parent Profile"]],
    ]);
  });
});
