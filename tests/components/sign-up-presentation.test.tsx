// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
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
const client = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: client.signUp } },
}));
import { AuthForm } from "@/features/auth/auth-form";

const roots: Root[] = [];
const origin = "https://staging.example.test";
const displayName = "Fictional signup tester";
const email = "signup-presentation@example.test";
const credential = "Fictional-signup-passphrase";
const pendingBooking = bookingSelectionHref(
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

beforeEach(() => {
  client.signUp.mockReset().mockResolvedValue({ data: {} });
});
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document
    .querySelectorAll("[data-sign-up-hydration-test]")
    .forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

function fillSignup() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: displayName },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: credential },
  });
}

function submitSignup() {
  fireEvent.submit(
    screen.getByRole("button", { name: "Create account" }).closest("form")!,
  );
}

function queuedFocusFrame() {
  const frames: FrameRequestCallback[] = [];
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  return (feedback: HTMLElement) => {
    // Run the requested browser frame after React commits the async feedback.
    expect(feedback).toBeInTheDocument();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    act(() => frames[0](performance.now()));
    expect(feedback).toHaveFocus();
  };
}

async function expectContinuation(destination: string) {
  await waitFor(() => expect(client.signUp).toHaveBeenCalledTimes(1));
  expect(client.signUp).toHaveBeenCalledExactlyOnceWith({
    name: displayName,
    email,
    password: credential,
    callbackURL: `/sign-in?verified=1&next=${encodeURIComponent(destination)}`,
  });
  const callback = new URL(client.signUp.mock.calls[0][0].callbackURL, origin);
  expect(callback.pathname).toBe("/sign-in");
  expect(callback.searchParams.get("verified")).toBe("1");
  expect(callback.searchParams.get("next")).toBe(destination);
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    `/sign-in?next=${encodeURIComponent(destination)}`,
  );
}

