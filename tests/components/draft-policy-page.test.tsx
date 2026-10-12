// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/shared/site-footer";
import PrivacyPage, {
  metadata as privacyMetadata,
} from "@/app/(marketing)/privacy/page";
import TermsPage, {
  metadata as termsMetadata,
} from "@/app/(marketing)/terms/page";
import CancellationsPage, {
  metadata as cancellationsMetadata,
} from "@/app/(marketing)/cancellations/page";

afterEach(cleanup);

describe("draft policy routes", () => {
  const routes = [
    {
      Page: PrivacyPage,
      metadata: privacyMetadata,
      title: "Privacy draft",
      decision: /Record-retention periods/,
    },
    {
      Page: TermsPage,
      metadata: termsMetadata,
      title: "Terms draft",
      decision: /Who receives customer money/,
    },
    {
      Page: CancellationsPage,
      metadata: cancellationsMetadata,
      title: "Cancellations draft",
      decision: /Who may cancel or reschedule/,
    },
  ];

  for (const { Page, metadata, title, decision } of routes) {
    it(`${title} renders static preparation and remains excluded from indexing`, () => {
      const { container } = render(<Page />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        title,
      );
      expect(
        screen.getByText(/Draft for local preparation only/),
      ).toBeVisible();
      expect(screen.getByText(/local loopback/)).toBeVisible();
      expect(screen.getByText(/\.test/)).toBeVisible();
      expect(screen.getByText(decision)).toBeVisible();
      expect(
        screen.getByText(/Payments and real minor onboarding remain gated/),
      ).toBeVisible();
      expect(
        container.querySelector("form, input, button, textarea, select"),
      ).toBeNull();
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.title).toBe(title);
      for (const link of screen.getAllByRole("link")) {
        expect(link.getAttribute("href")).toMatch(
          /^\/(contact|report-a-concern)$/,
        );
      }
    });
  }

  it("keeps help routes and labels every footer policy destination as draft", () => {
    render(<SiteFooter />);
    const footer = within(
      screen.getByRole("navigation", { name: "Footer navigation" }),
    );
    for (const [name, href] of [
      ["Privacy draft", "/privacy"],
      ["Terms draft", "/terms"],
      ["Cancellations draft", "/cancellations"],
      ["Contact support", "/contact"],
      ["Report a concern", "/report-a-concern"],
    ]) {
      expect(footer.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });
});
