// @vitest-environment jsdom
import { act, cleanup, render, within } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInCompanion } from "@/features/auth/sign-in-companion";

class CompanionObserver {
  readonly observe = vi.fn((target: Element) => {
    this.target = target;
  });
  readonly disconnect = vi.fn();
  private target: Element | undefined;

  constructor(private readonly notify: IntersectionObserverCallback) {
    observers.push(this);
  }

  intersect(isIntersecting: boolean) {
    if (!this.target) throw new Error("No sign-in companion is being observed");
    this.notify(
      [{ target: this.target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const observers: CompanionObserver[] = [];
const roots: Root[] = [];
let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  observers.length = 0;
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  vi.stubGlobal("IntersectionObserver", CompanionObserver);
});

afterEach(async () => {
  cleanup();
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document
    .querySelectorAll("[data-companion-hydration-test]")
    .forEach((container) => container.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function artIn(container: HTMLElement) {
  const art = container.querySelector<HTMLElement>(".sign-in-art");
  if (!art) throw new Error("sign-in companion art is missing");
  return art;
}

function intersect(isIntersecting: boolean) {
  const observer = observers.at(-1);
  if (!observer) throw new Error("sign-in companion observer is missing");
  act(() => observer.intersect(isIntersecting));
}

function changeVisibility(nextVisibility: DocumentVisibilityState) {
  act(() => {
    visibility = nextVisibility;
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function advanceTime(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

function companion() {
  return (
    <SignInCompanion>
      <span>Decorative companion</span>
    </SignInCompanion>
  );
}

describe("sign-in companion motion", () => {
  it("hydrates the same static artwork and children without a pause control", async () => {
    const node = companion();
    const container = document.createElement("div");
    container.setAttribute("data-companion-hydration-test", "");
    container.innerHTML = renderToString(node);
    document.body.append(container);
    const art = artIn(container);
    const child = within(art).getByText("Decorative companion");

    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).not.toHaveAttribute("data-motion-running");
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
    expect(observers).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);

    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, node, { onRecoverableError }));
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(artIn(container)).toBe(art);
    expect(within(art).getByText("Decorative companion")).toBe(child);
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
    expect(art).not.toHaveAttribute("data-motion-running");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("runs only after entering view", () => {
    const { container } = render(companion());
    const art = artIn(container);

    expect(observers.at(-1)?.observe).toHaveBeenCalledWith(
      within(container).getByRole("complementary", {
        name: "Tutoring artwork",
      }),
    );
    expect(art).not.toHaveAttribute("data-motion-running");
    intersect(true);
    expect(art).toHaveAttribute("data-motion-running");
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
  });

  it("suspends offscreen or in a hidden document and resumes only before the deadline", () => {
    visibility = "hidden";
    const { container } = render(companion());
    const art = artIn(container);

    intersect(true);
    expect(art).not.toHaveAttribute("data-motion-running");
    changeVisibility("visible");
    expect(art).toHaveAttribute("data-motion-running");
    intersect(false);
    expect(art).not.toHaveAttribute("data-motion-running");
    changeVisibility("hidden");
    intersect(true);
    expect(art).not.toHaveAttribute("data-motion-running");
    advanceTime(4499);
    changeVisibility("visible");
    expect(art).toHaveAttribute("data-motion-running");
    changeVisibility("hidden");
    expect(art).not.toHaveAttribute("data-motion-running");
    changeVisibility("visible");
    expect(art).toHaveAttribute("data-motion-running");
  });

  it("settles after 4.5 seconds and never restarts after visibility changes", () => {
    const { container } = render(companion());
    const art = artIn(container);
    intersect(true);
    advanceTime(4499);
    expect(art).toHaveAttribute("data-motion-running");

    advanceTime(1);
    expect(art).not.toHaveAttribute("data-motion-running");
    expect(vi.getTimerCount()).toBe(0);
    changeVisibility("hidden");
    intersect(false);
    changeVisibility("visible");
    intersect(true);
    advanceTime(4500);

    expect(art).not.toHaveAttribute("data-motion-running");
    expect(art).toHaveTextContent("Decorative companion");
  });

  it.each(["offscreen", "hidden"])(
    "does not start late when mounted %s through the deadline",
    (gate) => {
      visibility = gate === "hidden" ? "hidden" : "visible";
      const { container } = render(companion());
      const art = artIn(container);
      intersect(gate === "hidden");
      expect(art).not.toHaveAttribute("data-motion-running");

      advanceTime(4500);
      changeVisibility("visible");
      intersect(true);

      expect(art).not.toHaveAttribute("data-motion-running");
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("keeps the static fallback without a control or timer when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(companion());
    const art = artIn(container);

    expect(art).toHaveTextContent("Decorative companion");
    expect(art).not.toHaveAttribute("data-motion-running");
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
    expect(observers).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    changeVisibility("hidden");
    changeVisibility("visible");
    advanceTime(4500);
    expect(art).not.toHaveAttribute("data-motion-running");
  });

  it("disconnects its observer and clears its exact visibility subscriptions and settling timer on unmount", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(companion());
    const subscriptions = addListener.mock.calls.filter(
      ([type]) => type === "visibilitychange",
    );
    expect(subscriptions.length).toBeGreaterThan(0);
    expect(observers.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    for (const observer of observers)
      expect(observer.disconnect).toHaveBeenCalled();
    for (const [type, listener] of subscriptions) {
      expect(
        removeListener.mock.calls.some(
          ([removedType, removedListener]) =>
            removedType === type && removedListener === listener,
        ),
      ).toBe(true);
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
