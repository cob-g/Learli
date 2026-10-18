// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScreeningForm,
  ScreeningRequest,
} from "@/features/tutor-screening/forms";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps a failed check visible and focuses the server denial without approving", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: "Current evidence is required." }),
  });
  vi.stubGlobal("fetch", fetch);
  render(
    <ScreeningForm
      tutorId="00000000-0000-4000-8000-000000000001"
      detail={{
        state: "pending",
        round: 1,
        revision: 0,
        requiredCodes: ["synthetic_check_a"],
        checks: [],
      }}
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Evidence reference"),
    "screening:00000000-0000-4000-8000-000000000001",
  );
  await userEvent.type(
    screen.getByLabelText("Checked at (UTC ISO date)"),
    "2026-10-12T12:00:00Z",
  );
  await userEvent.type(
    screen.getByLabelText("Expires at (UTC ISO date)"),
    "2026-10-13T12:00:00Z",
  );
  await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Current evidence is required.",
    ),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(fetch).toHaveBeenCalledOnce();
  expect(screen.getByText("synthetic_check_a: Missing evidence")).toBeVisible();
});

const tutorId = "00000000-0000-4000-8000-000000000001";
const detail = {
  state: "pending" as const,
  round: 1,
  revision: 7,
  requiredCodes: ["synthetic_check_a"],
  checks: [],
};
const modes = [
  {
    name: "private workflow",
    props: { privateWorkflow: true },
    heading: "Tutor screening",
    approve: "Approve screening",
    reinstate: "Reinstate screening",
    dialog: "Change screening?",
    success: "Screening record saved.",
    evidence:
      "These checks use fictional evidence. No actual person or document has been screened.",
    request: "Request screening",
    helper:
      "Request screening for this application. Your assigned reviewer must check the required evidence before approval.",
    noscript: "Enable JavaScript to request screening.",
  },
  {
    name: "default workflow",
    props: {},
    heading: "Synthetic screening exercise",
    approve: "Approve synthetic screening",
    reinstate: "Reinstate synthetic screening",
    dialog: "Change synthetic screening?",
    success: "Synthetic screening record saved.",
    evidence:
      "These fictional checks exercise software. No actual person or document has been screened.",
    request: "Request synthetic screening",
    helper:
      "Request fictional readiness screening for this application. This is not approval for real tutoring.",
    noscript: "Enable JavaScript to request synthetic screening.",
  },
];

it.each(modes)(
  "$name retains confirmation and server denial for screening decisions",
  async ({ props, heading, approve, reinstate, dialog: title, evidence }) => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Current evidence is required." }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ScreeningForm tutorId={tutorId} detail={detail} {...props} />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByText(evidence)).toBeVisible();
    expect(screen.getByRole("button", { name: reinstate })).toBeEnabled();

    const dialog = screen.getByRole("dialog", { hidden: true });
    Object.assign(dialog, {
      showModal: () => dialog.setAttribute("open", ""),
      close: () => dialog.removeAttribute("open"),
    });
    await userEvent.click(screen.getByRole("button", { name: approve }));
    expect(screen.getByRole("dialog", { name: title })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm screening decision" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Current evidence is required.",
      ),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(
      `/api/admin/tutor-applications/${tutorId}/screening/decision`,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      action: "approve",
      revision: 7,
      requestKey: expect.any(String),
    });
    expect(
      screen.getByText("State: pending. Round 1. Revision 7."),
    ).toBeVisible();
    expect(
      screen.getByText("synthetic_check_a: Missing evidence"),
    ).toBeVisible();
  },
);

it.each(modes)(
  "$name reports a saved check without changing evidence metadata",
  async ({ props, success }) => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ScreeningForm tutorId={tutorId} detail={detail} {...props} />);
    fireEvent.change(screen.getByLabelText("Evidence reference"), {
      target: { value: `screening:${tutorId}` },
    });
    fireEvent.change(screen.getByLabelText("Checked at (UTC ISO date)"), {
      target: { value: "2026-10-12T12:00:00Z" },
    });
    fireEvent.change(screen.getByLabelText("Expires at (UTC ISO date)"), {
      target: { value: "2026-10-13T12:00:00Z" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Record check" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(success),
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(
      `/api/admin/tutor-applications/${tutorId}/screening/checks`,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      code: "synthetic_check_a",
      outcome: "passed",
      reference: `screening:${tutorId}`,
      checkedAt: "2026-10-12T12:00:00Z",
      expiresAt: "2026-10-13T12:00:00Z",
      revision: 7,
      requestKey: expect.any(String),
    });
  },
);

it.each(modes)(
  "$name explains screening and preserves a refused request for retry",
  async ({ props, request, helper, noscript }) => {
    expect(
      renderToStaticMarkup(<ScreeningRequest tutorId={tutorId} {...props} />),
    ).toContain(noscript);
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Current screening policy is required." }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ScreeningRequest tutorId={tutorId} {...props} />);
    expect(screen.getByText(helper)).toBeVisible();
    const button = screen.getByRole("button", { name: request });
    await userEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Current screening policy is required.",
      ),
    );
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[0][0]).toBe(`/api/tutor/screening/${tutorId}`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      requestKey: expect.any(String),
    });
    expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
  },
);
