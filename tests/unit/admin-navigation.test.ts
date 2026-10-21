import { describe, expect, it } from "vitest";
import { workspaceLinks } from "@/components/workspace/navigation";
import { groupAdminLinks } from "@/features/admin/admin-navigation";

const modes = {
  default: {},
  hosted: { privateWorkflow: true },
  local: { privateWorkflow: true, privateAccounts: true, localWorkflow: true },
};

describe("Admin navigation grouping", () => {
  for (const [mode, options] of Object.entries(modes)) {
    it(`arranges exactly the ${mode} Admin links without adding or dropping any`, () => {
      const links = workspaceLinks("admin", options);
      const { ungrouped, groups } = groupAdminLinks(links);
      const shown = [...ungrouped, ...groups.flatMap((group) => group.links)];
      expect(shown.map(({ href, label }) => [href, label]).sort()).toEqual(
        links.map(({ href, label }) => [href, label]).sort(),
      );
      expect(ungrouped.map((link) => link.href)).toEqual(["/admin"]);
      expect(groups.every((group) => group.links.length > 0)).toBe(true);
    });
  }

  it("orders the local review group as the approved design does", () => {
    const { groups } = groupAdminLinks(workspaceLinks("admin", modes.local));
    expect(
      groups.map((group) => [group.label, group.links.map((l) => l.label)]),
    ).toEqual([
      [
        "Reviews",
        [
          "Unassigned reviews",
          "Tutor review queue",
          "Assigned learner review records",
        ],
      ],
      ["Operations", ["Assigned bookings", "Subjects", "Accounts"]],
      ["Support", ["Assigned support cases"]],
    ]);
  });

  it("keeps an unknown destination visible rather than hiding it", () => {
    const { ungrouped } = groupAdminLinks([
      { href: "/admin/new-area", label: "New area" },
    ]);
    expect(ungrouped).toEqual([
      { href: "/admin/new-area", label: "New area", icon: null },
    ]);
  });
});
