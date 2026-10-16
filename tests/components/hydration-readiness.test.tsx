// @vitest-environment jsdom
import { act, fireEvent, within } from "@testing-library/react";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHydrated } from "@/hooks/use-hydrated";
import { AuthForm } from "@/features/auth/auth-form";
import { SiteHeader } from "@/components/shared/site-header";
import { ReviewCarousel } from "@/features/home/review-carousel";
import { sampleReviews } from "../fixtures/review-carousel";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: null,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    }),
  },
}));

const roots: Root[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function serverContainer(node: ReactNode) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(node);
  document.body.append(container);
  return container;
}

async function hydrate(container: HTMLElement, node: ReactNode) {
  const onRecoverableError = vi.fn();
  await act(async () => {
    roots.push(hydrateRoot(container, node, { onRecoverableError }));
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
}

function BrowserControls({ commit }: { commit: (ready: boolean) => void }) {
  const ready = useHydrated();
  const [clicks, setClicks] = useState(0);
  useLayoutEffect(() => {
    commit(ready);
  }, [commit, ready]);
  return (
    <div data-live={ready ? "" : undefined}>
      <button
        type="button"
        disabled={!ready}
        onClick={() => setClicks((value) => value + 1)}
      >
        Activate {clicks}
      </button>
    </div>
  );
}

describe("hydration readiness", () => {
  it("keeps server controls inert, matches the first hydration commit, then enables working handlers", async () => {
    const phases: boolean[] = [];
    const node = <BrowserControls commit={(ready) => phases.push(ready)} />;
    const container = serverContainer(node);
    const button = within(container).getByRole("button");
    expect(button).toBeDisabled();
    expect(container.querySelector("[data-live]")).toBeNull();
    expect(phases).toEqual([]);

    await hydrate(container, node);

    expect(phases).toEqual([false, true]);
    expect(within(container).getByRole("button")).toBe(button);
    expect(button).toBeEnabled();
    expect(container.querySelector("[data-live]")).not.toBeNull();
    fireEvent.click(button);
    expect(button).toHaveTextContent("Activate 1");
  });

  it("enables a new client-rendered control on its first commit", async () => {
    const phases: boolean[] = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(<BrowserControls commit={(ready) => phases.push(ready)} />);
    });
    expect(phases).toEqual([true]);
    expect(within(container).getByRole("button")).toBeEnabled();
    fireEvent.click(within(container).getByRole("button"));
    expect(within(container).getByRole("button")).toHaveTextContent(
      "Activate 1",
    );
  });

  it.each([false, true])(
    "hydrates the existing auth POST fallback without changing fields or guidance (hosted=%s)",
    async (hosted) => {
      const node = <AuthForm mode="sign-in" hosted={hosted} />;
      const container = serverContainer(node);
      const form = container.querySelector("form")!;
      const password = within(container).getByLabelText("Password");
      expect(form).toHaveAttribute("method", "post");
      expect(form).toHaveAttribute("action", "/api/auth/sign-in/email");
      expect(password).toBeDisabled();
      expect(container).toHaveTextContent(
        "Enable JavaScript to use account forms here.",
      );

      await hydrate(container, node);

      expect(within(container).getByLabelText("Password")).toBe(password);
      expect(password).toBeEnabled();
      expect(
        within(container).getByRole("button", { name: "Sign in" }),
      ).toBeEnabled();
      expect(form).toHaveAttribute("method", "post");
      expect(form).toHaveAttribute("action", "/api/auth/sign-in/email");
      expect(container).not.toHaveTextContent(
        "Enable JavaScript to use account forms here.",
      );
    },
  );

  it("hydrates the shared header and retains its independent live scroll subscription", async () => {
    let scrollY = 20;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const node = <SiteHeader />;
    const container = serverContainer(node);
    const header = container.querySelector("header")!;
    expect(header).not.toHaveAttribute("data-live");
    expect(header).not.toHaveAttribute("data-raised");

    await hydrate(container, node);

    expect(container.querySelector("header")).toBe(header);
    expect(header).toHaveAttribute("data-live");
    expect(header).toHaveAttribute("data-raised");
    scrollY = 0;
    fireEvent.scroll(window);
    expect(header).not.toHaveAttribute("data-raised");
    expect(header).toHaveAttribute("data-live");
    scrollY = 30;
    fireEvent.scroll(window);
    expect(header).toHaveAttribute("data-raised");
  });

  it("hydrates static reviews and retains reduced-motion changes, visible-time rotation and Next", async () => {
    vi.useFakeTimers();
    let reduced = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    }));
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private notify: IntersectionObserverCallback) {}
        observe(target: Element) {
          this.notify(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        disconnect() {}
      },
    );
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const node = <ReviewCarousel reviews={sampleReviews} />;
    const container = serverContainer(node);
    const carousel = container.querySelector(".home-reviews")!;
    expect(carousel).not.toHaveAttribute("data-live");
    expect(container.querySelector("[data-state]")).toBeNull();
    expect(within(container).queryByRole("button")).toBeNull();
    for (const review of sampleReviews)
      expect(container).toHaveTextContent(review.quote);

    await hydrate(container, node);

    expect(carousel).toHaveAttribute("data-live");
    const active = () => container.querySelector('[data-state="rest"]')!;
    expect(active()).toHaveTextContent(sampleReviews[0].author);
    await act(async () => vi.advanceTimersByTime(6200));
    expect(active()).toHaveTextContent(sampleReviews[0].author);

    await act(async () => {
      reduced = false;
      for (const listener of listeners) listener();
    });
    await act(async () => vi.advanceTimersByTime(6200));
    expect(container.querySelector('[data-state="in"]')).toHaveTextContent(
      sampleReviews[1].author,
    );
    expect(within(container).getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(
      within(container).getByRole("button", { name: "Next review" }),
    );
    expect(within(container).getByRole("status")).toHaveTextContent(
      `Review 3 of ${sampleReviews.length}`,
    );
    await act(async () => {
      reduced = true;
      for (const listener of listeners) listener();
    });
    await act(async () => vi.advanceTimersByTime(12000));
    expect(within(container).getByRole("status")).toHaveTextContent(
      `Review 3 of ${sampleReviews.length}`,
    );
  });
});
