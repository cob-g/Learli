// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingSelectionHref } from "@/features/bookings/selection";
import { parentOnboardingHref } from "@/features/parent-onboarding/continuation";
import { studentOnboardingHref } from "@/features/student-onboarding/continuation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
const client = vi.hoisted(() => ({ signup: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: client.signup } },
}));
import { AuthForm } from "@/features/auth/auth-form";

const name = "Fictional registration tester";
const email = "registration@example.test";
const password = "Fictional-registration-passphrase";
const uncertain =
  "We couldn't confirm that your registration request finished. Try again, or sign in if you already have an account.";
let frames: FrameRequestCallback[];

beforeEach(() => {
  client.signup.mockReset().mockResolvedValue({ data: { token: null } });
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function flushFocus() {
  act(() => {
    for (const frame of frames.splice(0)) frame(performance.now());
  });
}

function fill(
  values: { name?: string; email?: string; password?: string } = {},
) {
  for (const [label, value] of [
    ["Display name", values.name ?? name],
    ["Email", values.email ?? email],
    ["Password", values.password ?? password],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  const form = screen
    .getByRole("button", { name: "Create account" })
    .closest("form")!;
  fireEvent.submit(form);
  return form;
}

async function received() {
  const heading = await screen.findByRole("heading", {
    name: "Verify your email",
    level: 2,
  });
  return heading.closest("section")!;
}

describe("registration pending and stable verification receipt", () => {
  it("guards rapid form retries and clears/remasks before one real pending request, then removes fields and focuses the completed receipt", async () => {
    let finish!: (result: { data: { token: null } }) => void;
    client.signup.mockImplementationOnce(() => {
      expect(screen.getByLabelText("Password")).toHaveValue("");
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    const form = submit();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(client.signup).toHaveBeenCalledExactlyOnceWith({
      name,
      email,
      password,
      callbackURL: "/sign-in?verified=1&next=%2Faccount",
    });
    expect(form).toHaveAttribute("aria-busy", "true");
    for (const control of form.querySelectorAll("input,button"))
      expect(control).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Creating account…" }),
    ).toBeDisabled();
    const progress = screen.getByRole("status");
    expect(progress).toHaveTextContent(
      "Your registration request is in progress.",
    );
    expect(form).not.toContainElement(progress);
    expect(progress).toHaveAttribute("aria-live", "polite");

    await act(async () => finish({ data: { token: null } }));
    const panel = await received();
    expect(form).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/request is in progress/),
    ).not.toBeInTheDocument();
    expect(panel.querySelector('[aria-busy="true"]')).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Creating account|Create account/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Registration request received.",
    );
    flushFocus();
    expect(screen.getByRole("status")).toHaveFocus();
    expect(client.signup).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["standard", false],
    ["standard", true],
    ["sign-up-reference", false],
    ["sign-up-reference", true],
  ] as const)(
    "gives truthful %s hosted=%s completion and real recovery destinations",
    async (presentation, hosted) => {
      const storage = vi.spyOn(Storage.prototype, "setItem");
      render(
        <AuthForm
          mode="sign-up"
          presentation={presentation}
          hosted={hosted}
          next="https://untrusted.example/"
        />,
      );
      fill();
      submit();
      const panel = await received();
      expect(panel).toHaveTextContent("For a new account");
      expect(panel).toHaveTextContent("verification link");
      if (hosted) {
        expect(panel).toHaveTextContent(
          "This screen does not confirm email delivery.",
        );
        expect(panel).not.toHaveTextContent(/local test mailbox|captured/);
      } else {
        expect(panel).toHaveTextContent("local test mailbox");
        expect(panel).toHaveTextContent(
          "captured rather than sent to an inbox",
        );
      }
      expect(panel).toHaveTextContent("Already have an account?");
      expect(
        within(panel).getByRole("link", { name: "Sign in" }),
      ).toHaveAttribute("href", "/sign-in?next=%2Faccount");
      expect(
        within(panel).getByRole("link", {
          name: "Request another verification link",
        }),
      ).toHaveAttribute("href", "/verify-email?next=%2Faccount");
      expect(
        within(panel).getByRole("link", { name: "reset your password" }),
      ).toHaveAttribute("href", "/forgot-password");
      for (const link of panel.querySelectorAll("a")) {
        expect(link.href).not.toContain(email);
        expect(link.href).not.toContain(password);
      }
      expect(panel).not.toHaveTextContent(email);
      expect(panel).not.toHaveTextContent(password);
      expect(storage).not.toHaveBeenCalled();
      flushFocus();
      expect(screen.getByRole("status")).toHaveFocus();
    },
  );

  it("renders fresh-shaped and duplicate-shaped provider success identically without inspecting returned user data", async () => {
    const views: string[] = [];
    for (const user of [
      { id: "new-fictional-id", email, emailVerified: false },
      { id: "synthetic-duplicate-id", email, emailVerified: true },
    ]) {
      client.signup.mockResolvedValueOnce({ data: { token: null, user } });
      const view = render(
        <AuthForm mode="sign-up" presentation="sign-up-reference" hosted />,
      );
      fill();
      submit();
      views.push((await received()).innerHTML);
      view.unmount();
    }
    expect(views[0]).toBe(views[1]);
    expect(views[0]).not.toMatch(
      /new-fictional-id|synthetic-duplicate-id|emailVerified/,
    );
  });

  it.each([
    ["Parent or guardian", parentOnboardingHref],
    ["College Student", studentOnboardingHref],
  ] as const)(
    "keeps %s and the complete selected booking through receipt actions and different-email editing",
    async (choice, continuation) => {
      const selection = bookingSelectionHref(
        {
          tutorSlug: "college-science",
          subjectSlug: "science",
          level: "college_support",
          displayTimezone: "Asia/Manila",
          startAtUtc: "2030-10-16T03:00:00.000Z",
          endAtUtc: "2030-10-16T04:00:00.000Z",
        },
        true,
      );
      const next = continuation(selection);
      render(
        <AuthForm
          mode="sign-up"
          presentation="sign-up-reference"
          next={next}
        />,
      );
      fill();
      submit();
      const panel = await received();
      expect(client.signup.mock.calls[0][0]).toEqual({
        name,
        email,
        password,
        callbackURL: `/sign-in?verified=1&next=${encodeURIComponent(next)}`,
      });
      expect(
        within(panel).getByRole("link", { name: "Sign in" }),
      ).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(next)}`);
      expect(
        within(panel).getByRole("link", {
          name: "Request another verification link",
        }),
      ).toHaveAttribute(
        "href",
        `/verify-email?next=${encodeURIComponent(next)}`,
      );
      flushFocus();
      fireEvent.click(
        screen.getByRole("button", { name: "Use a different email" }),
      );
      flushFocus();
      expect(screen.getByLabelText("Email")).toHaveFocus();
      expect(screen.getByLabelText("Email")).toHaveValue("");
      expect(screen.getByLabelText("Display name")).toHaveValue(name);
      expect(screen.getByLabelText("Password")).toHaveValue("");
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
      expect(
        screen.getByRole("button", { name: "Show password" }),
      ).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("radio", { name: choice })).toBeChecked();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fill({ email: "different@example.test" });
      submit();
      await received();
      expect(client.signup.mock.calls[1][0]).toEqual({
        name,
        email: "different@example.test",
        password,
        callbackURL: `/sign-in?verified=1&next=${encodeURIComponent(next)}`,
      });
    },
  );
});

describe("signup correction and safe request failures", () => {
  it.each([
    ["name", "Display name", "", "Enter your display name."],
    ["name", "Display name", "   ", "Enter your display name."],
    ["name", "Display name", "n".repeat(101), "Use 100 characters or fewer"],
    ["email", "Email", "", "Enter a valid email address."],
    ["email", "Email", "invalid-email", "Enter a valid email address."],
    [
      "email",
      "Email",
      "n".repeat(250) + "@example.test",
      "254 characters or fewer",
    ],
    [
      "email",
      "Email",
      "test@example.com",
      "This preview only accepts addresses ending in .test",
    ],
    ["password", "Password", "", "Use 12–128 characters."],
    ["password", "Password", "short", "Use 12–128 characters."],
    ["password", "Password", "p".repeat(129), "Use 12–128 characters."],
  ])(
    "corrects %s before dispatch for %s=%s with field association and focused summary",
    async (field, label, value, instruction) => {
      render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
      fill({ [field]: value });
      const credential = screen.getByLabelText("Password");
      const originalPassword = (credential as HTMLInputElement).value;
      const form = submit();
      expect(client.signup).not.toHaveBeenCalled();
      expect(form).toHaveAttribute("novalidate");
      expect(form).toHaveAttribute("aria-busy", "false");
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-describedby",
        expect.stringContaining(`${field}-error`),
      );
      expect(document.getElementById(`${field}-error`)).toHaveTextContent(
        instruction,
      );
      expect(credential).toHaveValue(originalPassword);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Check the highlighted fields and try again.",
      );
      flushFocus();
      expect(screen.getByRole("alert")).toHaveFocus();
      expect(screen.getByLabelText("Email")).toHaveAttribute("required");
      expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
      expect(screen.getByLabelText("Email")).toHaveAttribute(
        "maxlength",
        "254",
      );
      expect(credential).toHaveAttribute("minlength", "12");
      expect(credential).toHaveAttribute("maxlength", "128");
      expect(credential).toHaveAttribute(
        "aria-describedby",
        expect.stringContaining("password-help"),
      );
      fill();
      submit();
      await received();
      expect(client.signup).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["INVALID_EMAIL", "Email", "Enter a valid email address."],
    ["PASSWORD_TOO_SHORT", "Password", "Use 12–128 characters."],
    ["PASSWORD_TOO_LONG", "Password", "Use 12–128 characters."],
  ])(
    "maps only the known %s provider code to safe correction",
    async (code, label, instruction) => {
      client.signup.mockResolvedValueOnce({
        error: { code, status: 400, message: "Private provider detail" },
      });
      render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
      fill();
      submit();
      const alert = await screen.findByRole("alert");
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(
        expect.stringContaining(instruction),
      );
      expect(alert).not.toHaveTextContent("Private provider detail");
      expect(screen.getByLabelText("Password")).toHaveValue("");
      expect(screen.getByLabelText("Display name")).toHaveValue(name);
      expect(screen.getByLabelText("Email")).toHaveValue(email);
      flushFocus();
      expect(alert).toHaveFocus();
    },
  );

  it.each([
    { status: 400, message: "wrapper without a code" },
    { status: 400, code: "USER_ALREADY_EXISTS", message: "registered address" },
    { status: 403, code: "UNLISTED_ADDRESS", message: "membership detail" },
    { status: 503, code: "INVALID_EMAIL", message: "transport failure" },
    { status: 500, message: "server failure" },
    { code: "UNKNOWN", message: "other refusal" },
  ])(
    "treats $status/$code as uncertain without guessing a field or leaking provider details, and permits retry",
    async (error) => {
      client.signup.mockResolvedValueOnce({
        error: { ...error, detail: password, nested: { email } },
      });
      render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
      fireEvent.click(
        screen.getByRole("radio", { name: "Parent or guardian" }),
      );
      fill();
      fireEvent.click(screen.getByRole("button", { name: "Show password" }));
      const form = submit();
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(uncertain);
      expect(alert).not.toHaveTextContent(error.message);
      expect(alert).not.toHaveTextContent(password);
      expect(alert).not.toHaveTextContent(email);
      expect(form.querySelector('[aria-invalid="true"]')).toBeNull();
      expect(form).toHaveAttribute("aria-busy", "false");
      expect(screen.getByLabelText("Email")).toHaveValue(email);
      expect(screen.getByLabelText("Display name")).toHaveValue(name);
      expect(screen.getByLabelText("Password")).toHaveValue("");
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
      expect(
        screen.getByRole("radio", { name: "Parent or guardian" }),
      ).toBeChecked();
      expect(
        screen.getByRole("link", { name: "Request another verification link" }),
      ).toHaveAttribute("href", "/verify-email?next=%2Fparent%2Fonboarding");
      expect(
        screen.getByRole("link", { name: "Reset your password" }),
      ).toHaveAttribute("href", "/forgot-password");
      flushFocus();
      expect(alert).toHaveFocus();
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: password },
      });
      submit();
      await received();
      expect(client.signup).toHaveBeenCalledTimes(2);
    },
  );

  it("explains rate limits without inventing a retry time", async () => {
    client.signup.mockResolvedValueOnce({
      error: {
        status: 429,
        code: "INVALID_EMAIL",
        message: "wait 123 seconds",
      },
    });
    render(<AuthForm mode="sign-up" />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Too many registration attempts. Wait before trying again",
    );
    expect(alert).not.toHaveTextContent(/123|second|minute|INVALID_EMAIL/);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeEnabled();
  });

  it("recovers from a thrown request without a false rollback promise or retained credential", async () => {
    client.signup.mockRejectedValueOnce(
      new Error(`Private network detail ${password}`),
    );
    render(<AuthForm mode="sign-up" />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(uncertain);
    expect(alert).not.toHaveTextContent(
      /Private network|not created|rolled back/,
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue(email);
    expect(screen.getByLabelText("Display name")).toHaveValue(name);
    flushFocus();
    expect(alert).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: password },
    });
    submit();
    await received();
    expect(client.signup).toHaveBeenCalledTimes(2);
  });
});