describe("reference sign-up presentation", () => {
  it("hydrates the same inert server fields and native account choices without enabling an unhydrated submission", async () => {
    const node = <AuthForm mode="sign-up" presentation="sign-up-reference" />;
    const container = document.createElement("div");
    container.setAttribute("data-sign-up-hydration-test", "");
    container.innerHTML = renderToString(node);
    document.body.append(container);
    const form = container.querySelector("form")!;
    const choices = within(container).getByRole("group", {
      name: "Account type",
    });
    const radios = within(choices).getAllByRole("radio");
    const fields = [
      within(container).getByLabelText("Display name"),
      within(container).getByLabelText("Email"),
      within(container).getByLabelText("Password"),
    ];
    const toggle = within(container).getByRole("button", {
      name: "Show password",
    });
    const submit = within(container).getByRole("button", {
      name: "Create account",
    });

    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/auth/sign-in/email");
    expect(choices).toBeInstanceOf(HTMLFieldSetElement);
    expect(choices.querySelector("legend")).toHaveTextContent("Account type");
    expect(radios).toHaveLength(3);
    for (const [name, value] of [
      ["Choose later", "later"],
      ["Parent or guardian", "parent"],
      ["College Student", "student"],
    ]) {
      const radio = within(choices).getByRole("radio", { name });
      expect(radio).toHaveAttribute("name", "accountType");
      expect(radio).toHaveAttribute("value", value);
      expect(radio).toBeDisabled();
    }
    expect(
      within(choices).getByRole("radio", { name: "Choose later" }),
    ).toBeChecked();
    for (const field of [...fields, toggle, submit])
      expect(field).toBeDisabled();
    expect(fields[0]).toHaveAttribute("autocomplete", "nickname");
    expect(fields[1]).toHaveAttribute("autocomplete", "email");
    expect(fields[2]).toHaveAttribute("autocomplete", "new-password");
    expect(fields[2]).toHaveAttribute("minlength", "12");
    expect(fields[2]).toHaveAttribute("maxlength", "128");
    expect(fields[2]).toHaveAttribute("type", "password");
    expect(container).toHaveTextContent(
      "Enable JavaScript to use account forms here.",
    );

    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, node, { onRecoverableError }));
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBe(form);
    expect(within(container).getByRole("group", { name: "Account type" })).toBe(
      choices,
    );
    expect(within(choices).getAllByRole("radio")).toEqual(radios);
    for (const [index, label] of [
      "Display name",
      "Email",
      "Password",
    ].entries()) {
      expect(within(container).getByLabelText(label)).toBe(fields[index]);
    }
    expect(
      within(container).getByRole("button", { name: "Show password" }),
    ).toBe(toggle);
    for (const control of [...fields, ...radios, toggle, submit])
      expect(control).toBeEnabled();
    expect(container).not.toHaveTextContent(
      "Enable JavaScript to use account forms here.",
    );
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it.each([
    ["Parent or guardian", parentOnboardingHref(pendingBooking)],
    ["College Student", studentOnboardingHref(pendingBooking)],
  ])(
    "inherits %s intent without granting or submitting a role",
    async (choice, next) => {
      render(
        <AuthForm
          mode="sign-up"
          presentation="sign-up-reference"
          next={next}
        />,
      );
      expect(screen.getByRole("radio", { name: choice })).toBeChecked();
      expect(
        screen
          .getAllByRole("radio")
          .filter((radio) => (radio as HTMLInputElement).checked),
      ).toHaveLength(1);
      fillSignup();
      submitSignup();
      await expectContinuation(next);
    },
  );

  it("switches inherited College intent to Parent while preserving the selected tutor and time through verification and help", async () => {
    render(
      <AuthForm
        mode="sign-up"
        presentation="sign-up-reference"
        next={studentOnboardingHref(pendingBooking)}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Parent or guardian" }));
    expect(
      screen.getByRole("radio", { name: "College Student" }),
    ).not.toBeChecked();
    fillSignup();
    submitSignup();
    await expectContinuation(parentOnboardingHref(pendingBooking));
  });

  it("switches inherited Parent intent to College while preserving the selected tutor and time through verification and help", async () => {
    render(
      <AuthForm
        mode="sign-up"
        presentation="sign-up-reference"
        next={parentOnboardingHref(pendingBooking)}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "College Student" }));
    expect(
      screen.getByRole("radio", { name: "Parent or guardian" }),
    ).not.toBeChecked();
    fillSignup();
    submitSignup();
    await expectContinuation(studentOnboardingHref(pendingBooking));
  });

  it("lets Choose later remove inherited College intent while retaining the pending booking and roleless provider payload", async () => {
    render(
      <AuthForm
        mode="sign-up"
        presentation="sign-up-reference"
        next={studentOnboardingHref(pendingBooking)}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Choose later" }));
    fillSignup();
    submitSignup();
    await expectContinuation(pendingBooking);
  });

  it("toggles the same credential field with accessible state while preserving its value across account-choice changes", () => {
    render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.change(password, { target: { value: credential } });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-controls", password.id);
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");

    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName("Hide password");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("radio", { name: "Parent or guardian" }));
    expect(screen.getByLabelText("Password")).toBe(password);
    expect(password).toHaveValue(credential);

    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue(credential);
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it("masks and clears a revealed credential before provider submission, disables pending controls and recovers from a safe refusal", async () => {
    const runFocusFrame = queuedFocusFrame();
    let finish!: (result: { error: { code: string; message: string } }) => void;
    const response = new Promise<{ error: { code: string; message: string } }>(
      (resolve) => {
        finish = resolve;
      },
    );
    client.signUp.mockImplementationOnce(() => {
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
      expect(screen.getByLabelText("Password")).toHaveValue("");
      return response;
    });
    render(
      <AuthForm
        mode="sign-up"
        presentation="sign-up-reference"
        next={pendingBooking}
      />,
    );
    fillSignup();
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    const submit = screen.getByRole("button", { name: "Create account" });
    const form = submit.closest("form")!;
    fireEvent.click(toggle);
    submitSignup();

    await expectContinuation(pendingBooking);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("");
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    for (const control of [
      password,
      toggle,
      submit,
      ...screen.getAllByRole("radio"),
    ])
      expect(control).toBeDisabled();
    expect(submit).toHaveTextContent("Creating account…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      finish({
        error: {
          code: "synthetic-refusal",
          message: "Private provider detail",
        },
      });
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We couldn't confirm that your registration request finished. Try again, or sign in if you already have an account.",
    );
    expect(alert).not.toHaveTextContent("Private provider detail");
    expect(alert).not.toHaveTextContent(credential);
    runFocusFrame(alert);
    expect(form).toHaveAttribute("aria-busy", "false");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("");
    for (const control of [
      password,
      toggle,
      submit,
      ...screen.getAllByRole("radio"),
    ])
      expect(control).toBeEnabled();

    fireEvent.change(password, { target: { value: credential } });
    submitSignup();
    await waitFor(() => expect(client.signUp).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Registration request received.",
    );
    expect(password).toHaveValue("");
  });

  it("keeps credentials cleared and reports a safe focused failure when the account service cannot be reached", async () => {
    const runFocusFrame = queuedFocusFrame();
    client.signUp.mockRejectedValueOnce(new Error("Private connection detail"));
    render(<AuthForm mode="sign-up" presentation="sign-up-reference" />);
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    submitSignup();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We couldn't confirm that your registration request finished. Try again, or sign in if you already have an account.",
    );
    expect(alert).not.toHaveTextContent("Private connection detail");
    expect(alert).not.toHaveTextContent(credential);
    runFocusFrame(alert);
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeEnabled();
    expect(client.signUp).toHaveBeenCalledExactlyOnceWith({
      name: displayName,
      email,
      password: credential,
      callbackURL: "/sign-in?verified=1&next=%2Faccount",
    });
  });
});
