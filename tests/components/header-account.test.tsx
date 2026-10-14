// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  session: {
    data: null as null | {
      user: { id: string; name: string; email: string };
      session: { token: string };
    },
    isPending: true,
    isRefetching: false,
    error: null as null | { message: string },
  },
  refetch: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ ...mocks.session, refetch: mocks.refetch }),
    signOut: mocks.signOut,
  },
}));
import { HeaderAccount } from "@/components/shared/header-account";
import { SignOut } from "@/features/auth/sign-out";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/";
  mocks.session = {
    data: null,
    isPending: true,
    isRefetching: false,
    error: null,
  };
});
afterEach(() => vi.unstubAllGlobals());

function signedIn(name = "Alex Rivera", id = "synthetic-a") {
  mocks.session.data = {
    user: { id, name, email: "private@learli.test" },
    session: { token: "synthetic-private-token" },
  };
  mocks.session.isPending = false;
}
function openAccount() {
  const button = screen.getByRole("button", { name: /Account/ });
  fireEvent.click(button);
  return button;
}

describe("shared header account", () => {
  it("keeps a native Account fallback in server/loading markup without private data", () => {
    const html = renderToStaticMarkup(<HeaderAccount />);
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/sign-in"');
    expect(html).not.toContain("<button");
    render(<HeaderAccount />);
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByText("Checking account…")).toBeInTheDocument();
    // The shared shell must not conflict with pages' status/error summaries.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("only shows Sign in after a successful absent-session response", () => {
    mocks.session.isPending = false;
    mocks.pathname = "/sign-in";
    render(<HeaderAccount />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows name and initials with account settings and logout only when expanded", () => {
    signedIn();
    const { container } = render(
      <>
        <HeaderAccount />
        <SignOut />
      </>,
    );
    expect(screen.getByText("AR")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Alex Rivera")).toBeVisible();
    expect(container.innerHTML).not.toContain("private@learli.test");
    expect(container.innerHTML).not.toContain("synthetic-private-token");
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);
    const trigger = openAccount();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Account settings" }),
    ).toHaveAttribute("href", "/account");
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(2);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);
  });

  it("dismisses on outside pointer or keyboard focus departure", () => {
    signedIn();
    render(<HeaderAccount />);
    const trigger = openAccount();
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("refetches after navigation, closes disclosure and reacts to updated identity or revocation", () => {
    signedIn();
    const { rerender } = render(<HeaderAccount />);
    expect(mocks.refetch).not.toHaveBeenCalled();
    openAccount();
    mocks.pathname = "/subjects";
    rerender(<HeaderAccount />);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    signedIn("Updated Alex");
    rerender(<HeaderAccount />);
    expect(screen.getByText("Updated Alex")).toBeVisible();
    openAccount();
    signedIn("Another person", "synthetic-b");
    rerender(<HeaderAccount />);
    expect(screen.queryByText("Updated Alex")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    mocks.session.data = null;
    rerender(<HeaderAccount />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByText("Another person")).toBeNull();
  });

  it.each([false, true])(
    "does not interpret a session failure as logout (stale data: %s)",
    (stale) => {
      if (stale) signedIn();
      mocks.session.isPending = false;
      mocks.session.error = { message: "Do not expose provider details" };
      const { rerender } = render(<HeaderAccount />);
      expect(screen.getByRole("link", { name: "Account" })).toBeVisible();
      expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
      expect(screen.queryByText("Alex Rivera")).toBeNull();
      expect(screen.queryByText("Do not expose provider details")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(mocks.refetch).toHaveBeenCalledTimes(1);
      mocks.session.isRefetching = true;
      rerender(<HeaderAccount />);
      expect(
        screen.getByRole("button", { name: "Checking account…" }),
      ).toBeDisabled();
      // The provider clears its error as retry starts, retaining prior data.
      // Keep the neutral checking state until that data has been revalidated.
      mocks.session.error = null;
      rerender(<HeaderAccount />);
      expect(screen.getByRole("link", { name: "Account" })).toBeVisible();
      expect(screen.queryByText("Alex Rivera")).toBeNull();
      mocks.session.isRefetching = false;
      mocks.session.error = null;
      signedIn();
      rerender(<HeaderAccount />);
      expect(screen.getByText("Alex Rivera")).toBeVisible();
    },
  );

  it.each(["  ", "李 明", "A".repeat(100)])(
    "handles empty, international and long names: %s",
    (name) => {
      signedIn(name);
      render(<HeaderAccount />);
      expect(
        screen.getByRole("button", {
          name: `Account ${name.trim() || "Your account"}`,
        }),
      ).toBeVisible();
    },
  );

  it.each(["provider", "network"])(
    "retains a retry after %s sign-out failure",
    async (kind) => {
      signedIn();
      if (kind === "provider")
        mocks.signOut.mockResolvedValue({ error: { message: "private" } });
      else mocks.signOut.mockRejectedValue(new Error("private"));
      render(<HeaderAccount />);
      openAccount();
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Sign-out could not be completed. Try again.",
      );
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
      expect(screen.getByText("Alex Rivera")).toBeVisible();
    },
  );

  it("disables logout while pending and replaces the whole document on success", async () => {
    signedIn();
    let finish: (value: { error: null }) => void = () => {};
    mocks.signOut.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const replace = vi.fn();
    const actualWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(actualWindow, {
        get(target, property) {
          return property === "location"
            ? { replace }
            : Reflect.get(target, property);
        },
      }),
    );
    render(<HeaderAccount />);
    openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => finish({ error: null }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledExactlyOnceWith("/sign-in"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps pending logout mounted when disabling its focused button emits a null-target blur", async () => {
    signedIn();
    let fail: (value: { error: { message: string } }) => void = () => {};
    mocks.signOut.mockImplementation(
      () =>
        new Promise((resolve) => {
          fail = resolve;
        }),
    );
    render(<HeaderAccount />);
    const trigger = openAccount();
    const signOut = screen.getByRole("button", { name: "Sign out" });
    signOut.focus();
    fireEvent.click(signOut);
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    // Browser blur from disabling a focused button differs from tabbing away.
    fireEvent.blur(signOut, { relatedTarget: null });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await act(async () => fail({ error: { message: "Unavailable" } }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out could not be completed. Try again.",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
