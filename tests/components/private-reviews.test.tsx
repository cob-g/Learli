// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ReviewForm } from "@/features/private-reviews/form";
import { ReviewView } from "@/features/private-reviews/presentation";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("private review forms and safe rendering", () => {
  it("renders submitted markup as text and always-private state", () => {
    render(
      <ReviewView
        review={{
          id: "a",
          rating: 5,
          comment: "<img src=x onerror=evil()>",
          state: "locally_approved",
          revision: 1,
          history: [],
        }}
      />,
    );
    expect(screen.getByText("<img src=x onerror=evil()>")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Locally approved · private")).toBeTruthy();
  });
  it("keeps POST fallback, labelled controls and safe uncertain retry identity", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("private"));
    vi.stubGlobal("fetch", fetch);
    render(<ReviewForm bookingId="test" revision={0} />);
    const button = screen.getByRole("button", {
      name: "Save private synthetic review",
    });
    const form = button.closest("form")!;
    expect(form.method).toBe("post");
    fireEvent.change(screen.getByLabelText("Rating from 1 to 5"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText(/Comment/), {
      target: { value: "Synthetic text" },
    });
    fireEvent.submit(form);
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("alert")),
    );
    fireEvent.submit(form);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      JSON.parse(fetch.mock.calls[1][1].body),
    );
    expect(window.location.search).toBe("");
  });
  it("reconsideration offers pending without direct decision flip", () => {
    render(
      <ReviewForm reviewId="test" revision={1} state="locally_approved" />,
    );
    expect(
      screen.getAllByRole("option").map((e) => e.getAttribute("value")),
    ).toEqual(["pending"]);
  });
});
