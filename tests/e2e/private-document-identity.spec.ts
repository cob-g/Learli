import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createDatabase } from "../../src/lib/db/connection";

// Run only against a fresh owned loopback test database. No reset/global setup
// is needed: every fixture is a new synthetic user created via the real routes.
test.use({ trace: "off", screenshot: "off", video: "off" });
let owner: ReturnType<typeof createDatabase>;
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = "Synthetic-private-document-password-123";
// A reused worker can run multiple fully-parallel groups from this file.
test.beforeAll(() => {
  owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
});
test.afterAll(async () => owner.pool.end());
test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
});
async function createActor(page: Page, name: string) {
  const email = `document-${randomUUID()}@learli.test`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  return { id, email, name };
}
async function signIn(page: Page, email: string) {
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test("a second-tab account change clears rendered data before exact-URL document replacement releases private bootstrap", async ({
  page,
  context,
}) => {
  const a = await createActor(page, "Synthetic document owner A");
  const b = await createActor(page, "Synthetic document owner B");
  await signIn(page, a.email);
  const selection =
    "/account?scope=tutor&selection=synthetic%2Fretained#profile";
  await page.goto(selection);
  await expect(page.getByLabel("Display name")).toHaveValue(a.name);
  expect(await page.locator("script").allTextContents()).toEqual(
    expect.arrayContaining([expect.stringContaining(a.email)]),
  );
  const other = await context.newPage();
  await other.goto("/account");
  await expect(other.getByLabel("Display name")).toHaveValue(a.name);
  const transitionObserved = gate();
  let transition: {
    inputCount: number;
    privateText: boolean;
    inlineRetained: boolean;
  } | null = null;
  await page.exposeFunction(
    "recordPrivateDocumentTransition",
    (snapshot: NonNullable<typeof transition>) => {
      transition = snapshot;
      transitionObserved.release();
    },
  );
  await page.evaluate((email) => {
    const observer = new MutationObserver(() => {
      if (
        !Array.from(document.querySelectorAll('[role="status"]')).some(
          (node) => node.textContent === "Loading account access…",
        )
      )
        return;
      const snapshot = {
        inputCount: document.querySelectorAll('input[name="name"]').length,
        privateText: Boolean(
          document.querySelector("main")?.textContent?.includes(email),
        ),
        inlineRetained: Array.from(document.scripts).some((script) =>
          script.textContent?.includes(email),
        ),
      };
      observer.disconnect();
      void (
        window as typeof window & {
          recordPrivateDocumentTransition: (
            payload: typeof snapshot,
          ) => Promise<void>;
        }
      ).recordPrivateDocumentTransition(snapshot);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, a.email);

  // Hold provider reads until tab B has completed the cookie transition. This
  // proves the A -> B path even when tab A never observes the intermediate null.
  const sessionGate = gate(),
    sessionRequested = gate(),
    finalSessionRequested = gate();
  let finalSession = false;
  await page.route("**/api/auth/get-session**", async (route) => {
    sessionRequested.release();
    if (finalSession) finalSessionRequested.release();
    await sessionGate.promise;
    await route.continue().catch(() => {});
  });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("learli:account-updated")),
  );
  await test.step(
    "original tab has a held provider refresh",
    () => sessionRequested.promise,
    { timeout: 10000 },
  );
  await other
    .getByRole("main")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  // Provider settlement can reload the guarded account before SignOut replaces
  // it; both supported paths end at sign-in with only the safe account return.
  await expect(other).toHaveURL(
    (url) =>
      url.origin === origin &&
      url.pathname === "/sign-in" &&
      (url.search === "" || url.search === "?next=%2Faccount") &&
      url.hash === "",
  );
  await signIn(other, b.email);
  expect((await page.request.get(`/api/account/${a.id}`)).status()).toBe(404);
  finalSession = true;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("learli:account-updated")),
  );
  await test.step(
    "a fresh provider request starts under B's cookie",
    () => finalSessionRequested.promise,
    { timeout: 10000 },
  );
  const settledB = page.waitForResponse(async (response) => {
    if (
      new URL(response.url()).pathname !== "/api/auth/get-session" ||
      !response.ok()
    )
      return false;
    return (await response.json().catch(() => null))?.user?.id === b.id;
  });

  const documentGate = gate(),
    documentRequested = gate();
  let replacementUrl = "";
  await page.route("**/*", async (route) => {
    if (
      !route.request().isNavigationRequest() ||
      route.request().frame() !== page.mainFrame()
    )
      return route.fallback();
    replacementUrl = route.request().url();
    documentRequested.release();
    await documentGate.promise;
    await route.continue();
  });
  try {
    sessionGate.release();
    await settledB;
    await test.step(
      "settled mismatch requests document replacement",
      () => documentRequested.promise,
      { timeout: 10000 },
    );
    expect(replacementUrl).toBe(`${origin}${selection.split("#")[0]}`);
    // Locators wait for pending navigation. The observer records the actual old
    // DOM before that navigation commits, without letting the barrier hide it.
    await test.step(
      "old rendered data is removed while inline bootstrap awaits document release",
      () => transitionObserved.promise,
      { timeout: 10000 },
    );
    expect(transition).toEqual({
      inputCount: 0,
      privateText: false,
      inlineRetained: true,
    });
    documentGate.release();
    await expect(page.getByLabel("Display name")).toHaveValue(b.name);
    await expect(page).toHaveURL(`${origin}${selection}`);
    expect(await page.content()).not.toContain(a.email);
    expect(
      (await page.locator("script").allTextContents()).join("\n"),
    ).not.toContain(a.email);
  } finally {
    sessionGate.release();
    documentGate.release();
    await other.close();
  }
});

test("second-tab logout replaces the private document and removes the original payload", async ({
  page,
  context,
}) => {
  const a = await createActor(page, "Synthetic document logout owner");
  await signIn(page, a.email);
  await page.goto("/account");
  await expect(page.getByLabel("Display name")).toHaveValue(a.name);
  const other = await context.newPage();
  await other.goto("/account");
  await other
    .getByRole("main")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(other).toHaveURL("/sign-in");
  await expect(page).toHaveURL(`${origin}/sign-in?next=%2Faccount`);
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  expect(await page.content()).not.toContain(a.email);
  expect((await page.request.get(`/api/account/${a.id}`)).status()).toBe(401);
  await other.close();
});

test("native private-page rendering and navigation still work without JavaScript", async ({
  page,
  context,
  browser,
}) => {
  const a = await createActor(page, "Synthetic native document owner");
  await signIn(page, a.email);
  const native = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await context.storageState(),
    baseURL: origin,
  });
  await native.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  try {
    const nativePage = await native.newPage();
    await nativePage.goto("/account?selection=synthetic-native");
    await expect(nativePage.getByLabel("Display name")).toHaveValue(a.name);
    await expect(
      nativePage.getByText(`Signed in as ${a.email}`, { exact: true }),
    ).toBeVisible();
    await nativePage
      .getByRole("link", { name: "Manage account sessions", exact: true })
      .click();
    await expect(nativePage).toHaveURL(`${origin}/account/sessions`);
    await expect(
      nativePage.getByRole("heading", {
        name: "Account sessions",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await native.close();
  }
});
