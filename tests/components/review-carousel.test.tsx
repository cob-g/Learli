import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewCarousel } from "@/features/home/review-carousel";
import { sampleReviews } from "@/features/home/sample-reviews";

const html = renderToStaticMarkup(<ReviewCarousel reviews={sampleReviews} />);

describe("review carousel", () => {
  it("lists every review in the server markup, with no controls that need scripts", () => {
    for (const review of sampleReviews) {
      expect(html).toContain(review.author);
      // The whole sentence is present once for assistive technology.
      expect(html).toContain(`>${review.quote}</span>`);
    }
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-live");
    expect(html).not.toContain("data-state");
  });

  it("keeps its pictures decorative and its animated words out of the accessibility tree", () => {
    expect(html.match(/<img[^>]*alt=""/g)).toHaveLength(sampleReviews.length);
    expect(html).toContain('class="home-reviews-stage" aria-hidden="true"');
    expect(
      html.match(/<span aria-hidden="true"><span class="home-reviews-word"/g),
    ).toHaveLength(sampleReviews.length);
  });

  it("stands the first three pictures in the arc before any script runs", () => {
    expect(html.match(/data-place="active"/g)).toHaveLength(1);
    expect(html.match(/data-place="next"/g)).toHaveLength(1);
    expect(html.match(/data-place="prev"/g)).toHaveLength(1);
  });
});

describe("sample reviews", () => {
  it("name nobody and claim nothing the product has not approved", () => {
    for (const review of sampleReviews) {
      const text = `${review.author} ${review.context} ${review.quote}`;
      // Speakers are roles, never named people.
      expect(review.author).toMatch(
        /^(Parent|Guardian) of an? .+ learner$|learner$/,
      );
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(
        /verified|vetted|checked|guarantee|free|price|paid|discount|refund|grade|score|result|improv|best|recommend/i,
      );
      // Each picture is one of the faceless lesson-moment crops.
      expect(review.image).toMatch(/^\/home\/moment-[a-z]+\.webp$/);
    }
  });
});
