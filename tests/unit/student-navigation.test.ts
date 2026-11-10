import { describe, expect, it } from "vitest";
import { workspaceLinks } from "@/components/workspace/navigation";
import { groupStudentLinks } from "@/features/family-dashboard/student-navigation";

const modes = {
  default: {},
  hosted: { privateWorkflow: true },
  local: { privateWorkflow: true, localWorkflow: true },
};

describe("Student navigation grouping", () => {
  for (const [mode, options] of Object.entries(modes)) {
    it(`arranges exactly the ${mode} Student links without adding or dropping any`, () => {
      const links = workspaceLinks("student", options);
      const { ungrouped, groups } = groupStudentLinks(links);
      const shown = [...ungrouped, ...groups.flatMap((group) => group.links)];
      expect(shown.map(({ href, label }) => [href, label]).sort()).toEqual(
        links.map(({ href, label }) => [href, label]).sort(),
      );
      expect(ungrouped).toEqual([]);
      expect(shown.every((link) => link.icon !== null)).toBe(true);
    });
  }

  it("orders the local groups as Bookings, then Your learning", () => {
    const { groups } = groupStudentLinks(
      workspaceLinks("student", modes.local),
    );
    expect(
      groups.map((group) => [group.label, group.links.map((l) => l.label)]),
    ).toEqual([
      ["Bookings", ["Bookings", "Book a session"]],
      ["Your learning", ["Learners"]],
    ]);
  });
});
