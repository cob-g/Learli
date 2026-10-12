// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignmentForm } from "@/features/support/assignment-form";
import type { DispatchDetail } from "@/features/support/dispatch-service";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const detail: DispatchDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  category: "safety",
  status: "open",
  revision: 0,
  assigned: false,
  reviewer: null,
  choices: [{ id: "fixture-a", name: "Reviewer fixture" }],
  history: [],
  page: 1,
  hasMore: false,
};
beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});
describe("local assignment controls", () => {
  it("focuses specific validation and sends only explicit safe mutation fields", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ revision: 1, replayed: false })),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<AssignmentForm detail={detail} />);
    await user.click(
      await screen.findByRole("button", { name: "Record local assignment" }),
    );
    expect(screen.getByLabelText("Reviewer fixture")).toHaveFocus();
    expect(screen.getByText("Choose a reviewer.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    await user.selectOptions(
      screen.getByLabelText("Reviewer fixture"),
      "fixture-a",
    );
    await user.click(
      screen.getByRole("button", { name: "Record local assignment" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toEqual({
      revision: 0,
      reviewerId: "fixture-a",
      kind: "assign",
      requestKey: expect.any(String),
    });
    expect(screen.getByRole("status")).toHaveFocus();
  });
  it("blocks pending double submits and focuses stale response with native reload recovery", async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <AssignmentForm detail={{ ...detail, assigned: true, revision: 1 }} />,
    );
    await user.selectOptions(
      screen.getByLabelText("Reviewer fixture"),
      "fixture-a",
    );
    await user.selectOptions(screen.getByLabelText("Local action"), "escalate");
    await user.click(
      screen.getByRole("button", { name: "Record local assignment" }),
    );
    const pending = screen.getByRole("button", {
      name: "Recording assignment…",
    });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(fetch).toHaveBeenCalledOnce();
    release(
      new Response(
        JSON.stringify({
          message:
            "This case or request changed. Reload the case before starting another assignment.",
        }),
        { status: 409 },
      ),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(
      screen.getByRole("button", { name: "Record local assignment" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Reload assignment" }),
    ).toHaveAttribute("href", `/admin/support/dispatch/${detail.id}`);
  });
  it("unknown outcome locks further mutations and directs current-state reload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const user = userEvent.setup();
    render(<AssignmentForm detail={detail} />);
    await user.selectOptions(
      screen.getByLabelText("Reviewer fixture"),
      "fixture-a",
    );
    await user.click(
      screen.getByRole("button", { name: "Record local assignment" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent("could not confirm");
    expect(
      screen.getByRole("button", { name: "Record local assignment" }),
    ).toBeDisabled();
  });
  it("closed and empty-choice cases show real enabling conditions without mutation controls", () => {
    const rendered = render(
      <AssignmentForm detail={{ ...detail, status: "closed" }} />,
    );
    expect(screen.getByText(/authorized reviewer must reopen/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    rendered.rerender(<AssignmentForm detail={{ ...detail, choices: [] }} />);
    expect(screen.getByText(/No eligible alternative reviewer/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("retains focused acknowledgement when refreshed choices are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 1 }))),
    );
    const user = userEvent.setup(),
      rendered = render(<AssignmentForm detail={detail} />);
    await user.selectOptions(
      screen.getByLabelText("Reviewer fixture"),
      "fixture-a",
    );
    await user.click(
      screen.getByRole("button", { name: "Record local assignment" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    rendered.rerender(
      <AssignmentForm
        detail={{ ...detail, choices: [], revision: 1, assigned: true }}
      />,
    );
    expect(screen.getByRole("status")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Local assignment recorded",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
