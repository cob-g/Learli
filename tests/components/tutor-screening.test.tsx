// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import {
  ScreeningForm,
  ScreeningRequest,
} from "@/features/tutor-screening/forms";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const roots: Root[] = [];
afterEach(async () => {
  cleanup();
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document
    .querySelectorAll("[data-screening-hydration-test]")
    .forEach((container) => container.remove());
  vi.restoreAllMocks();
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
  fireEvent.change(screen.getByLabelText("Checked at"), {
    target: { value: "2026-10-12T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Expires at"), {
    target: { value: "2026-10-13T12:00" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Current evidence is required.",
    ),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(fetch).toHaveBeenCalledOnce();
  expect(screen.getAllByText("Synthetic check a")[0]).toBeVisible();
  expect(screen.getByText("Not recorded")).toBeVisible();
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
    expect(screen.getAllByText("Synthetic check a")[0]).toBeVisible();
    expect(screen.getByText("Not recorded")).toBeVisible();
  },
);

it.each(modes)(
  "$name converts local picker values to UTC and omits editable evidence metadata",
  async ({ props, success }) => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ScreeningForm tutorId={tutorId} detail={detail} {...props} />);
    expect(
      screen.queryByLabelText("Evidence reference"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Checked at")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("Expires at")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    fireEvent.change(screen.getByLabelText("Checked at"), {
      target: { value: "2026-10-12T12:00" },
    });
    fireEvent.change(screen.getByLabelText("Expires at"), {
      target: { value: "2026-10-13T12:00" },
    });
    const checkedAt = new Date(2026, 9, 12, 12, 0).toISOString();
    const expiresAt = new Date(2026, 9, 13, 12, 0).toISOString();
    expect(screen.getByText(`Stored as ${checkedAt} UTC.`)).toBeVisible();
    expect(screen.getByText(`Stored as ${expiresAt} UTC.`)).toBeVisible();
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
      checkedAt,
      expiresAt,
      revision: 7,
      requestKey: expect.any(String),
    });
  },
);

it("uses human check labels and truthful receipt states", async () => {
  render(
    <ScreeningForm
      tutorId={tutorId}
      privateWorkflow
      localWorkflow
      detail={{
        state: "pending",
        round: 1,
        revision: 4,
        requiredCodes: [
          "identity",
          "eligibility",
          "expired_check",
          "failed_check",
          "revoked_check",
        ],
        checks: [
          {
            code: "identity",
            outcome: "passed",
            current: true,
            checkedAt: "2026-10-12T12:00:00.000Z",
            expiresAt: "2026-11-12T12:00:00.000Z",
            receiptReference: `screening:${tutorId}`,
          },
          { code: "expired_check", outcome: "passed", current: false },
          { code: "failed_check", outcome: "failed", current: false },
          { code: "revoked_check", outcome: "revoked", current: false },
        ],
      }}
    />,
  );
  expect(screen.getAllByText("Identity check")[0]).toBeVisible();
  expect(screen.getAllByText("Eligibility check")[0]).toBeVisible();
  for (const state of [
    "Passed and current",
    "Not recorded",
    "Expired",
    "Failed",
    "Revoked",
  ])
    expect(screen.getAllByText(state)[0]).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "1 of 5 required checks current",
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Next: record the eligibility check.",
  );
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === `Screening receipt: screening:${tutorId}`,
    ),
  ).toBeVisible();
  await waitFor(() =>
    expect(screen.getByText(/Times entered here use/)).toHaveTextContent(
      /Learli converts them to UTC/,
    ),
  );
});

it("renders receipt timestamps in explicit UTC before hydration", () => {
  const markup = renderToStaticMarkup(
    <ScreeningForm
      tutorId={tutorId}
      privateWorkflow
      localWorkflow
      detail={{
        state: "pending",
        round: 1,
        revision: 4,
        requiredCodes: ["identity"],
        checks: [
          {
            code: "identity",
            outcome: "passed",
            current: true,
            checkedAt: "2026-10-12T12:00:00.000Z",
            expiresAt: "2026-11-12T12:00:00.000Z",
            receiptReference: `screening:${tutorId}`,
          },
        ],
      }}
    />,
  );
  expect(markup).toContain(
    "Oct 12, 2026, 12:00 PM UTC (2026-10-12T12:00:00.000Z UTC)",
  );
  expect(markup).toContain(
    "Nov 12, 2026, 12:00 PM UTC (2026-11-12T12:00:00.000Z UTC)",
  );
  expect(markup).not.toContain("device local time");
});

it("hydrates UTC receipt markup without a mismatch before showing the browser IANA zone", async () => {
  const nativeResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return {
        ...nativeResolvedOptions.call(this),
        timeZone: "Asia/Manila",
      };
    },
  );
  const node = (
    <ScreeningForm
      tutorId={tutorId}
      privateWorkflow
      localWorkflow
      detail={{
        state: "pending",
        round: 1,
        revision: 4,
        requiredCodes: ["identity"],
        checks: [
          {
            code: "identity",
            outcome: "passed",
            current: true,
            checkedAt: "2026-10-12T12:00:00.000Z",
            expiresAt: "2026-11-12T12:00:00.000Z",
            receiptReference: `screening:${tutorId}`,
          },
        ],
      }}
    />
  );
  const container = document.createElement("div");
  container.setAttribute("data-screening-hydration-test", "");
  container.innerHTML = renderToString(node);
  document.body.append(container);
  const view = within(container);
  const checkedLine = () =>
    view.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent?.startsWith("Checked:") === true,
    );

  expect(checkedLine()).toHaveTextContent(
    "Checked: Oct 12, 2026, 12:00 PM UTC (2026-10-12T12:00:00.000Z UTC)",
  );
  expect(view.getByText(/Times entered here use/)).toHaveTextContent(
    "Times entered here use UTC.",
  );

  const onRecoverableError = vi.fn();
  await act(async () => {
    roots.push(hydrateRoot(container, node, { onRecoverableError }));
  });

  expect(onRecoverableError).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(view.getByText(/Times entered here use/)).toHaveTextContent(
      "Times entered here use Asia/Manila.",
    ),
  );
  expect(checkedLine()).toHaveTextContent(
    "Checked: Oct 12, 2026, 8:00 PM Asia/Manila (2026-10-12T12:00:00.000Z UTC)",
  );
  expect(onRecoverableError).not.toHaveBeenCalled();
});

it("rejects a future check time and focuses the explanation", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ScreeningForm tutorId={tutorId} detail={detail} />);
  fireEvent.change(screen.getByLabelText("Checked at"), {
    target: { value: "2999-10-13T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Expires at"), {
    target: { value: "2999-10-14T12:00" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose a check time that is not in the future.",
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
});

it("rejects an expiry before the checked time and focuses the explanation", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ScreeningForm tutorId={tutorId} detail={detail} />);
  fireEvent.change(screen.getByLabelText("Checked at"), {
    target: { value: "2026-10-13T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Expires at"), {
    target: { value: "2026-10-12T12:00" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose an expiry after the check time.",
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
});

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
