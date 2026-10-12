// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubjectNameForm } from "@/features/subjects/subject-name-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const subject = {
  id: "0b0e7a52-6f0e-4b63-9d43-6d1f3d2a9c11",
  name: "Statistics",
  nameRevision: 3,
};
afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});
async function edit() {
  render(<SubjectNameForm subject={subject} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Edit name"));
  const field = screen.getByLabelText("Display name");
  await user.clear(field);
  return { user, field };
}
describe("specialized subject name editor", () => {
  it("focuses and associates invalid input without requesting a mutation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { user, field } = await edit();
    await user.type(field, "<script>");
    await user.click(screen.getByRole("button", { name: "Save subject name" }));
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(/2 to 60/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends only normalized name/revision and uses returned revision for a second save", async () => {
    const fetch = vi.fn<
      (url: string, options: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({ name: "Applied Statistics", nameRevision: 4 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { user, field } = await edit();
    await user.type(field, "  Applied Statistics  ");
    await user.click(screen.getByRole("button", { name: "Save subject name" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Subject name saved.",
      ),
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({
      name: "Applied Statistics",
      expectedRevision: 3,
    });
    expect(field).toHaveValue("Applied Statistics");
    await user.click(screen.getByRole("button", { name: "Save subject name" }));
    expect(
      JSON.parse(String(fetch.mock.calls[1][1].body)).expectedRevision,
    ).toBe(4);
    expect(refresh).toHaveBeenCalled();
  });
  it("retains correction and provides native reload on stale failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            message:
              "This subject changed. Reload the current name and try again.",
          },
          { status: 409 },
        ),
      ),
    );
    const { user, field } = await edit();
    await user.type(field, "Applied Statistics");
    await user.click(screen.getByRole("button", { name: "Save subject name" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(field).toHaveValue("Applied Statistics");
    expect(
      screen.getByRole("link", { name: "Reload current name" }),
    ).toHaveAttribute("href", "/admin/subjects");
  });
  it("bounds repeated submission and reports uncertain network outcome truthfully", async () => {
    let fail: (reason: Error) => void = () => {};
    const fetch = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const { user, field } = await edit();
    await user.type(field, "Applied Statistics");
    await user.click(screen.getByRole("button", { name: "Save subject name" }));
    const saving = screen.getByRole("button", { name: "Saving name…" });
    expect(saving).toHaveAttribute("aria-disabled", "true");
    await user.click(saving);
    expect(fetch).toHaveBeenCalledTimes(1);
    fail(new Error("offline"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("couldn't confirm"),
    );
    expect(field).toHaveValue("Applied Statistics");
  });
  it("server HTML disables edits and uses POST rather than placing names in a URL", () => {
    const html = renderToString(<SubjectNameForm subject={subject} />);
    expect(html).toContain('method="post"');
    expect(html).toContain("Enable JavaScript to edit subject names.");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("?name=");
  });
});
