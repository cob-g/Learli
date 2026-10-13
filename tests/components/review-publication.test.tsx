// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicationForm } from "@/features/review-publication/form";
import {
  PublicReviewSection,
  PublicationBookingHandoff,
  PublicationReviewView,
} from "@/features/review-publication/presentation";
afterEach(() => vi.unstubAllGlobals());
describe("publication controls and public allowlist rendering", () => {
  it("hands readiness profiles to current W6 choices with public selections only", () => {
    const html = renderToStaticMarkup(
      <PublicationBookingHandoff slug="fictional-tutor" subjectSlug="math" />,
    );
    expect(html).toContain(
      "/bookings/demo?tutorSlug=fictional-tutor&amp;subjectSlug=math",
    );
    expect(html).toContain("own admitted learner");
    expect(html).not.toContain("learnerId=");
    expect(html).not.toContain("startAtUtc=");
    expect(html).not.toContain("Load open times");
  });
  it("escapes submitted markup and uses anonymous customer/date/rating only", () => {
    const html = renderToStaticMarkup(
      <PublicReviewSection
        result={{
          scope: "synthetic_readiness",
          count: 2,
          average: 3.5,
          reviews: [
            {
              authorLabel: "Customer",
              rating: 4,
              comment: "<script>danger()</script>",
              date: "2026-10-13",
            },
          ],
        }}
      />,
    );
    expect(html).toContain("&lt;script&gt;danger()&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("2 reviews");
    expect(html).toContain("Average 3.5 out of 5");
    expect(html).toContain("Customer");
    expect(html).toContain("October 13, 2026");
  });
  it("never rounds a genuine near-five mean into a displayed perfect rating", () => {
    const html = renderToStaticMarkup(
      <PublicReviewSection
        result={{
          scope: "synthetic_readiness",
          count: 1000,
          average: 4.999,
          reviews: [],
        }}
      />,
    );
    expect(html).toContain("Average 4.999 out of 5");
    expect(html).not.toContain("Average 5 out of 5");
  });
  it("shows truthful empty, absent disabled and distinct failure", () => {
    expect(renderToStaticMarkup(<PublicReviewSection result={null} />)).toBe(
      "",
    );
    expect(
      renderToStaticMarkup(
        <PublicReviewSection
          result={{
            scope: "synthetic_readiness",
            count: 0,
            average: null,
            reviews: [],
          }}
        />,
      ),
    ).toContain("No reviews yet");
    expect(
      renderToStaticMarkup(<PublicReviewSection result={undefined} />),
    ).toContain("couldn&#x27;t load reviews");
  });
  it("inert server POST form explains no-script safety without text in URL", () => {
    const html = renderToStaticMarkup(
      <PublicationForm
        bookingId={randomUUID()}
        bookingRevision={1}
        completionEventId={randomUUID()}
      />,
    );
    expect(html).toContain('method="post"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Enable JavaScript");
    expect(html).not.toContain("?comment=");
  });
  it("uses exact immutable retry payload after uncertain HTTP failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("private raw error"));
    vi.stubGlobal("fetch", fetch);
    render(
      <PublicationForm
        bookingId={randomUUID()}
        bookingRevision={1}
        completionEventId={randomUUID()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rating from 1 to 5"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText(/Comment/), {
      target: { value: "Fictional plain text" },
    });
    const form = screen
      .getByRole("button", { name: "Save synthetic review" })
      .closest("form")!;
    fireEvent.submit(form);
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(alert));
    fireEvent.submit(form);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      JSON.parse(fetch.mock.calls[1][1].body),
    );
    expect(alert.textContent).not.toContain("private raw error");
    expect(window.location.search).toBe("");
  });
  it("does not publish without explicit privacy confirmation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(
      <PublicationForm reviewId={randomUUID()} revision={1} state="approved" />,
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Save moderation decision" })
        .closest("form")!,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Confirm the privacy review",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("blocks duplicate pending submissions with accessible state", async () => {
    let resolve: (v: Response) => void = () => {};
    const fetch = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <PublicationForm
        bookingId={randomUUID()}
        bookingRevision={1}
        completionEventId={randomUUID()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rating from 1 to 5"), {
      target: { value: "3" },
    });
    const form = screen
      .getByRole("button", { name: "Save synthetic review" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute("aria-busy", "true");
    resolve(
      new Response(JSON.stringify({ message: "Reload the current review." }), {
        status: 409,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reload the current review",
    );
  });
  it("withdrawn/rejected reconsideration offers pending and immutable text only", () => {
    render(
      <PublicationForm
        reviewId={randomUUID()}
        revision={3}
        state="withdrawn"
      />,
    );
    expect(
      screen.getAllByRole("option").map((o) => o.getAttribute("value")),
    ).toEqual(["pending"]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("private view shows escaped immutable text and actual minimal moderation history", () => {
    render(
      <PublicationReviewView
        review={{
          id: randomUUID(),
          rating: 2,
          comment: "<img src=x onerror=evil()>",
          state: "published",
          revision: 2,
          history: [
            {
              previousState: null,
              nextState: "pending",
              revision: 0,
              privacyChecked: false,
            },
            {
              previousState: "pending",
              nextState: "approved",
              revision: 1,
              privacyChecked: true,
            },
            {
              previousState: "approved",
              nextState: "published",
              revision: 2,
              privacyChecked: true,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("<img src=x onerror=evil()>")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
