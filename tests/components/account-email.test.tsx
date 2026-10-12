// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EmailForm } from "@/features/account-email/email-form";
afterEach(() => vi.unstubAllGlobals());
it("keeps current email unchanged while pending, clears codes and focuses safe status", async () => {
  const fetch = vi.fn(async () => Response.json({ status: true }));
  vi.stubGlobal("fetch", fetch);
  render(<EmailForm currentEmail="old@learli.test" />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Send current-address code" }),
  );
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  await user.type(screen.getByLabelText("New test email"), "new@learli.test");
  await user.type(screen.getByLabelText("Current-address code"), "123456");
  await user.click(
    screen.getByRole("button", { name: "Confirm current address" }),
  );
  expect(screen.getByText("Current email: old@learli.test")).toBeVisible();
  expect(
    await screen.findByText("Pending new email: new@learli.test"),
  ).toBeVisible();
  expect(screen.getByLabelText("New-address code")).toHaveValue("");
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  expect(fetch.mock.calls.length).toBe(2);
  await user.click(
    screen.getByRole("button", { name: "Restart confirmation" }),
  );
  expect(screen.queryByText(/Pending new email/)).not.toBeInTheDocument();
});
it("blocks malformed input and locks an uncertain mutation with native recovery links", async () => {
  const fetch = vi.fn(async () => Response.json({ status: true }));
  vi.stubGlobal("fetch", fetch);
  render(<EmailForm currentEmail="old@learli.test" />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Send current-address code" }),
  );
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  await user.click(
    screen.getByRole("button", { name: "Confirm current address" }),
  );
  expect(screen.getByLabelText("New test email")).toHaveAccessibleDescription(
    "Enter a synthetic .test email address.",
  );
  expect(
    screen.getByLabelText("Current-address code"),
  ).toHaveAccessibleDescription("Enter the six-digit current-address code.");
  expect(fetch.mock.calls.length).toBe(1);
  await waitFor(() =>
    expect(screen.getByLabelText("New test email")).toHaveFocus(),
  );
  await user.type(screen.getByLabelText("New test email"), "new@learli.test");
  await user.type(screen.getByLabelText("Current-address code"), "123456");
  fetch.mockImplementation(async () =>
    Response.json(
      { code: "CHANGE_UNCERTAIN", message: "unsafe provider details" },
      { status: 503 },
    ),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirm current address" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "may already have changed",
  );
  expect(screen.queryByText("unsafe provider details")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Confirm current address" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Restart confirmation" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Current-address code")).toHaveValue("");
  expect(
    screen.getByRole("link", { name: "Manage account sessions" }),
  ).toHaveAttribute("href", "/account/sessions");
});

it.each([
  {
    name: "email only",
    address: "not-an-address",
    proof: "123456",
    emailInvalid: true,
    codeInvalid: false,
  },
  {
    name: "code only",
    address: "new@learli.test",
    proof: "bad",
    emailInvalid: false,
    codeInvalid: true,
  },
  {
    name: "both fields",
    address: "not-an-address",
    proof: "",
    emailInvalid: true,
    codeInvalid: true,
  },
])(
  "associates $name errors and focuses the first invalid control without a request",
  async ({ address, proof, emailInvalid, codeInvalid }) => {
    const fetch = vi.fn(async () => Response.json({ status: true }));
    vi.stubGlobal("fetch", fetch);
    render(<EmailForm currentEmail="old@learli.test" />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Send current-address code" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    const email = screen.getByLabelText("New test email");
    const code = screen.getByLabelText("Current-address code");
    await user.type(email, address);
    if (proof) await user.type(code, proof);
    await user.click(
      screen.getByRole("button", { name: "Confirm current address" }),
    );
    await waitFor(() => expect(emailInvalid ? email : code).toHaveFocus());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(email).toHaveValue(address);
    expect(email).toHaveAttribute("aria-invalid", String(emailInvalid));
    expect(code).toHaveAttribute("aria-invalid", String(codeInvalid));
    if (emailInvalid) {
      expect(email).toHaveAttribute("aria-describedby", "email-new-error");
      expect(email).toHaveAccessibleDescription(
        "Enter a synthetic .test email address.",
      );
    } else expect(email).not.toHaveAttribute("aria-describedby");
    if (codeInvalid) {
      expect(code).toHaveAttribute("aria-describedby", "email-code-error");
      expect(code).toHaveAccessibleDescription(
        "Enter the six-digit current-address code.",
      );
    } else expect(code).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    if (emailInvalid) {
      await user.clear(email);
      await user.type(email, "new@learli.test");
      expect(email).toHaveAttribute("aria-invalid", "false");
      expect(email).not.toHaveAttribute("aria-describedby");
      expect(
        screen.queryByText("Enter a synthetic .test email address."),
      ).not.toBeInTheDocument();
      if (codeInvalid) expect(code).toHaveAttribute("aria-invalid", "true");
    }
    if (codeInvalid) {
      await user.clear(code);
      await user.type(code, "123456");
      expect(code).toHaveAttribute("aria-invalid", "false");
      expect(code).not.toHaveAttribute("aria-describedby");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Confirm current address" }),
    );
    expect(await screen.findByLabelText("New-address code")).toHaveValue("");
    expect(screen.getByLabelText("New-address code")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByLabelText("New-address code")).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Enter the six-digit/)).not.toBeInTheDocument();
  },
);

