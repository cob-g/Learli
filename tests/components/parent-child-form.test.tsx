// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentChildForm } from "@/features/parent-children/form";

const requestId = "22ce871d-b6ec-41d8-a347-7e41a1cf6e83";
const childId = "604611ea-ef93-430c-851c-d737da272019";
const intake = {
  requestId,
  policyVersion: "local-guardian-admission-v2",
  policyDigest: "a".repeat(64),
  noticeVersion: "local-guardian-notice-v2",
  timezone: "Asia/Manila",
  zones: [{ value: "Asia/Manila", label: "Asia/Manila" }],
};
function details() {
  fireEvent.change(screen.getByLabelText("Child’s display name"), {
    target: { value: "Test Child" },
  });
  fireEvent.change(screen.getByLabelText("Education level"), {
    target: { value: "middle_school" },
  });
  fireEvent.change(screen.getByLabelText("Grade (optional)"), {
    target: { value: "8" },
  });
}
function confirm() {
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent/ }));
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("TextEncoder", TextEncoder);
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("ordinary parent child creation", () => {
  it("requires explicit unchecked declarations and sends no existing-account target", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          fields: {
            guardianConfirmed: "Confirm your guardian authority.",
            consentConfirmed: "Confirm your consent.",
          },
        },
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ParentChildForm {...intake} />);
    details();
    expect(
      screen.getByRole("checkbox", { name: /I confirm/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /I consent/ }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save child profile" }));
    await screen.findByText("Confirm your guardian authority.");
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /I confirm/ })).toHaveFocus(),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      requestId,
      displayName: "Test Child",
      level: "middle_school",
      grade: 8,
      timezone: intake.timezone,
      policyVersion: intake.policyVersion,
      policyDigest: intake.policyDigest,
      noticeVersion: intake.noticeVersion,
      guardianConfirmed: false,
      consentConfirmed: false,
    });
    expect(screen.getByLabelText("Child’s display name")).toHaveValue(
      "Test Child",
    );
  });
  it("saves once during concurrent clicks and offers dashboard/booking access after committed authorization", async () => {
    let resolve!: (r: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const next = "/bookings/new?tutorSlug=test-tutor&subjectSlug=math";
    render(<ParentChildForm {...intake} next={next} />);
    details();
    confirm();
    const button = screen.getByRole("button", { name: "Save child profile" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Saving child profile…" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/Child added successfully/),
    ).not.toBeInTheDocument();
    resolve(
      Response.json({
        id: childId,
        admissionId: requestId,
        state: "authorized",
        replayed: false,
      }),
    );
    await screen.findByText(/Child added successfully/);
    expect(
      screen.queryByRole("button", { name: /Save|Retry/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue to booking" }),
    ).toHaveAttribute("href", next);
    expect(
      screen.getByRole("link", { name: "Parent Dashboard" }),
    ).toHaveAttribute("href", "/parent");
    expect(
      screen.getByRole("link", { name: "Edit child profile" }),
    ).toHaveAttribute("href", `/parent/children/${childId}`);
    expect(
      screen.queryByText(/pending|admin approval|reviewer/i),
    ).not.toBeInTheDocument();
  });
  it("reuses the request across interrupted-response retries without storing child details", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("interrupted"))
      .mockResolvedValueOnce(
        Response.json({
          id: childId,
          admissionId: requestId,
          state: "authorized",
          replayed: true,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<ParentChildForm {...intake} />);
    details();
    confirm();
    fireEvent.click(screen.getByRole("button", { name: "Save child profile" }));
    await screen.findByText(/We could not confirm whether/);
    const stored = window.sessionStorage.getItem(
      "learli:pending-request:parent-child",
    )!;
    expect(stored).not.toContain("Test Child");
    expect(JSON.parse(stored).fingerprint).toMatch(/^[0-9a-f]{64}$/);
    fireEvent.click(screen.getByRole("button", { name: "Retry saving child" }));
    await screen.findByText(/Child added successfully/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(
      window.sessionStorage.getItem("learli:pending-request:parent-child"),
    ).toBeNull();
  });
  it("rejects a malformed success rather than claiming the child was saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ id: childId, state: "pending" })),
    );
    render(<ParentChildForm {...intake} />);
    details();
    confirm();
    fireEvent.click(screen.getByRole("button", { name: "Save child profile" }));
    await screen.findByText(/We could not confirm whether/);
    expect(
      screen.queryByText(/Child added successfully/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Child’s display name")).toHaveValue(
      "Test Child",
    );
  });
});
