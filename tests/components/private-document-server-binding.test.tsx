// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WorkspaceLayout from "@/app/(workspace)/layout";

const state = vi.hoisted(() => ({
  runtime: {},
  headers: new Headers(),
  requireIdentity: vi.fn(),
  readAccount: vi.fn(),
  session: {
    data: null as { user: { id: string }; session: { id: string } } | null,
    isPending: true,
    isRefetching: true,
    error: null,
    refetch: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: async () => null,
  getAccountAuthRuntime: async () => state.runtime,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => state.session },
}));
vi.mock("@/features/hosted-auth/request", () => ({
  accountHeadersAllowed: () => true,
}));
vi.mock("@/lib/permissions/access", () => ({
  requireIdentity: state.requireIdentity,
}));
vi.mock("@/features/admin-security/assurance", () => ({}));
vi.mock("@/features/account/service", () => ({
  readAccount: state.readAccount,
}));
vi.mock("@/features/tutor-screening/composition", () => ({}));
vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <span>Learli</span>,
}));

const reload = vi.fn();
const privateMarker = "Synthetic private page for server owner A";
beforeEach(() => {
  state.requireIdentity.mockReset().mockResolvedValue({
    userId: "server-a",
    sessionId: "server-session-a",
    roles: [],
  });
  state.readAccount
    .mockReset()
    .mockRejectedValue(new Error("Display query unavailable"));
  state.session.data = null;
  state.session.isPending = true;
  state.session.isRefetching = true;
  reload.mockReset();
  const nativeWindow = window;
  vi.stubGlobal(
    "window",
    new Proxy(nativeWindow, {
      get(target, key) {
        if (key === "location")
          return {
            href: "http://localhost/account?selection=preserved",
            reload,
          };
        const value = Reflect.get(target, key, target);
        return ["addEventListener", "removeEventListener"].includes(String(key))
          ? value.bind(target)
          : value;
      },
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "server-a",
        name: "Recovered account",
        roles: [],
      }),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function layout() {
  return WorkspaceLayout({ children: <p>{privateMarker}</p> });
}
function settle(id = "server-a", sessionId = "server-session-a") {
  state.session.data = { user: { id }, session: { id: sessionId } };
  state.session.isPending = false;
  state.session.isRefetching = false;
}

it("preserves a trusted server binding when the optional account read fails and the first client identity is already B", async () => {
  settle("client-b", "client-session-b");
  render(await layout());
  expect(screen.queryByText(privateMarker)).toBeNull();
  expect(reload).toHaveBeenCalledExactlyOnceWith();
  expect(state.requireIdentity).toHaveBeenCalledExactlyOnceWith(
    state.runtime,
    state.headers,
  );
  expect(state.readAccount).toHaveBeenCalledTimes(1);
});

it("preserves the binding through the pending first read when chrome has no initial account", async () => {
  const element = await layout();
  const view = render(element);
  expect(screen.getByText(privateMarker)).toBeVisible();
  settle("client-b", "client-session-b");
  view.rerender(await layout());
  expect(screen.queryByText(privateMarker)).toBeNull();
  expect(reload).toHaveBeenCalledTimes(1);
});

it("allows ordinary client account recovery with the same trusted user and session", async () => {
  const element = await layout();
  const view = render(element);
  settle();
  view.rerender(await layout());
  expect(
    await screen.findByRole("button", { name: "Account Recovered account" }),
  ).toBeVisible();
  expect(screen.getByText(privateMarker)).toBeVisible();
  expect(reload).not.toHaveBeenCalled();
});

it("uses the guarded server identity and display account together without repeating either read", async () => {
  state.readAccount.mockResolvedValue({
    id: "server-a",
    name: "Server account",
    roles: [],
  });
  const element = await layout();
  render(element);
  expect(
    screen.getByRole("button", { name: "Account Server account" }),
  ).toBeVisible();
  expect(state.requireIdentity).toHaveBeenCalledTimes(1);
  expect(state.readAccount).toHaveBeenCalledTimes(1);
});

it("does not invent a trusted server identity when identity authorization fails", async () => {
  state.requireIdentity.mockRejectedValue(new Error("Unavailable identity"));
  const element = await layout();
  const view = render(element);
  settle();
  view.rerender(cloneElement(element));
  expect(reload).not.toHaveBeenCalled();
  expect(state.readAccount).not.toHaveBeenCalled();
});