it.each(["", "bad"])(
  "handles malformed new-address proof with inline correction and safe operation recovery",
  async (proof) => {
    const fetch = vi.fn(async () => Response.json({ status: true }));
    vi.stubGlobal("fetch", fetch);
    render(<EmailForm currentEmail="old@learli.test" />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Send current-address code" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    await user.type(screen.getByLabelText("New test email"), "new@learli.test");
    await user.type(screen.getByLabelText("Current-address code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Confirm current address" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    const code = screen.getByLabelText("New-address code");
    if (proof) await user.type(code, proof);
    await user.click(
      screen.getByRole("button", { name: "Confirm new address" }),
    );
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAttribute("aria-describedby", "email-code-error");
    expect(code).toHaveAccessibleDescription(
      "Enter the six-digit new-address code.",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText("Pending new email: new@learli.test"),
    ).toBeVisible();
    await user.clear(code);
    await user.type(code, "123456");
    expect(code).not.toHaveAttribute("aria-describedby");
    fetch.mockImplementation(async () =>
      Response.json({ message: "unsafe provider details" }, { status: 400 }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm new address" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent("Confirmation refused");
    expect(
      screen.queryByText("unsafe provider details"),
    ).not.toBeInTheDocument();
    expect(code).toHaveValue("");
    expect(code).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.queryByText("Enter the six-digit new-address code."),
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  },
);

it("clears field errors on restart and keeps valid sends pending until the response", async () => {
  const fetch = vi.fn(async () => Response.json({ status: true }));
  vi.stubGlobal("fetch", fetch);
  render(<EmailForm currentEmail="old@learli.test" />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Send current-address code" }),
  );
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  await user.click(
    screen.getByRole("button", { name: "Confirm current address" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("New test email")).toHaveFocus(),
  );
  await user.click(
    screen.getByRole("button", { name: "Restart confirmation" }),
  );
  expect(screen.queryByText(/Enter the six-digit/)).not.toBeInTheDocument();
  expect(
    screen.queryByText("Enter a synthetic .test email address."),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Send current-address code" }),
  );
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  expect(screen.getByLabelText("New test email")).toHaveValue("");
  expect(screen.getByLabelText("New test email")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await user.type(screen.getByLabelText("New test email"), "new@learli.test");
  await user.type(screen.getByLabelText("Current-address code"), "123456");
  let finish!: (response: Response) => void;
  fetch.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirm current address" }),
  );
  expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Checking email confirmation.",
  );
  expect(screen.getByLabelText("Current-address code")).toHaveValue("");
  expect(screen.queryByText(/Pending new email/)).not.toBeInTheDocument();
  finish(Response.json({ status: true }));
  await waitFor(() =>
    expect(screen.getByLabelText("New-address code")).toBeEnabled(),
  );
  await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "Confirm new address" }));
  await waitFor(() =>
    expect(screen.getByLabelText("New-address code")).toHaveFocus(),
  );
  await user.click(
    screen.getByRole("button", { name: "Restart confirmation" }),
  );
  expect(screen.queryByText(/Enter the six-digit/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Pending new email/)).not.toBeInTheDocument();
});

it.each([
  { name: "success", status: 200, role: "status" },
  { name: "refusal", status: 400, role: "alert" },
  { name: "uncertainty", status: 503, role: "alert" },
])(
  "focuses a fast $name result when a frame precedes its render",
  async ({ status, role }) => {
    // Model an available frame while React is still batching async response work.
    // A frame callback must not be the only chance to focus the rendered result.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now()));
      return 1;
    });
    const fetch = vi.fn(async () => Response.json({}, { status }));
    vi.stubGlobal("fetch", fetch);
    render(<EmailForm currentEmail="old@learli.test" />);
    const submit = screen.getByRole("button", {
      name: "Send current-address code",
    });
    submit.focus();
    await act(async () => {
      fireEvent.submit(submit.closest("form")!);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole(role)).toHaveFocus();
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
