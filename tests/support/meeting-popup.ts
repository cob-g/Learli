import type { Page } from "@playwright/test";

/**
 * Clicks a booking's "Open meeting" link and returns the redirect target.
 * Playwright route handlers only see the first URL of a redirect chain, so a
 * route on the meeting host never fires; the app's `?open=1` request is
 * fetched here without following its 303, and nothing reaches Zoom or Meet.
 */
export async function openedMeetingDestination(page: Page, name: string) {
  const context = page.context();
  const opening = (url: URL) =>
    url.pathname.endsWith("/meeting-link") &&
    url.searchParams.get("open") === "1";
  let destination: string | null = null;
  await context.route(opening, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    destination =
      response.status() === 303 ? (response.headers().location ?? null) : null;
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Intercepted fictional meeting</title>",
    });
  });
  const popup = context.waitForEvent("page");
  await page.getByRole("link", { name, exact: true }).click();
  const external = await popup;
  await external.waitForLoadState();
  await external.close();
  await context.unroute(opening);
  return destination;
}
