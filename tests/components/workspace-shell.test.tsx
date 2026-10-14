// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  currentWorkspace,
  isCurrentLink,
  workspaceLinks,
} from "@/components/workspace/navigation";
const state = vi.hoisted(() => ({
  pathname: "/parent",
  session: {
    data: {
      user: { id: "owner", name: "Provider old name" },
      session: { id: "session" },
    } as { user: { id: string; name: string }; session: { id: string } } | null,
    isPending: false,
    isRefetching: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => state.session, signOut: vi.fn() },
}));
vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <span>Learli</span>,
}));
const fetchMock = vi.fn();
const response = (
  roles: string[] = ["parent"],
  name = "Current account name",
  id = "owner",
) => ({ ok: true, json: async () => ({ id, name, roles }) });
function shell(screeningEnabled = true) {
  return render(
    <WorkspaceShell screeningEnabled={screeningEnabled}>
      <h1>Private page content</h1>
    </WorkspaceShell>,
  );
}
beforeEach(() => {
  state.pathname = "/parent";
  state.session.isPending = false;
  state.session.isRefetching = false;
  state.session.error = null;
  state.session.data = {
    user: { id: "owner", name: "Provider old name" },
    session: { id: "session" },
  };
  state.session.refetch.mockClear();
  fetchMock.mockReset().mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("dedicated workspace presentation", () => {
  it("uses guarded identity, real role links and one private main without marketing chrome", async () => {
    const view = shell();
    await screen.findByRole("button", { name: "Account Current account name" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/owner",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    const nav = screen.getByRole("navigation", { name: "Parent work areas" });
    expect(within(nav).getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Find a tutor" })).toHaveAttribute(
      "href",
      "/tutors",
    );
    expect(screen.queryByText("Provider old name")).toBeNull();
    expect(screen.queryByText("Switch workspace")).toBeNull();
    expect(
      view.container.querySelector(".site-header,.site-dock,footer"),
    ).toBeNull();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
  it("keeps shared routes neutral, offers only assigned roles and marks nested settings", async () => {
    state.pathname = "/account/sessions";
    fetchMock.mockResolvedValue(response(["parent", "tutor"]));
    shell();
    await screen.findByRole("button", { name: "Account Current account name" });
    expect(screen.getByText("Your account")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Parent booking history" }),
    ).toHaveAttribute("href", "/bookings?scope=guardian");
    expect(
      screen.getByRole("link", { name: "Tutor booking history" }),
    ).toHaveAttribute("href", "/bookings?scope=tutor");
    fireEvent.click(screen.getByText("Switch workspace"));
    const nav = screen.getByRole("navigation", { name: "Your workspaces" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/parent", "/tutor"]);
    expect(
      screen.queryByRole("navigation", { name: "Parent work areas" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Account settings" }),
    ).toHaveAttribute("aria-current", "page");
  });
  it("uses explicit granted roles, valid shared context and unambiguous grants", () => {
    expect(currentWorkspace("/admin/tutors", ["tutor"])).toBeNull();
    expect(currentWorkspace("/bookings", ["tutor", "parent"])).toBeNull();
    expect(currentWorkspace("/account", ["parent"])).toBe("parent");
    expect(
      currentWorkspace("/support/case", ["parent", "tutor"], "tutor"),
    ).toBe("tutor");
    expect(currentWorkspace("/parent", ["parent", "tutor"], "tutor")).toBe(
      "parent",
    );
    expect(currentWorkspace("/admin", ["parent", "tutor"], "tutor")).toBeNull();
    expect(
      currentWorkspace("/account", ["parent", "student"], "tutor"),
    ).toBeNull();
    expect(currentWorkspace("/learner-admission/new", ["parent"])).toBe(
      "parent",
    );
    expect(
      currentWorkspace("/safeguarding/report", ["parent", "tutor"], "tutor"),
    ).toBe("tutor");
    expect(currentWorkspace("/safeguardingx", ["parent"])).toBeNull();
    expect(currentWorkspace("/tutors", ["tutor"])).toBeNull();
    expect(currentWorkspace("/tutor/profile", ["parent", "tutor"])).toBe(
      "tutor",
    );
    expect(workspaceLinks("admin").map((link) => link.href)).toEqual(
      expect.arrayContaining([
        "/admin/support/dispatch",
        "/admin/safeguarding",
        "/admin/learner-admission",
        "/admin/publication-reviews",
      ]),
    );
  });
  it("shows neutral roleless and failed-account states without stale identity", async () => {
    fetchMock.mockResolvedValue(response([]));
    const view = shell();
    await screen.findByText("No workspace assigned.");
    view.unmount();
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    shell();
    await screen.findByText("Workspace access unavailable.");
    expect(screen.queryByRole("button", { name: /^Account / })).toBeNull();
    expect(screen.queryByText("Parent workspace")).toBeNull();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
  it("keeps names and roles during provider refresh, then drops them on failure", async () => {
    const view = shell();
    await screen.findByRole("button", { name: /^Account Current/ });
    state.session.isRefetching = true;
    view.rerender(
      <WorkspaceShell>
        <h1>Private page content</h1>
      </WorkspaceShell>,
    );
    expect(
      screen.getByRole("button", { name: /^Account Current/ }),
    ).toBeVisible();
    expect(screen.getByText("Parent workspace")).toBeVisible();
    state.session.isRefetching = false;
    state.session.error = new Error("Offline");
    view.rerender(
      <WorkspaceShell>
        <h1>Private page content</h1>
      </WorkspaceShell>,
    );
    expect(screen.getByText("Account status unavailable.")).toBeVisible();
    expect(screen.queryByText("Parent workspace")).toBeNull();
  });
  it("shows the renamed account after a refresh settles", async () => {
    const view = shell();
    await screen.findByRole("button", { name: "Account Current account name" });
    state.session.isRefetching = true;
    view.rerender(
      <WorkspaceShell>
        <h1>Private page content</h1>
      </WorkspaceShell>,
    );
    fetchMock.mockResolvedValue(response(["parent"], "Renamed account"));
    state.session.isRefetching = false;
    view.rerender(
      <WorkspaceShell>
        <h1>Private page content</h1>
      </WorkspaceShell>,
    );
    await screen.findByRole("button", { name: "Account Renamed account" });
  });
  it("clears a kept account when the re-read fails", async () => {
    const view = shell();
    await screen.findByRole("button", { name: /^Account Current/ });
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    reroute(view, "/parent/bookings");
    await screen.findByText("Workspace access unavailable.");
    expect(screen.queryByText("Parent workspace")).toBeNull();
  });
  it("closes the mobile menu on Escape from the toggle and keeps focus there", async () => {
    shell();
    await screen.findByRole("button", { name: /^Account Current/ });
    const trigger = screen.getByRole("button", { name: "Workspace menu" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
  it("aborts an old account read and ignores its late result after account switching", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = shell();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    state.session.data = {
      user: { id: "other", name: "Other" },
      session: { id: "other-session" },
    };
    fetchMock.mockResolvedValue(
      response(["student"], "Other account", "other"),
    );
    view.rerender(
      <WorkspaceShell>
        <h1>Private page content</h1>
      </WorkspaceShell>,
    );
    await screen.findByRole("button", { name: "Account Other account" });
    await act(async () => resolve(response(["admin"], "Old account")));
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText("Old account")).toBeNull();
    expect(screen.queryByText("Admin workspace")).toBeNull();
  });
  it("opens the mobile navigation with focus and restores the trigger on Escape", async () => {
    shell();
    await screen.findByRole("button", { name: /^Account Current/ });
    const trigger = screen.getByRole("button", { name: "Workspace menu" });
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Learli account" }),
      ).toHaveFocus(),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(screen.getByRole("link", { name: "Learli account" }), {
      key: "Escape",
    });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

it("marks assigned admin case details separately from dispatch details", () => {
  const links = workspaceLinks("admin");
  const assigned = links.find((link) => link.href === "/admin/support")!;
  const dispatch = links.find(
    (link) => link.href === "/admin/support/dispatch",
  )!;
  expect(isCurrentLink("/admin/support/case-id", assigned)).toBe(true);
  expect(isCurrentLink("/admin/support/dispatch/case-id", assigned)).toBe(
    false,
  );
  expect(isCurrentLink("/admin/support/dispatch/case-id", dispatch)).toBe(true);
  expect(isCurrentLink("/admin/support/case-id", dispatch)).toBe(false);
});

function reroute(view: ReturnType<typeof shell>, pathname: string) {
  state.pathname = pathname;
  view.rerender(
    <WorkspaceShell screeningEnabled>
      <h1>Current private page</h1>
    </WorkspaceShell>,
  );
}
function deferredResponse() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const promise = new Promise<ReturnType<typeof response>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("keeps the exact tutor links through destination revalidation and keeps the validated name", async () => {
  state.pathname = "/tutor/availability";
  fetchMock.mockResolvedValue(response(["tutor"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  const links = () =>
    within(screen.getByRole("navigation", { name: "Tutor work areas" }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  const expected = [
    "Bookings",
    "Availability",
    "Time off",
    "Profile",
    "Tutor screening",
  ];
  for (const path of [
    "/tutor/profile",
    "/tutor/time-off",
    "/account",
    "/support",
    "/tutor/availability",
  ]) {
    const request = deferredResponse();
    fetchMock.mockReturnValueOnce(request.promise);
    reroute(view, path);
    expect(links()).toEqual(expected);
    expect(
      screen.getByRole("button", { name: /^Account Current/ }),
    ).toBeVisible();
    await act(async () => request.resolve(response(["tutor"])));
    expect(links()).toEqual(expected);
    expect(screen.getByText("Tutor workspace")).toBeVisible();
  }
  expect(fetchMock).toHaveBeenCalledTimes(6);
  expect(state.session.refetch).not.toHaveBeenCalled();
});

it("keeps explicit multi-role switching across shared routes and clears denied context", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["parent", "student", "tutor"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  for (const [path, role] of [
    ["/account", "Tutor"],
    ["/parent", "Parent"],
    ["/learners", "Parent"],
    ["/student", "Student"],
    ["/support", "Student"],
  ]) {
    reroute(view, path);
    await screen.findByRole("button", { name: /^Account Current/ });
    expect(
      screen.getByRole("navigation", { name: `${role} work areas` }),
    ).toBeVisible();
  }
  reroute(view, "/admin");
  await screen.findByRole("button", { name: /^Account Current/ });
  expect(screen.queryByRole("navigation", { name: /work areas/ })).toBeNull();
  reroute(view, "/account");
  await screen.findByRole("button", { name: /^Account Current/ });
  expect(screen.queryByRole("navigation", { name: /work areas/ })).toBeNull();
});

it("revalidates a rapid A to B to A transition and ignores both late responses", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["tutor", "parent"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  const first = deferredResponse(),
    second = deferredResponse();
  fetchMock.mockReturnValueOnce(first.promise);
  reroute(view, "/parent");
  const firstSignal = fetchMock.mock.calls.at(-1)![1].signal as AbortSignal;
  fetchMock.mockReturnValueOnce(second.promise);
  reroute(view, "/tutor");
  expect(firstSignal.aborted).toBe(true);
  expect(
    screen.getByRole("button", { name: /^Account Current/ }),
  ).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await act(async () => first.resolve(response(["admin"], "Late account")));
  expect(screen.queryByText("Late account")).toBeNull();
  state.session.isRefetching = true;
  reroute(view, "/tutor");
  await act(async () => second.resolve(response(["tutor"], "Late tutor")));
  expect(screen.queryByText("Late tutor")).toBeNull();
  // The validated account is kept; only a settled read may replace it.
  expect(screen.getByText("Current account name")).toBeVisible();
});

it("clears revoked grants and account failures, and retries without reviving stale links", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["tutor", "parent", "student"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  fetchMock.mockResolvedValue(response(["parent", "student"]));
  reroute(view, "/support");
  await screen.findByRole("button", { name: /^Account Current/ });
  expect(screen.queryByRole("navigation", { name: /work areas/ })).toBeNull();
  fetchMock.mockResolvedValue({ ok: false });
  reroute(view, "/account");
  await screen.findByText("Workspace access unavailable.");
  expect(screen.queryByText("Switch workspace")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Account Current/ })).toBeNull();
  const retry = deferredResponse();
  fetchMock.mockReturnValueOnce(retry.promise);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.queryByRole("navigation", { name: /work areas/ })).toBeNull();
  await act(async () => retry.resolve(response(["student"])));
  expect(
    screen.getByRole("navigation", { name: "Student work areas" }),
  ).toBeVisible();
});

it("invalidates navigation on session replacement, anonymous and provider error states", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["tutor"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  const nextSession = deferredResponse();
  fetchMock.mockReturnValueOnce(nextSession.promise);
  state.session.data!.session.id = "replacement";
  reroute(view, "/account");
  expect(screen.queryByRole("navigation", { name: /work areas/ })).toBeNull();
  state.session.data = null;
  reroute(view, "/account");
  await act(async () =>
    nextSession.resolve(response(["tutor"], "Late replacement")),
  );
  expect(screen.queryByText("Late replacement")).toBeNull();
  expect(screen.getByText("Sign in to open your workspace.")).toBeVisible();
  state.session.error = new Error("Unavailable");
  reroute(view, "/account");
  expect(screen.getByText("Account status unavailable.")).toBeVisible();
});

it("closes the mobile menu on link activation and subsequent navigation", async () => {
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  const trigger = screen.getByRole("button", { name: "Workspace menu" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("link", { name: "Account settings" }));
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  reroute(view, "/learners");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("keeps selected multi-role intent through a same-session refresh and applies the re-read grants", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["tutor", "parent"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  reroute(view, "/account");
  await screen.findByRole("button", { name: /^Account Current/ });
  state.session.isRefetching = true;
  reroute(view, "/account");
  expect(
    screen.getByRole("navigation", { name: "Tutor work areas" }),
  ).toBeVisible();
  const refresh = deferredResponse();
  fetchMock.mockReturnValueOnce(refresh.promise);
  state.session.isRefetching = false;
  reroute(view, "/account");
  await act(async () => refresh.resolve(response(["parent", "tutor"])));
  expect(
    screen.getByRole("navigation", { name: "Tutor work areas" }),
  ).toBeVisible();
});

it("marks shared booking lists and detail return scopes only for the matching workspace", () => {
  const parent = workspaceLinks("parent")[0];
  const student = workspaceLinks("student")[0];
  const tutor = workspaceLinks("tutor")[0];
  expect(isCurrentLink("/bookings", parent, "guardian")).toBe(true);
  expect(isCurrentLink("/bookings/opaque-id", parent, "guardian")).toBe(true);
  expect(isCurrentLink("/bookings/opaque-id", student, "guardian")).toBe(false);
  expect(isCurrentLink("/bookings", tutor, "tutor")).toBe(true);
  expect(isCurrentLink("/bookings", parent)).toBe(false);
});

it("closes the native workspace chooser on role selection without losing keyboard focus", async () => {
  state.pathname = "/tutor";
  fetchMock.mockResolvedValue(response(["tutor", "parent"]));
  const view = shell();
  await screen.findByRole("button", { name: /^Account Current/ });
  const summary = screen.getByText("Switch workspace");
  const details = summary.closest("details")!;
  details.open = true;
  const link = within(
    screen.getByRole("navigation", { name: "Your workspaces" }),
  ).getByRole("link", { name: "Parent workspace" });
  link.focus();
  fireEvent.click(link);
  expect(details.open).toBe(false);
  expect(summary).toHaveFocus();
  details.open = true;
  const sameRole = within(
    screen.getByRole("navigation", { name: "Your workspaces" }),
  ).getByRole("link", { name: "Tutor workspace" });
  sameRole.focus();
  fireEvent.click(sameRole);
  expect(details.open).toBe(false);
  expect(summary).toHaveFocus();
  details.open = true;
  reroute(view, "/account");
  expect(
    screen.getByText("Switch workspace").closest("details"),
  ).not.toHaveAttribute("open");
});

describe("first render from the server's account read", () => {
  const serverAccount = {
    id: "owner",
    name: "Server account name",
    roles: ["admin" as const],
    sessionId: "session",
  };
  function seeded(account = serverAccount) {
    return (
      <WorkspaceShell initialAccount={account}>
        <h1>Private page content</h1>
      </WorkspaceShell>
    );
  }
  beforeEach(() => {
    state.pathname = "/admin";
    // Better Auth flags its first session load as both pending and refetching.
    state.session.isPending = true;
    state.session.isRefetching = true;
    state.session.data = null;
  });
  it("shows the full role sidebar and name before the session settles, with no repeat read", () => {
    const view = render(seeded());
    expect(
      screen.getByRole("navigation", { name: "Admin work areas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Account Server account name" }),
    ).toBeVisible();
    state.session.isPending = false;
    state.session.isRefetching = false;
    state.session.data = {
      user: { id: "owner", name: "Provider name" },
      session: { id: "session" },
    };
    view.rerender(seeded());
    expect(
      screen.getByRole("navigation", { name: "Admin work areas" }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    state.pathname = "/admin/subjects";
    view.rerender(seeded());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps links and name on a navigation before the session settles", () => {
    const view = render(seeded());
    state.pathname = "/admin/tutors";
    view.rerender(seeded());
    expect(
      screen.getByRole("navigation", { name: "Admin work areas" }),
    ).toBeVisible();
    expect(screen.getByText("Server account name")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("discards the server's account when another session or no session settles", async () => {
    const view = render(seeded());
    state.session.isPending = false;
    state.session.isRefetching = false;
    state.session.data = {
      user: { id: "owner", name: "Provider name" },
      session: { id: "replacement-session" },
    };
    fetchMock.mockResolvedValue(response(["parent"], "Current account name"));
    view.rerender(seeded());
    expect(screen.queryByText("Server account name")).toBeNull();
    await screen.findByRole("button", { name: "Account Current account name" });
    expect(
      screen.queryByRole("navigation", { name: "Admin work areas" }),
    ).toBeNull();
    view.unmount();
    state.session.isPending = true;
    state.session.data = null;
    const signedOut = render(seeded());
    state.session.isPending = false;
    state.session.isRefetching = false;
    signedOut.rerender(seeded());
    expect(screen.getByText("Sign in to open your workspace.")).toBeVisible();
    expect(screen.queryByText("Server account name")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Admin work areas" }),
    ).toBeNull();
  });
  it("does not use the server's account after a provider error", () => {
    const view = render(seeded());
    state.session.isPending = false;
    state.session.isRefetching = false;
    state.session.error = new Error("Offline");
    view.rerender(seeded());
    expect(screen.getByText("Account status unavailable.")).toBeVisible();
    expect(screen.queryByText("Server account name")).toBeNull();
  });
});

it("lists tutor screening only when the deployment enables it", () => {
  const hrefs = (screening?: boolean) =>
    workspaceLinks("tutor", { screening }).map((link) => link.href);
  expect(hrefs(true)).toContain("/tutor/screening");
  expect(hrefs(false)).not.toContain("/tutor/screening");
  expect(hrefs()).not.toContain("/tutor/screening");
});

it("renders no screening item on the first paint when disabled", () => {
  state.pathname = "/tutor";
  shell(false);
  expect(screen.queryByRole("link", { name: "Tutor screening" })).toBeNull();
});
