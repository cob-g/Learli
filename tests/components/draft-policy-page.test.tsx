// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runtime: {},
  runtimeRead: vi.fn(),
  privateMode: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: mocks.runtimeRead,
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  isPrivateWorkflow: mocks.privateMode,
}));
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
beforeEach(() => {
  vi.resetAllMocks();
  mocks.runtimeRead.mockResolvedValue(mocks.runtime);
  mocks.privateMode.mockReturnValue(false);
});

describe("draft policy routes", () => {
  const routes = [
    {
      Page: PrivacyPage,
      metadata: privacyMetadata,
      title: "Privacy draft",
      description:
        "Privacy preparation for Learli. Real data-handling decisions remain open.",
      decision: /Record-retention periods/,
    },
    {
      Page: TermsPage,
      metadata: termsMetadata,
      title: "Terms draft",
      description:
        "Terms preparation for Learli. Operating and commercial decisions remain open.",
      decision: /Who receives customer money/,
    },
    {
      Page: CancellationsPage,
      metadata: cancellationsMetadata,
      title: "Cancellations draft",
      description:
        "Cancellation preparation for Learli. Real change, refund and no-show rules remain open.",
      decision: /Who may cancel or reschedule/,
    },
  ];

  for (const { Page, metadata, title, description, decision } of routes) {
    it(`${title} preserves default preparation and remains excluded from indexing`, async () => {
      const { container } = render(await Page());
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
      expect(metadata.description).toBe(description);
      for (const link of screen.getAllByRole("link")) {
        expect(link.getAttribute("href")).toMatch(
          /^\/(contact|report-a-concern)$/,
        );
      }
    });

    it(`${title} describes persisted private work without changing unresolved policy gates`, async () => {
      mocks.privateMode.mockReturnValue(true);
      const { container } = render(await Page());
      expect(mocks.privateMode).toHaveBeenCalledExactlyOnceWith(mocks.runtime);
      expect(
        screen.getByRole("heading", {
          name: "Current private preview behavior",
        }),
      ).toBeVisible();
      expect(screen.getByText(/Draft for private testing only/)).toBeVisible();
      expect(screen.getByText(decision)).toBeVisible();
      expect(
        screen.getByText(/Payments and real minor onboarding remain gated/),
      ).toBeVisible();
      expect(screen.getByText(/not monitored/)).toHaveTextContent(
        "fictional test reporting",
      );
      expect(container).not.toHaveTextContent(/simulat|synthetic local/);
      if (title === "Terms draft") {
        expect(container).toHaveTextContent("saved booking requests");
        expect(container).toHaveTextContent(
          "assigned administrative confirmation",
        );
        expect(container).toHaveTextContent("Payments are disabled");
        expect(container).toHaveTextContent(
          "Booking status does not establish payment or attendance",
        );
        expect(container).toHaveTextContent("does not ask you to accept terms");
      } else if (title === "Cancellations draft") {
        expect(container).toHaveTextContent(
          "authorized cancellation or rescheduling changes",
        );
        expect(container).toHaveTextContent("test rules, not customer terms");
        expect(container).toHaveTextContent("No customer cancellation window");
      }
      expect(
        container.querySelector("form, input, button, textarea, select"),
      ).toBeNull();
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.description).toBe(description);
    });

    it(`${title} falls back to default preparation without a runtime`, async () => {
      mocks.runtimeRead.mockResolvedValue(null);
      mocks.privateMode.mockReturnValue(true);
      render(await Page());
      expect(mocks.privateMode).not.toHaveBeenCalled();
      expect(
        screen.getByText(/Draft for local preparation only/),
      ).toBeVisible();
      expect(screen.getByText(/local loopback/)).toBeVisible();
      expect(
        screen.queryByRole("heading", {
          name: "Current private preview behavior",
        }),
      ).not.toBeInTheDocument();
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
