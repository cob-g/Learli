// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { startTransition } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationProgress } from "@/components/shared/navigation-progress";
import { onRouterTransitionStart } from "@/instrumentation-client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The router reports the start inside the transition that ends on arrival. */
async function navigate() {
  let arrive = () => {};
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await act(async () => {
    startTransition(async () => {
      onRouterTransitionStart();
      await arrived;
    });
  });
  return () =>
    act(async () => {
      arrive();
      await arrived;
    });
}
const wait = (millis: number) =>
  act(async () => {
    vi.advanceTimersByTime(millis);
  });

/** Not `role="status"`: pages keep that role for their own messages. */
function region() {
  const { container } = render(<NavigationProgress />);
  expect(screen.queryByRole("status")).toBeNull();
  return container.querySelector(".navigation-progress") as HTMLElement;
}

describe("navigation progress", () => {
  it("draws nothing in server markup, so a page without scripts is unchanged", () => {
    expect(renderToStaticMarkup(<NavigationProgress />)).toBe(
      '<div class="navigation-progress" aria-live="polite" aria-atomic="true"></div>',
    );
  });

  it("announces a slow navigation and clears when the page arrives", async () => {
    const status = region();
    const arrive = await navigate();
    expect(status).toBeEmptyDOMElement();
    await wait(150);
    expect(status).toHaveTextContent("Loading page…");
    expect(status.querySelector(".navigation-progress-track")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await arrive();
    expect(status).toBeEmptyDOMElement();
  });

  it("shows nothing for a navigation that finishes quickly", async () => {
    const status = region();
    const arrive = await navigate();
    await wait(100);
    await arrive();
    await wait(500);
    expect(status).toBeEmptyDOMElement();
  });

  it("starts the wait again for the next navigation", async () => {
    const status = region();
    await (
      await navigate()
    )();
    const arrive = await navigate();
    await wait(149);
    expect(status).toBeEmptyDOMElement();
    await wait(1);
    expect(status).toHaveTextContent("Loading page…");
    await arrive();
    expect(status).toBeEmptyDOMElement();
  });
});
