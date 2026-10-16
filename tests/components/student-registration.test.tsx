// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { randomUUID } from "node:crypto";
import { bookingSelectionHref } from "@/features/bookings/selection";
import { studentOnboardingHref } from "@/features/student-onboarding/continuation";
import { parentOnboardingHref } from "@/features/parent-onboarding/continuation";
const client = vi.hoisted(() => ({ signup: vi.fn(), verify: vi.fn() }));
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
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: client.signup },
    sendVerificationEmail: client.verify,
  },
}));
import { AuthForm } from "@/features/auth/auth-form";
import { AdmissionForm } from "@/features/learner-admission/forms";
const next = bookingSelectionHref(
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
  client.signup.mockReset().mockResolvedValue({ data: {} });
  client.verify.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => vi.unstubAllGlobals());
function submitSignup() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Fictional College Student" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "college@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Fictional-college-passphrase" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Create account" }).closest("form")!,
  );
}
describe("College Student signup intent and independent form default", () => {
  it("carries College Student and public selection through verification without sending role or eligibility fields", async () => {
    render(<AuthForm mode="sign-up" next={next} />);
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "student" },
    });
    submitSignup();
    await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
    const payload = client.signup.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "callbackURL",
      "email",
      "name",
      "password",
    ]);
    expect(
      new URL(
        payload.callbackURL,
        "https://staging.example.test",
      ).searchParams.get("next"),
    ).toBe(studentOnboardingHref(next));
    expect(screen.getByRole("option", { name: "College Student" })).toHaveValue(
      "student",
    );
  });
  it.each(["parent", "later"])(
    "unwraps inherited College intent when switching to %s",
    async (choice) => {
      render(<AuthForm mode="sign-up" next={studentOnboardingHref(next)} />);
      expect(screen.getByLabelText("Account type")).toHaveValue("student");
      fireEvent.change(screen.getByLabelText("Account type"), {
        target: { value: choice },
      });
      submitSignup();
      await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
      expect(
        new URL(
          client.signup.mock.calls[0][0].callbackURL,
          "https://staging.example.test",
        ).searchParams.get("next"),
      ).toBe(choice === "parent" ? parentOnboardingHref(next) : next);
    },
  );
  it("preserves selection when switching inherited Parent intent to College Student", async () => {
    render(<AuthForm mode="sign-up" next={parentOnboardingHref(next)} />);
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "student" },
    });
    submitSignup();
    await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
    expect(
      new URL(
        client.signup.mock.calls[0][0].callbackURL,
        "https://staging.example.test",
      ).searchParams.get("next"),
    ).toBe(studentOnboardingHref(next));
  });
  it("retains College intent in hosted verification resend and sign-in helper navigation", async () => {
    render(
      <AuthForm mode="verify" hosted next={studentOnboardingHref(next)} />,
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "college@example.test" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Resend verification" })
        .closest("form")!,
    );
    await waitFor(() => expect(client.verify).toHaveBeenCalledTimes(1));
    const callback = new URL(
      client.verify.mock.calls[0][0].callbackURL,
      "https://staging.example.test",
    );
    expect(callback.searchParams.get("next")).toBe(studentOnboardingHref(next));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(studentOnboardingHref(next))}`,
    );
  });
  it("initializes self admission without guardian/age controls and submits College Support through the existing private POST", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "Synthetic validation response" },
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AdmissionForm
        requestId={randomUUID()}
        policyVersion="synthetic-admission-v1"
        policyDigest={"a".repeat(64)}
        zones={[{ value: "UTC", label: "UTC" }]}
        next={next}
        privateWorkflow
        initialManagement="self"
      />,
    );
    expect(screen.getByLabelText("Request type")).toHaveValue("self");
    expect(screen.queryByLabelText("Learner level")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /guardian|birth|school|address/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Learner display name"), {
      target: { value: "Fictional College learner" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Request admission review" })
        .closest("form")!,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/learner-admission");
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      management: "self",
      level: "college_support",
      next,
    });
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("eligible");
  });
});
