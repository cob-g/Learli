// @vitest-environment jsdom
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "@/lib/permissions/access";

const state = vi.hoisted(() => ({
  roles: ["parent"] as string[],
  privateWorkflow: false,
  ordinaryParent: false,
  groups: vi.fn(),
  requests: vi.fn(),
  creation: vi.fn(),
  intake: vi.fn(),
  profile: vi.fn(),
  account: vi.fn(),
}));
vi.mock("@/lib/permissions/workspace", () => {
  async function load(
    _path: string,
    operation: (runtime: unknown, headers: Headers) => unknown,
  ) {
    try {
      return await operation({}, new Headers());
    } catch {
      return null;
    }
  }
  return { loadPrivatePage: load, loadPrivateAccountPage: load };
});
vi.mock("@/lib/permissions/access", () => ({
  AccessError: class AccessError extends Error {
    constructor(public status: number) {
      super("Unavailable");
    }
  },
  requireIdentity: async () => ({ userId: "parent-owner", roles: state.roles }),
}));
vi.mock("@/features/account/service", () => ({
  readAccount: () => state.account(),
}));
vi.mock("@/features/learners/composition", () => ({
  listLearnerGroups: () => state.groups(),
  readComposedLearner: () => state.profile(),
}));
vi.mock("@/features/learners/service", () => ({
  readLearnerCreationContext: () => state.creation(),
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: (runtime: unknown) => runtime,
}));
vi.mock("@/features/learner-admission/service", () => ({
  listMyAdmissions: () => state.requests(),
  readAdmissionIntake: () => state.intake(),
}));
vi.mock("@/features/local-workflow/runtime", () => ({
  getLocalWorkflow: () => (state.ordinaryParent ? {} : null),
}));
vi.mock("@/features/parent-children/service", () => ({
  readParentChildIntake: () => state.intake(),
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  isPrivateWorkflow: () => state.privateWorkflow,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/learners/learner-link", () => ({
  LearnerLink: ({
    label,
    href,
    ariaLabel,
  }: {
    label: string;
    href: string;
    ariaLabel?: string;
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {label}
    </a>
  ),
}));

import ParentProfilePage from "@/app/(workspace)/parent/profile/page";
import ParentChildrenPage from "@/app/(workspace)/parent/children/page";
import AddChildPage from "@/app/(workspace)/parent/children/new/page";
import ChildProfilePage from "@/app/(workspace)/parent/children/[learnerId]/page";

const child = {
  id: "f46100ba-6853-4f5d-ad37-25992b15b507",
  displayName: "Fictional Child",
  management: "guardian" as const,
  level: "middle_school" as const,
  grade: 8,
  timezone: "Asia/Manila",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.roles = ["parent"];
  state.privateWorkflow = false;
  state.ordinaryParent = false;
  state.groups.mockResolvedValue({
    demo: [child],
    readiness: [],
    demoAllowed: true,
    admissionEnabled: false,
  });
  state.creation.mockResolvedValue({
    modes: ["guardian", "self"],
    timezone: "Asia/Manila",
  });
  state.requests.mockResolvedValue({ items: [], nextCursor: null });
  state.profile.mockResolvedValue({ profile: child, reviewed: false });
  state.account.mockImplementation(async () => ({
    id: "parent-owner",
    name: "Fictional Parent",
    email: "parent@learli.test",
    timezone: "Asia/Manila",
    roles: state.roles,
  }));
  state.intake.mockResolvedValue({
    enabled: true,
    policyVersion: "synthetic-admission-v1",
    policyDigest: "a".repeat(64),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("parent profile and children boundaries", () => {
  it("reuses the own-account form with registered email and the child entry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "parent-owner" }));
    vi.stubGlobal("fetch", fetch);
    render(await ParentProfilePage());
    expect(
      screen.getByText("Registered email: parent@learli.test"),
    ).toBeVisible();
    expect(screen.getByLabelText("Display name")).toHaveValue(
      "Fictional Parent",
    );
    expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Manila");
    expect(screen.getByRole("link", { name: "My Children" })).toHaveAttribute(
      "href",
      "/parent/children",
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Updated Parent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await screen.findByText("Account settings saved.");
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/parent-owner",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated Parent",
          timezone: "Asia/Manila",
        }),
      }),
    );
  });
  it("lists only guardian children, with exact grade and truthful local status", async () => {
    state.groups.mockResolvedValue({
      demo: [
        child,
        {
          ...child,
          id: "other",
          displayName: "Own College Profile",
          management: "self",
        },
      ],
      readiness: [],
      demoAllowed: true,
      admissionEnabled: false,
    });
    render(await ParentChildrenPage());
    expect(
      screen.getByRole("heading", { name: "Fictional Child" }),
    ).toBeVisible();
    expect(screen.queryByText("Own College Profile")).not.toBeInTheDocument();
    expect(screen.getByText("Middle School · Grade 8")).toBeVisible();
    expect(screen.getByText("Saved for local testing")).toBeVisible();
    expect(screen.getByRole("link", { name: "Add Child" })).toHaveAttribute(
      "href",
      "/parent/children/new",
    );
    expect(
      screen.getByRole("link", {
        name: "Edit child profile for Fictional Child",
      }),
    ).toHaveAttribute("href", `/parent/children/${child.id}`);
  });
  it("separates current authorized children from saved pending guardian requests", async () => {
    state.privateWorkflow = true;
    state.groups.mockResolvedValue({
      demo: [],
      readiness: [child],
      demoAllowed: false,
      admissionEnabled: true,
    });
    state.requests.mockResolvedValue({
      items: [
        {
          id: "own-request",
          management: "guardian",
          state: "pending",
          createdAt: new Date("2026-10-17T00:00:00Z"),
        },
        {
          id: "own-college",
          management: "self",
          state: "pending",
          createdAt: new Date(),
        },
      ],
      nextCursor: "older",
    });
    render(await ParentChildrenPage());
    const profiles = screen.getByRole("region", {
      name: "Your child profiles",
    });
    const requests = screen.getByRole("region", { name: "Child requests" });
    expect(
      within(profiles).getByText("Authorized — current reviewed access"),
    ).toBeVisible();
    expect(within(requests).getByText("Saved — pending review")).toBeVisible();
    expect(
      within(requests).getByText(
        /Pending requests grant no profile or booking access/,
      ),
    ).toBeVisible();
    expect(
      within(requests).getByRole("link", { name: "View child request" }),
    ).toHaveAttribute("href", "/learner-admission/own-request");
    expect(
      within(requests).queryByRole("link", { name: "Edit child profile" }),
    ).toBeNull();
    expect(state.requests).toHaveBeenCalledTimes(1);
    expect(state.profile).not.toHaveBeenCalled();
  });
  it("uses only guardian creation on a parent page even for multi-role accounts", async () => {
    state.roles = ["parent", "student"];
    render(await AddChildPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Add Child",
    );
    expect(screen.queryByLabelText("Local profile type")).toBeNull();
    expect(screen.getByLabelText("Grade (optional)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save child profile" }),
    ).toBeVisible();
  });
  it("keeps private staging on admission review, without independent request selection", async () => {
    state.privateWorkflow = true;
    render(await AddChildPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("button", { name: "Save child request" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Request type")).toBeNull();
    expect(state.creation).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Access stays pending until authorized/),
    ).toBeVisible();
  });
  it("ordinary Parent Add Child uses declarations and immediate access rather than a review request", async () => {
    state.ordinaryParent = true;
    state.intake.mockResolvedValue({
      enabled: true,
      policyVersion: "local-guardian-admission-v2",
      policyDigest: "a".repeat(64),
      noticeVersion: "local-guardian-notice-v2",
      timezone: "Asia/Manila",
    });
    render(await AddChildPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("checkbox", { name: /I confirm/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /I consent/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save child profile" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save child request" }),
    ).toBeNull();
    expect(screen.queryByText(/pending|assigned.*review/i)).toBeNull();
    expect(state.creation).not.toHaveBeenCalled();
  });
  it("ordinary child list uses current authorized access and preserves earlier pending requests", async () => {
    state.ordinaryParent = true;
    state.groups.mockResolvedValue({
      demo: [],
      readiness: [child],
      demoAllowed: false,
      admissionEnabled: true,
    });
    state.requests.mockResolvedValue({
      items: [
        {
          id: "earlier",
          management: "guardian",
          state: "pending",
          createdAt: new Date("2026-10-17T00:00:00Z"),
        },
        {
          id: "automatic-receipt",
          management: "guardian",
          state: "authorized",
          policyVersion: "local-guardian-admission-v2",
          createdAt: new Date("2026-10-18T00:00:00Z"),
        },
      ],
      nextCursor: null,
    });
    render(await ParentChildrenPage());
    expect(
      screen.getAllByRole("link", { name: "View child review record" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "View child review record" }),
    ).toHaveAttribute("href", "/learner-admission/earlier");
    expect(
      screen.getByText("Ready for booking — current authorized access"),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Earlier child review records" }),
    ).toBeVisible();
    expect(
      screen.getByText(/retained records cover child reviews/),
    ).toHaveTextContent("New child profiles use self-service setup");
    expect(screen.getByText("Saved — pending review")).toBeVisible();
    expect(
      screen.queryByText("Authorized — current reviewed access"),
    ).toBeNull();
  });
  it("keeps the older-record path when the current page only contains automatic receipts", async () => {
    state.ordinaryParent = true;
    state.groups.mockResolvedValue({
      demo: [],
      readiness: [child],
      demoAllowed: false,
      admissionEnabled: true,
    });
    state.requests.mockResolvedValue({
      items: [
        {
          id: "automatic-receipt",
          management: "guardian",
          state: "authorized",
          policyVersion: "local-guardian-admission-v2",
          createdAt: new Date("2026-10-18T00:00:00Z"),
        },
      ],
      nextCursor: "older",
    });
    render(await ParentChildrenPage());
    expect(
      screen.getByRole("region", { name: "Earlier child review records" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Earlier child review records continue on an older page.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "View all learner review records and older pages",
      }),
    ).toHaveAttribute("href", "/learner-admission");
    expect(
      screen.queryByRole("link", { name: "View child review record" }),
    ).not.toBeInTheDocument();
  });
  it("edits an authorized guardian's grade while retaining the reviewed-level lock", async () => {
    state.profile.mockResolvedValue({ profile: child, reviewed: true });
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: child.id }));
    vi.stubGlobal("fetch", fetch);
    render(
      await ChildProfilePage({
        params: Promise.resolve({ learnerId: child.id }),
      }),
    );
    expect(screen.getByLabelText("Level")).toBeDisabled();
    expect(screen.getByLabelText("Grade (optional)")).toHaveValue("8");
    fireEvent.change(screen.getByLabelText("Grade (optional)"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toEqual({
      displayName: child.displayName,
      grade: 9,
      timezone: child.timezone,
    });
    expect(payload).not.toHaveProperty("level");
  });
  it("denies foreign, unavailable and self-managed records at the parent child boundary", async () => {
    state.profile.mockRejectedValueOnce(new AccessError(404));
    const denied = render(
      await ChildProfilePage({
        params: Promise.resolve({ learnerId: child.id }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Child profile unavailable" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Display name")).toBeNull();
    denied.unmount();
    state.profile.mockResolvedValueOnce({
      profile: { ...child, management: "self" },
      reviewed: false,
    });
    render(
      await ChildProfilePage({
        params: Promise.resolve({ learnerId: child.id }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Child profile unavailable" }),
    ).toBeVisible();
  });
  it.each(["student", "tutor", "admin"])(
    "rejects a %s-only account before loading children or admission intake",
    async (role) => {
      state.roles = [role];
      const list = render(await ParentChildrenPage());
      expect(
        screen.getByRole("heading", { name: "Children unavailable" }),
      ).toBeVisible();
      expect(state.groups).not.toHaveBeenCalled();
      list.unmount();
      const create = render(
        await AddChildPage({ searchParams: Promise.resolve({}) }),
      );
      expect(
        screen.getByRole("heading", { name: "Add Child unavailable" }),
      ).toBeVisible();
      expect(state.intake).not.toHaveBeenCalled();
      create.unmount();
      render(await ParentProfilePage());
      expect(
        screen.getByRole("heading", { name: "Parent profile unavailable" }),
      ).toBeVisible();
      expect(screen.queryByLabelText("Display name")).toBeNull();
    },
  );
});
