// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndependentLearnerForm } from "@/features/independent-learner/form";

const requestId = "421c9bd4-dff8-4d29-968a-f97043ae0880";
const learnerId = "f781be2a-08a4-4c70-8be1-508c20c5f00c";
const admissionId = "de371338-782f-4fc4-a305-74ae15b7fe42";
const intake = {
  requestId,
  policyVersion: "local-independent-admission-v2",
  policyDigest: "b".repeat(64),
  noticeVersion: "local-independent-notice-v2",
  timezone: "Asia/Manila",
  zones: [{ value: "Asia/Manila", label: "Asia/Manila" }],
};

function details() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Adult learner" },
  });
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("TextEncoder", TextEncoder);
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("independent College Student setup", () => {
  it("starts unchecked, explains the limit, and sends no caller-selected authority", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          fields: {
            eligibilityDeclared: "Confirm independent eligibility.",
          },
        },
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<IndependentLearnerForm {...intake} />);
    details();
    expect(
      screen.getByRole("checkbox", { name: /I confirm that I am an adult/ }),
    ).not.toBeChecked();
    expect(
      screen.getByText(/does not treat it as verified proof/),
    ).toHaveTextContent("College Support is an education level");
    fireEvent.click(
      screen.getByRole("button", { name: "Create Student profile" }),
    );
    await screen.findByText("Confirm independent eligibility.");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      requestId,
      displayName: "Adult learner",
      timezone: "Asia/Manila",
      policyVersion: intake.policyVersion,
      policyDigest: intake.policyDigest,
      noticeVersion: intake.noticeVersion,
      eligibilityDeclared: false,
    });
    for (const field of [
      "userId",
      "role",
      "source",
      "state",
      "learnerId",
      "level",
    ])
      expect(body).not.toHaveProperty(field);
  });

  it("prevents duplicate activation and exposes booking only after committed authorization", async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const next = "/bookings/new?tutorSlug=maya&subjectSlug=math";
    render(<IndependentLearnerForm {...intake} next={next} />);
    details();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I confirm that I am an adult/ }),
    );
    const button = screen.getByRole("button", {
      name: "Create Student profile",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Creating profile…" }),
    ).toBeDisabled();
    resolve(
      Response.json({
        id: learnerId,
        admissionId,
        state: "authorized",
        verificationStatus: "self_attested_unverified",
        replayed: false,
      }),
    );
    await screen.findByText(/College Student profile created/);
    expect(
      screen.getByRole("link", { name: "Continue to booking" }),
    ).toHaveAttribute("href", next);
    expect(
      screen.getByRole("link", { name: "Student Dashboard" }),
    ).toHaveAttribute("href", "/student");
    expect(screen.queryByText(/admin approval|admission review/i)).toBeNull();
  });

  it("reuses an uncertain request without storing profile or declaration data", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("interrupted"))
      .mockResolvedValueOnce(
        Response.json({
          id: learnerId,
          admissionId,
          state: "authorized",
          verificationStatus: "self_attested_unverified",
          replayed: true,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<IndependentLearnerForm {...intake} />);
    details();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I confirm that I am an adult/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create Student profile" }),
    );
    await screen.findByText(
      /could not confirm whether your profile was created/,
    );
    const stored = window.sessionStorage.getItem(
      "learli:pending-request:independent-learner-v2",
    )!;
    expect(stored).not.toContain("Adult learner");
    expect(stored).not.toContain("eligibility");
    fireEvent.click(
      screen.getByRole("button", { name: "Create Student profile" }),
    );
    await screen.findByText(/College Student profile created/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  });

  it("does not accept a malformed success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          state: "authorized",
          verificationStatus: "self_attested_unverified",
        }),
      ),
    );
    render(<IndependentLearnerForm {...intake} />);
    details();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I confirm that I am an adult/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create Student profile" }),
    );
    await screen.findByText(
      /could not confirm whether your profile was created/,
    );
    expect(screen.queryByText(/profile created/)).toBeNull();
  });
});
