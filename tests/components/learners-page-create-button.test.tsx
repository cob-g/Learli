// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modes = vi.fn();
vi.mock("@/lib/permissions/workspace", () => ({
  loadPrivatePage: (_path: string, load: (r: unknown, h: unknown) => unknown) =>
    load({}, new Headers()),
}));
vi.mock("@/features/learners/composition", () => ({
  listLearnerGroups: async () => ({
    demo: [],
    readiness: [],
    demoAllowed: true,
    admissionEnabled: false,
  }),
}));
vi.mock("@/features/learners/service", () => ({
  readLearnerCreationContext: () => modes(),
}));
vi.mock("@/features/learners/learner-link", () => ({
  LearnerLink: ({ label, href }: { label: string; href: string }) => (
    <a href={href}>{label}</a>
  ),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import LearnersPage from "@/app/(workspace)/learners/page";

describe("learners page create button", () => {
  beforeEach(() => modes.mockReset());
  it("hides the button for a student whose own profile already exists", async () => {
    modes.mockResolvedValue({ modes: [], timezone: "UTC" });
    render(await LearnersPage());
    expect(
      screen.queryByRole("link", { name: "Create a local learner" }),
    ).not.toBeInTheDocument();
  });
  it("shows the button when a creation mode is available", async () => {
    modes.mockResolvedValue({ modes: ["self"], timezone: "UTC" });
    render(await LearnersPage());
    expect(
      screen.getByRole("link", { name: "Create a local learner" }),
    ).toHaveAttribute("href", "/learners/new");
  });
});
