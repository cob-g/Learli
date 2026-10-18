// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { LearnerForm } from "@/features/learners/learner-form";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateLearnerForm } from "@/features/learners/create-learner-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const requestId = "d52554e9-9a15-460b-8517-6a92b0779478";
const id = "2b24b843-4e86-4c46-bcd5-1c67f159a37c";
const props = {
  requestId,
  modes: ["guardian" as const],
  timezone: "UTC",
  zones: [{ value: "UTC", label: "UTC (GMT)" }],
};
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Display name"), "Synthetic learner");
  await user.selectOptions(screen.getByLabelText("Level"), "elementary");
  return user;
}
describe("local learner creation form", () => {
  it("reuses the uncertain request id after a reload and clears it on success", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ id }))
      .mockResolvedValueOnce(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    const first = render(<CreateLearnerForm {...props} />);
    const user = await fill();
    await user.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    first.unmount();
    const reloadedId = "11111111-1111-4111-8111-111111111111";
    const second = render(
      <CreateLearnerForm {...props} requestId={reloadedId} />,
    );
    const again = await fill();
    await again.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(requestId);
    second.unmount();
    render(<CreateLearnerForm {...props} requestId={reloadedId} />);
    const third = await fill();
    await third.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetch.mock.calls[2][1].body).requestId).toBe(reloadedId);
  });
  it("uses a fresh id when the fields changed after an uncertain attempt", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    const first = render(<CreateLearnerForm {...props} />);
    const user = await fill();
    await user.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    first.unmount();
    const freshId = "22222222-2222-4222-8222-222222222222";
    render(<CreateLearnerForm {...props} requestId={freshId} />);
    const again = userEvent.setup();
    await again.type(screen.getByLabelText("Display name"), "Someone else");
    await again.selectOptions(screen.getByLabelText("Level"), "elementary");
    await again.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(freshId);
  });
  it("retains input and request identity after network uncertainty and focuses completion", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    render(<CreateLearnerForm {...props} />);
    const user = await fill();
    await user.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByLabelText("Display name")).toHaveValue(
      "Synthetic learner",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry this request" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(
      fetch.mock.calls.map((call) => JSON.parse(call[1].body).requestId),
    ).toEqual([requestId, requestId]);
    expect(
      screen.getByRole("link", { name: "Edit local profile" }),
    ).toHaveAttribute("href", `/learners/${id}`);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("announces server validation and focuses first invalid field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            fields: {
              displayName: "Enter a display name.",
              level: "Choose a level.",
            },
          },
          { status: 400 },
        ),
      ),
    );
    render(<CreateLearnerForm {...props} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Display name")).toHaveFocus(),
    );
    expect(screen.getByLabelText("Display name")).toHaveAccessibleDescription(
      "Enter a display name.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Learner could not be created",
    );
  });
  it("blocks duplicate activation while keeping submit focus and pending words", async () => {
    let complete: (value: Response) => void = () => {};
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<CreateLearnerForm {...props} />);
    const user = await fill();
    const button = screen.getByRole("button", { name: "Create local learner" });
    await user.click(button);
    await user.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveTextContent("Creating local learner…");
    expect(button).toHaveFocus();
    complete(Response.json({ id }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  });
  it("offers only self College Support and never a consent/identity field", () => {
    render(<CreateLearnerForm {...props} modes={["self"]} />);
    expect(screen.getByLabelText("Level")).toHaveValue("college_support");
    expect(
      screen
        .getByRole("combobox", { name: "Level" })
        .querySelectorAll("option"),
    ).toHaveLength(1);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

it("SSR create/edit forms cannot fall back to private GET submission", () => {
  const profile = {
    id,
    displayName: "Synthetic SSR learner",
    management: "guardian" as const,
    level: "elementary" as const,
    grade: null,
    timezone: "UTC",
  };
  for (const markup of [
    renderToString(<CreateLearnerForm {...props} />),
    renderToString(<LearnerForm profile={profile} zones={props.zones} />),
  ]) {
    const document = new DOMParser().parseFromString(markup, "text/html");
    expect(document.querySelector("form")?.getAttribute("method")).toBe("post");
    for (const control of document.querySelectorAll("input, select, button"))
      expect(control.hasAttribute("disabled")).toBe(true);
    expect(markup).toContain("JavaScript is required");
  }
});

describe("optional guardian grade metadata", () => {
  it("saves Grade 8 with parent labels and links, retaining duplicate protection", async () => {
    let complete!: (value: Response) => void;
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<CreateLearnerForm {...props} parentChildFlow />);
    const user = await fill();
    await user.selectOptions(screen.getByLabelText("Grade (optional)"), "8");
    await user.dblClick(
      screen.getByRole("button", { name: "Save child profile" }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      management: "guardian",
      level: "elementary",
      grade: 8,
    });
    complete(Response.json({ id }));
    await screen.findByText("Child profile saved for local testing.");
    expect(
      screen.getByRole("link", { name: "Edit child profile" }),
    ).toHaveAttribute("href", `/parent/children/${id}`);
    expect(screen.getByRole("link", { name: "My Children" })).toHaveAttribute(
      "href",
      "/parent/children",
    );
  });
  it("does not expose or submit a school grade for College Support", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    render(<CreateLearnerForm {...props} />);
    const user = await fill();
    await user.selectOptions(screen.getByLabelText("Grade (optional)"), "8");
    await user.selectOptions(screen.getByLabelText("Level"), "college_support");
    expect(screen.queryByLabelText("Grade (optional)")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Create local learner" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      level: "college_support",
      grade: null,
    });
  });
  it("clears a saved grade explicitly and announces grade validation without losing fields", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { fields: { grade: "Choose a school grade from 1 to 12." } },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ id }));
    vi.stubGlobal("fetch", fetch);
    render(
      <LearnerForm
        profile={{
          id,
          displayName: "Fictional child",
          management: "guardian",
          level: "middle_school",
          grade: 8,
          timezone: "UTC",
        }}
        zones={props.zones}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Grade (optional)")).toHaveFocus(),
    );
    expect(
      screen.getByLabelText("Grade (optional)"),
    ).toHaveAccessibleDescription(/Choose a school grade from 1 to 12/);
    expect(screen.getByLabelText("Display name")).toHaveValue(
      "Fictional child",
    );
    await user.selectOptions(screen.getByLabelText("Grade (optional)"), "");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Profile saved");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      grade: null,
    });
  });
});
