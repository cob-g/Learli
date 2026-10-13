import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({
  reviews: vi.fn(),
  preview: vi.fn(),
  tutor: vi.fn(),
}));
vi.mock("@/features/review-publication/public", () => ({
  loadPublicReviews: state.reviews,
}));
vi.mock("@/features/tutors/public", () => ({ readPublicTutor: state.tutor }));
vi.mock("@/features/public-availability/profile", () => ({
  loadProfilePreview: state.preview,
}));
vi.mock("@/features/public-availability/profile-picker", () => ({
  ProfilePicker: () => <p>Historical demo picker</p>,
}));
import Page from "@/app/(marketing)/tutors/[slug]/page";
beforeEach(() => {
  vi.clearAllMocks();
  state.tutor.mockResolvedValue({
    slug: "fictional-tutor",
    displayName: "Fictional tutor",
    headline: "Fictional headline",
    bio: "Fictional introduction",
    teachingBackground: "Fictional background",
    teachingLanguages: [],
    offerings: [
      {
        subjectSlug: "math",
        subjectName: "Math",
        levels: ["high_school"],
        specialty: null,
      },
    ],
  });
  state.preview.mockResolvedValue({ timezone: "UTC" });
});
const render = async () =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "fictional-tutor" }),
      searchParams: Promise.resolve({}),
    }),
  );
describe("public profile preserves exact availability source boundary", () => {
  it("disabled ordinary profile still invokes and renders its existing demo preview", async () => {
    state.reviews.mockResolvedValue(null);
    const html = await render();
    expect(state.preview).toHaveBeenCalledOnce();
    expect(html).toContain("Historical demo picker");
    expect(html).not.toContain("Review synthetic booking options");
    expect(html).not.toContain("Synthetic published reviews");
  });
  it("enabled readiness profile never invokes legacy preview and hands off to W6", async () => {
    state.reviews.mockResolvedValue({
      scope: "synthetic_readiness",
      count: 0,
      average: null,
      reviews: [],
    });
    const html = await render();
    expect(state.preview).not.toHaveBeenCalled();
    expect(html).not.toContain("Historical demo picker");
    expect(html).toContain(
      "/bookings/demo?tutorSlug=fictional-tutor&amp;subjectSlug=math",
    );
    expect(html).toContain("No reviews yet");
  });
  it("enabled read failure remains unavailable without falling back to legacy inventory", async () => {
    state.reviews.mockResolvedValue(undefined);
    const html = await render();
    expect(state.preview).not.toHaveBeenCalled();
    expect(html).not.toContain("Historical demo picker");
    expect(html).toContain("couldn&#x27;t load reviews");
    expect(html).not.toContain("No reviews yet");
    expect(html).toContain("Review synthetic booking options");
  });
});
