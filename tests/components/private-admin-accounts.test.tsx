// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  accountListHref,
  accountTargetHref,
  privateAccountDetailQueryInput,
  privateAccountQueryInput,
} from "@/features/account-restrictions/input";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  packet: vi.fn(),
  refresh: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/lib/permissions/workspace", () => ({ loadPrivatePage: mocks.load }));
vi.mock("@/features/account-restrictions/service", () => ({
  listTargets: mocks.list,
  readTarget: mocks.detail,
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  getPrivateWorkflow: mocks.packet,
}));
vi.mock("@/features/account-restrictions/pending", () => ({
  AccountReadLink: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
import AccountsPage from "@/app/(workspace)/admin/accounts/page";
import AccountPage from "@/app/(workspace)/admin/accounts/[targetId]/page";
import { TargetView } from "@/features/account-restrictions/presentation";
import { ChangeAccessForm } from "@/features/account-restrictions/change-form";

const query = privateAccountQueryInput.parse({
  q: "A_%",
  role: "tutor",
  status: "active",
  page: 2,
  pageSize: 2,
});
const target = {
  id: "fictional-account",
  name: "Fictional Tutor",
  roles: ["parent", "tutor"] as ("parent" | "tutor")[],
  status: "active" as const,
  revision: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.packet.mockReturnValue({});
  mocks.load.mockImplementation(
    async (_path, load: (r: unknown, h: Headers) => unknown) => {
      try {
        return await load({}, new Headers());
      } catch {
        return null;
      }
    },
  );
  mocks.list.mockResolvedValue({
    targets: [target],
    page: 2,
    hasMore: true,
    query,
    privateWorkflow: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("private fictional account list/detail presentation", () => {
  it("provides bounded native GET filters and preserves them through populated pagination/detail", async () => {
    render(
      await AccountsPage({
        searchParams: Promise.resolve({
          q: query.q,
          role: query.role,
          status: query.status,
          page: "2",
          pageSize: "2",
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Authorized fictional accounts" }),
    ).toBeVisible();
    const form = screen.getByRole("form", {
      name: "Filter authorized accounts",
    });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/accounts");
    expect(screen.getByLabelText("Account name")).toHaveValue("A_%");
    expect(screen.getByLabelText("Assigned role")).toHaveValue("tutor");
    expect(screen.getByLabelText("Access status")).toHaveValue("active");
    expect(screen.getByLabelText("Accounts per page")).toHaveAttribute(
      "max",
      "20",
    );
    expect(
      screen.queryByRole("option", { name: "Admin" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous accounts" }),
    ).toHaveAttribute("href", accountListHref(query, 1));
    expect(screen.getByRole("link", { name: "More accounts" })).toHaveAttribute(
      "href",
      accountListHref(query, 3),
    );
    expect(screen.getByRole("link", { name: target.name })).toHaveAttribute(
      "href",
      accountTargetHref(target.id, query),
    );
  });
  it("shows an honest scoped empty result and preserves the legacy no-packet page contract", async () => {
    mocks.list.mockResolvedValueOnce({
      targets: [],
      page: 1,
      hasMore: false,
      query,
      privateWorkflow: true,
    });
    const view = render(
      await AccountsPage({ searchParams: Promise.resolve({}) }),
    );
    expect(
      screen.getByRole("heading", { name: "No matching authorized accounts" }),
    ).toBeVisible();
    expect(screen.getByText(/within your assigned access/)).toBeVisible();
    view.unmount();
    mocks.packet.mockReturnValue(null);
    mocks.list.mockResolvedValueOnce({ targets: [], page: 2, hasMore: false });
    render(
      await AccountsPage({ searchParams: Promise.resolve({ page: "2" }) }),
    );
    expect(mocks.list).toHaveBeenLastCalledWith({}, expect.any(Headers), 2);
    expect(
      screen.getByRole("heading", { name: "Authorized local accounts" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No accounts authorized for you" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("form", { name: "Filter authorized accounts" }),
    ).not.toBeInTheDocument();
  });
  it("does not load target results for duplicate or forged private filter fields", async () => {
    render(
      await AccountsPage({
        searchParams: Promise.resolve({ q: ["one", "two"], role: "admin" }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Accounts unavailable" }),
    ).toBeVisible();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("shows trusted roles as read-only and keeps original list paging separate from history paging", async () => {
    const detailQuery = privateAccountDetailQueryInput.parse({
      ...query,
      historyPage: 3,
    });
    mocks.detail.mockResolvedValue({
      ...target,
      history: [],
      page: 3,
      hasMore: true,
      privateWorkflow: true,
      query: detailQuery,
    });
    render(
      await AccountPage({
        params: Promise.resolve({ targetId: target.id }),
        searchParams: Promise.resolve({
          q: query.q,
          role: query.role,
          status: query.status,
          page: "2",
          pageSize: "2",
          historyPage: "3",
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Assigned roles" }),
    ).toBeVisible();
    expect(screen.getByText("Parent, Tutor")).toBeVisible();
    expect(screen.getByText(/Roles are read-only/)).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: /role/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Authorized accounts" }),
    ).toHaveAttribute("href", accountListHref(query));
    expect(screen.getByRole("link", { name: "Older actions" })).toHaveAttribute(
      "href",
      accountTargetHref(target.id, query, 4),
    );
    expect(screen.getByRole("link", { name: "Newer actions" })).toHaveAttribute(
      "href",
      accountTargetHref(target.id, query, 2),
    );
    expect(mocks.detail).toHaveBeenCalledWith(
      {},
      expect.any(Headers),
      target.id,
      detailQuery,
    );
  });
  it("shows exact private reason/history without introducing role or profile edits", () => {
    render(
      <TargetView
        detail={{
          ...target,
          privateWorkflow: true,
          query: privateAccountDetailQueryInput.parse(query),
          page: 1,
          hasMore: false,
          history: [
            {
              previousStatus: "suspended",
              nextStatus: "active",
              reason: "local_restore_test",
              revision: 1,
              createdAt: "2030-10-16T03:00:00Z",
              actor: "You",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Account access history" }),
    ).toBeVisible();
    expect(screen.getByText(/Fictional restoration test/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Suspend fictional account" }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("private account change request identity", () => {
  it("requires explicit reason/confirmation and retries the same exact bounded PATCH after an uncertain failure", async () => {
    const show = Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        "showModal",
      ),
      close = Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        "close",
      );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    try {
      const fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Synthetic network loss"))
        .mockResolvedValueOnce(
          Response.json({ status: "suspended", revision: 1, replayed: true }),
        );
      vi.stubGlobal("fetch", fetch);
      render(
        <ChangeAccessForm
          targetId={target.id}
          name={target.name}
          status="active"
          revision={0}
          privateWorkflow
        />,
      );
      const form = screen
        .getByRole("button", { name: "Suspend fictional account" })
        .closest("form")!;
      fireEvent.submit(form);
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByText("Choose a fictional test reason.")).toBeVisible();
      fireEvent.change(screen.getByLabelText("Fictional test reason"), {
        target: { value: "local_access_test" },
      });
      fireEvent.submit(form);
      expect(fetch).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Suspend account access" }),
      );
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "We could not confirm the fictional action",
        ),
      );
      const first = JSON.parse(fetch.mock.calls[0][1].body);
      fireEvent.submit(form);
      fireEvent.click(
        screen.getByRole("button", { name: "Suspend account access" }),
      );
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Fictional action recorded",
        ),
      );
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1][0]).toBe(`/api/admin/accounts/${target.id}`);
      expect(fetch.mock.calls[1][1].method).toBe("PATCH");
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(first);
      expect(Object.keys(first).sort()).toEqual([
        "reason",
        "requestKey",
        "revision",
        "status",
      ]);
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    } finally {
      if (show)
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", show);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (close)
        Object.defineProperty(HTMLDialogElement.prototype, "close", close);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
});
