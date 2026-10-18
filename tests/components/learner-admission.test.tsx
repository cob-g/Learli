// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AdmissionForm,
  AdmissionReviewForms,
} from "@/features/learner-admission/forms";
import { randomUUID } from "node:crypto";
const props = {
  requestId: randomUUID(),
  policyVersion: "synthetic-admission-v1",
  policyDigest: "a".repeat(64),
  zones: [{ value: "UTC", label: "UTC" }],
};
afterEach(() => vi.unstubAllGlobals());
describe("private admission forms", () => {
  it("uses private POST and college mode without guardian evidence controls", async () => {
    render(<AdmissionForm {...props} />);
    expect(
      screen
        .getByRole("button", { name: "Request admission review" })
        .closest("form"),
    ).toHaveAttribute("method", "post");
    fireEvent.change(screen.getByLabelText("Request type"), {
      target: { value: "self" },
    });
    expect(screen.queryByLabelText("Learner level")).toBeNull();
    expect(screen.getByText(/no guardian is required/)).toBeVisible();
    expect(
      screen.queryByRole("textbox", {
        name: /email|date of birth|school|address/i,
      }),
    ).toBeNull();
  });
  it("never sends invalid fields and focuses the first correction", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<AdmissionForm {...props} />);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Request admission review" })
        .closest("form")!,
    );
    expect(fetch).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText("Fictional display name")).toHaveFocus(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the learner fields",
    );
  });
  it("stops uncertain retries and offers native current-status recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("synthetic network")),
    );
    render(<AdmissionForm {...props} />);
    fireEvent.change(screen.getByLabelText("Fictional display name"), {
      target: { value: "Fictional learner" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Request admission review" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("uncertain"),
    );
    expect(
      screen.getByRole("button", { name: "Request admission review" }),
    ).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  });
  it("revocation requires an explicit consequence acknowledgment", () => {
    render(
      <AdmissionReviewForms
        admission={{
          id: randomUUID(),
          management: "guardian",
          state: "authorized",
          revision: 4,
          policyVersion: props.policyVersion,
          createdAt: new Date(),
          learner: {
            id: randomUUID(),
            displayName: "Fictional",
            level: "elementary",
            grade: null,
            timezone: "UTC",
            management: "guardian",
          },
          next: null,
          currentAccess: false,
          evidence: [],
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Revoke admission" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: "Revoke admission" }),
    ).toBeEnabled();
  });
  it("saves a guardian Grade 8 request as pending rather than claiming child authorization", async () => {
    const id = randomUUID();
    const fetch = vi.fn().mockResolvedValue(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    render(<AdmissionForm {...props} privateWorkflow parentChildFlow />);
    expect(screen.queryByLabelText("Request type")).toBeNull();
    fireEvent.change(screen.getByLabelText("Learner display name"), {
      target: { value: "Fictional Grade Eight" },
    });
    fireEvent.change(screen.getByLabelText("Learner level"), {
      target: { value: "middle_school" },
    });
    fireEvent.change(screen.getByLabelText("Grade (optional)"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save child request" }));
    await screen.findByRole("heading", { name: "Child request saved" });
    expect(screen.getByRole("status")).toHaveTextContent("Pending review");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      management: "guardian",
      level: "middle_school",
      grade: 8,
    });
    expect(screen.getByRole("link", { name: "My Children" })).toHaveAttribute(
      "href",
      "/parent/children",
    );
    expect(
      screen.getByRole("link", { name: "View saved request" }),
    ).toHaveAttribute("href", `/learner-admission/${id}`);
  });
});
