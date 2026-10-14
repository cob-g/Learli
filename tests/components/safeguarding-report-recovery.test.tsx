// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SafeguardingReportForm } from "@/features/safeguarding/forms";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const pendingKey = "learli:pending-safeguarding-request";
const savedKey = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});
function fill(subject = "Fictional concern", body = "Fictional details") {
  fireEvent.change(screen.getByLabelText("Report subject"), {
    target: { value: subject },
  });
  fireEvent.change(screen.getByLabelText("Concern"), {
    target: { value: body },
  });
}
function submit() {
  fireEvent.submit(screen.getByLabelText("Concern").closest("form")!);
}
const payload = (fetch: ReturnType<typeof vi.fn>, index: number) =>
  JSON.parse(fetch.mock.calls[index][1].body) as {
    requestKey: string;
    subject: string;
    body: string;
  };
describe("uncertain report recovery without private text storage", () => {
  it("offers a fresh native history read and distinct new-report intent after key-only remount", () => {
    window.sessionStorage.setItem(pendingKey, savedKey);
    render(<SafeguardingReportForm />);
    expect(
      screen.getByRole("link", { name: "Check my reports" }),
    ).toHaveAttribute("href", "/safeguarding/report");
    expect(screen.getByText(/may already be saved/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start a different report" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Retry same report" }),
    ).toBeEnabled();
    expect(window.sessionStorage.getItem(pendingKey)).toBe(savedKey);
  });
  it("starts a new key only after explicit different-report intent; normal retries retain original payload", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Lost response"));
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fill();
    submit();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start a different report" }),
      ).toBeEnabled(),
    );
    const original = payload(fetch, 0);
    fireEvent.click(screen.getByRole("button", { name: "Retry same report" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(payload(fetch, 1)).toEqual(original);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start a different report" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Start a different report" }),
    );
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
    expect(screen.getByLabelText("Concern")).toBeEnabled();
    expect(screen.getByLabelText("Concern")).toHaveValue("");
    fill("Different fictional report", "Different fictional details");
    submit();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    const next = payload(fetch, 2);
    expect(next.requestKey).not.toBe(original.requestKey);
    expect(next.subject).toBe("Different fictional report");
    expect(Object.values(window.sessionStorage).join(" ")).not.toContain(
      "fictional details",
    );
  });
  it("cannot abandon the same request while an uncertain retry is in flight", async () => {
    let reject: (error: Error) => void = () => {};
    const pending = new Promise<Response>((_resolve, r) => {
      reject = r;
    });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Lost response"))
      .mockReturnValueOnce(pending)
      .mockRejectedValue(new Error("Lost again"));
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fill();
    submit();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start a different report" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry same report" }));
    const start = screen.getByRole("button", {
      name: "Start a different report",
    });
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(window.sessionStorage.getItem(pendingKey)).toBe(
      payload(fetch, 0).requestKey,
    );
    expect(screen.getByLabelText("Concern")).toBeDisabled();
    await act(async () => reject(new Error("Lost retry response")));
    expect(start).toBeEnabled();
    submit();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(payload(fetch, 2)).toEqual(payload(fetch, 0));
  });
  it("unlocks a remounted conflicting request only on explicit new-report intent", async () => {
    window.sessionStorage.setItem(pendingKey, savedKey);
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "This key has different fields." },
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<SafeguardingReportForm />);
    fill();
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not confirm/i),
    );
    expect(payload(fetch, 0).requestKey).toBe(savedKey);
    expect(screen.getByLabelText("Concern")).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Start a different report" }),
    );
    expect(screen.getByLabelText("Concern")).toBeEnabled();
    fill("New fictional concern", "New fictional details");
    submit();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(payload(fetch, 1).requestKey).not.toBe(savedKey);
  });
});
