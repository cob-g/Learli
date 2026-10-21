import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import { enrollBrowserAdmin } from "../support/browser-admin-mfa";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "default" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = "Synthetic-workspace-passphrase-123";
const evidence = process.env.WORKSPACE_EVIDENCE_DIR;
test.beforeEach(async () => {
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  await owner.pool.end();
});
async function signIn(
  page: Page,
  roles: string[],
  name = "Workspace test account",
) {
  const email = `workspace-${randomUUID()}@learli.test`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  for (const role of roles)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,$2)",
      [id, role],
    );
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { id, email, name };
}
async function privateShell(page: Page) {
  await expect(
    page.locator(".site-header,.site-dock,.site-footer-accent,footer"),
  ).toHaveCount(0);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(
    await page.locator('meta[name="robots"]').first().getAttribute("content"),
  ).toContain("noindex");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function capture(page: Page, label: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: path.join(evidence, `${label}.png`),
    fullPage: true,
  });
}
async function menu(page: Page) {
  const trigger = page.getByRole("button", { name: "Workspace menu" });
  if (
    (await trigger.isVisible()) &&
    (await trigger.getAttribute("aria-expanded")) === "false"
  )
    await trigger.click();
}

for (const role of ["parent", "student", "tutor", "admin"]) {
  test(`${role} workspace retains existing destinations and same-tab navigation`, async ({
    page,
  }) => {
    await signIn(page, [role]);
    await page.goto(`/${role}`);
    if (role === "admin") {
      await expect(page).toHaveURL("/account/security");
      await expect(
        page.getByRole("heading", {
          name: "Administrator security",
          exact: true,
        }),
      ).toBeVisible();
      await enrollBrowserAdmin(page.context(), password);
      await page.goto("/admin");
    }
    await expect(
      page.getByRole("button", { name: "Account Workspace test account" }),
    ).toBeVisible();
    await privateShell(page);
    const nav = page.getByRole("navigation", {
      name: `${role[0].toUpperCase() + role.slice(1)} work areas`,
    });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    if (role === "parent") {
      await expect(
        nav.getByRole("link", { name: "Parent Dashboard", exact: true }),
      ).toHaveAttribute("href", "/parent");
      await expect(
        nav.getByRole("link", { name: "Parent Dashboard", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        nav.getByRole("link", { name: "Bookings", exact: true }),
      ).toHaveAttribute("href", "/bookings?scope=guardian");
      await expect(
        nav.getByRole("link", { name: "Bookings", exact: true }),
      ).not.toHaveAttribute("aria-current", "page");
    }
    await expect(
      page.getByText("Switch workspace", { exact: true }),
    ).toHaveCount(0);
    await capture(page, `${role}-desktop`);
    const destination =
      role === "tutor"
        ? ["Profile", "/tutor/profile"]
        : role === "admin"
          ? ["Subjects", "/admin/subjects"]
          : role === "parent"
            ? ["My Children", "/parent/children"]
            : ["Learners", "/learners"];
    await nav.getByRole("link", { name: destination[0], exact: true }).click();
    await expect(page).toHaveURL(destination[1]);
    await privateShell(page);
    if (role === "parent" || role === "student")
      await expect(page.locator(".workspace-current")).toHaveText(
        `${role[0].toUpperCase() + role.slice(1)} workspace`,
      );
    const sidebar = page.locator(".workspace-sidebar");
    await sidebar
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
    await expect(page).toHaveURL("/account");
    await expect(page.locator(".workspace-current")).toHaveText(
      `${role[0].toUpperCase() + role.slice(1)} workspace`,
    );
    expect(page.context().pages()).toHaveLength(1);
    await sidebar.getByRole("link", { name: "Visit website" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
  });
}

test("multi-role and roleless shared pages are neutral; unassigned routes stay denied", async ({
  page,
}) => {
  await signIn(page, ["parent", "tutor"]);
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Account Workspace test account" }),
  ).toBeVisible();
  await page.getByText("Switch workspace", { exact: true }).click();
  const switcher = page
    .locator(".workspace-sidebar")
    .getByRole("navigation", { name: "Your workspaces" });
  await expect(switcher.getByRole("link")).toHaveCount(2);
  await expect(
    switcher.getByRole("link", { name: "Admin workspace" }),
  ).toHaveCount(0);
  await switcher.getByRole("link", { name: "Tutor workspace" }).click();
  await expect(page).toHaveURL("/tutor");
  await expect(page.locator(".workspace-current")).toHaveText(
    "Tutor workspace",
  );
  await expect(page.locator(".workspace-chooser details")).not.toHaveAttribute(
    "open",
  );
  await page.getByText("Switch workspace", { exact: true }).click();
  await switcher.getByRole("link", { name: "Parent workspace" }).click();
  await expect(page).toHaveURL("/parent");
  for (const target of [
    "/bookings?scope=guardian",
    "/support",
    "/account/sessions",
  ]) {
    await page.goto(target);
    await expect(
      page.getByRole("button", { name: "Account Workspace test account" }),
    ).toBeVisible();
    await expect(page.locator(".workspace-current")).toHaveText("Your account");
    await privateShell(page);
  }
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Workspace access unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Admin work areas" }),
  ).toHaveCount(0);
  await page.request.post("/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
  await signIn(page, [], "Roleless test account");
  await page.goto("/account");
  await expect(
    page.getByText("No workspace assigned.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Switch workspace", { exact: true })).toHaveCount(
    0,
  );
});

test("multi-role booking entry preserves parent or student scope through sign-in", async ({
  page,
}) => {
  const account = await signIn(page, ["parent", "student"]);
  for (const scope of ["student", "guardian"] as const) {
    expect(
      (
        await page.request.post("/api/auth/sign-out", {
          headers: { origin },
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    const next = `/bookings/new?scope=${scope}`;
    await page.goto(`/sign-in?${new URLSearchParams({ next })}`);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(next);
    await expect(
      page.getByRole("heading", {
        name: "Booking request unavailable",
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("mobile menu, keyboard, long names and 200 percent text remain readable", async ({
  page,
}) => {
  const name =
    "Alexandria Montgomery Fernández Chen with a very long synthetic family name";
  await signIn(page, ["parent", "tutor"], name);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/parent");
    await expect(
      page.getByRole("button", { name: `Account ${name}` }),
    ).toBeVisible();
    await privateShell(page);
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: "Workspace menu" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("link", { name: "Learli account" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await menu(page);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await capture(page, `workspace-${width}`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await privateShell(page);
    await expect(page.locator(".workspace-account bdi")).toHaveText(name);
    await capture(page, `workspace-${width}-text200`);
    await page
      .locator(".workspace-sidebar")
      .getByRole("link", { name: "Support requests" })
      .click();
    await expect(page).toHaveURL("/support");
  }
});

test("delayed or failed identity reads keep content geometry stable and discard old roles", async ({
  page,
}) => {
  await signIn(page, ["parent"]);
  const measurements: unknown[] = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let accountReads = 0;
    const hold = async (route: Route) => {
      accountReads++;
      await gate;
      await route.continue();
    };
    await page.route("**/api/account/*", hold);
    // The first document carries the server's account: full sidebar at once.
    await page.goto("/parent");
    await expect(
      page.getByRole("button", { name: "Account Workspace test account" }),
    ).toBeVisible();
    // Phones keep the sidebar in a closed menu, so check the markup itself.
    await expect(
      page.locator('.workspace-sidebar nav[aria-label="Parent work areas"]'),
    ).toBeAttached();
    expect(accountReads).toBe(0);
    // A later destination still waits for its own guarded read.
    await menu(page);
    await page
      .locator(".workspace-sidebar")
      .getByRole("link", { name: "My Children" })
      .click();
    await expect(page).toHaveURL("/parent/children");
    // The validated name stays visible while the destination's read is held.
    await expect(
      page.getByRole("button", { name: "Account Workspace test account" }),
    ).toBeVisible();
    await expect(page.getByText("Checking workspace access…")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const before = await page.locator(".workspace-topbar").boundingBox();
    const mainBefore = await page.getByRole("main").boundingBox();
    release();
    await expect(
      page.getByRole("button", { name: "Account Workspace test account" }),
    ).toBeVisible();
    const after = await page.locator(".workspace-topbar").boundingBox();
    const mainAfter = await page.getByRole("main").boundingBox();
    expect(after?.height).toBe(before?.height);
    expect(mainAfter?.y).toBe(mainBefore?.y);
    measurements.push({ width, before, after, mainBefore, mainAfter });
    await page.unroute("**/api/account/*", hold);
  }
  await page.goto("/parent");
  await page.route("**/api/account/*", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await menu(page);
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "My Children" })
    .click();
  await expect(
    page.getByText("Workspace access unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-account bdi")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Parent work areas" }),
  ).toHaveCount(0);
  await page.unroute("**/api/account/*");
  await page
    .locator(".workspace-topbar")
    .getByRole("button", { name: "Try again" })
    .click();
  await expect(
    page.getByRole("button", { name: "Account Workspace test account" }),
  ).toBeVisible();
  if (evidence)
    await writeFile(
      path.join(evidence, "geometry.json"),
      JSON.stringify(measurements, null, 2),
    );
});

test("tutor sidebar link content stays stable through held requests, shared pages and Back", async ({
  page,
}) => {
  const actor = await signIn(page, ["tutor", "parent"]);
  await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone) VALUES($1,$2,'Synthetic tutor','Synthetic biography','Synthetic experience','Asia/Manila')",
    [actor.id, `sidebar-${randomUUID()}`],
  );
  // The auth project runs the shipped deployment, where screening is disabled
  // and the sidebar omits the screening destination.
  const labels = ["Bookings", "Availability", "Time off", "Profile"];
  const observations: unknown[] = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tutor/availability");
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("navigation", { name: "Tutor work areas" }),
    ).toHaveCount(0);
    await menu(page);
    await capture(page, `tutor-availability-${width}`);
    const links = page.locator(
      '.workspace-sidebar nav[aria-label="Tutor work areas"] a',
    );
    await expect(links).toHaveText(labels);
    await page.evaluate(() => {
      const samples: string[][] = [];
      const collect = () =>
        samples.push(
          Array.from(
            document.querySelectorAll(
              '.workspace-sidebar nav[aria-label="Tutor work areas"] a',
            ),
            (el) => el.textContent ?? "",
          ),
        );
      collect();
      const observer = new MutationObserver(collect);
      observer.observe(document.querySelector(".workspace-shell")!, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      Object.assign(window, {
        sidebarSamples: samples,
        sidebarObserver: observer,
      });
    });
    let sessionRequests = 0;
    let releaseSession!: () => void;
    const sessionGate = new Promise<void>((resolve) => {
      releaseSession = resolve;
    });
    const sessionHold = async (route: Route) => {
      sessionRequests++;
      await sessionGate;
      await route.continue().catch(() => {});
    };
    await page.route("**/api/auth/get-session**", sessionHold);
    try {
      for (const [label, target] of [
        ["Profile", "/tutor/profile"],
        ["Time off", "/tutor/time-off"],
        ["Account settings", "/account"],
        ["Support requests", "/support"],
        ["BACK", "/account"],
        ["Availability", "/tutor/availability"],
      ]) {
        let releaseAccount!: () => void;
        const accountGate = new Promise<void>((resolve) => {
          releaseAccount = resolve;
        });
        const hold = async (route: Route) => {
          await accountGate;
          await route.continue().catch(() => {});
        };
        await page.route("**/api/account/*", hold);
        try {
          if (label === "BACK") await page.goBack();
          else {
            await menu(page);
            await page
              .locator(".workspace-sidebar")
              .getByRole("link", { name: label, exact: true })
              .click();
          }
          await expect(page).toHaveURL(target);
          await expect(page.locator(".workspace-account bdi")).toBeVisible();
          await expect(links).toHaveText(labels);
          await expect(page.locator(".workspace-current")).toHaveText(
            "Tutor workspace",
          );
          if (width < 1024)
            await expect(
              page.getByRole("button", { name: "Workspace menu" }),
            ).toHaveAttribute("aria-expanded", "false");
          releaseAccount();
          await expect(page.locator(".workspace-account bdi")).toBeVisible();
          await expect(links).toHaveText(labels);
          await expect(page.locator(".workspace-current")).toHaveText(
            "Tutor workspace",
          );
          await expect(
            page
              .getByRole("main")
              .getByRole("navigation", { name: "Tutor work areas" }),
          ).toHaveCount(0);
          await privateShell(page);
        } finally {
          releaseAccount();
          await page.unroute("**/api/account/*", hold);
        }
      }
      expect(sessionRequests).toBe(0); // The guarded account GET already authorizes the current provider session.
    } finally {
      releaseSession();
      await page.unroute("**/api/auth/get-session**", sessionHold);
    }
    const samples = await page.evaluate(() => {
      const current = window as typeof window & {
        sidebarSamples: string[][];
        sidebarObserver: MutationObserver;
      };
      current.sidebarObserver.disconnect();
      return current.sidebarSamples;
    });
    expect(samples.length).toBeGreaterThan(6);
    for (const sample of samples) expect(sample).toEqual(labels);
    observations.push({
      width,
      samples: samples.length,
      labels,
      sessionRequests,
    });
  }
  if (evidence)
    await writeFile(
      path.join(evidence, "sidebar-content.json"),
      JSON.stringify(observations, null, 2),
    );
});

test("expired and suspended sessions never display retained workspace identity", async ({
  page,
}) => {
  const actor = await signIn(page, ["parent"]);
  await page.goto("/parent");
  await expect(
    page.getByRole("button", { name: "Account Workspace test account" }),
  ).toBeVisible();
  await owner.pool.query(
    "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
    [actor.id],
  );
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Account settings" })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(
    page.getByText("Workspace test account", { exact: true }),
  ).toHaveCount(0);
  const suspended = await signIn(page, ["tutor"], "Suspended test account");
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [suspended.id],
  );
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Account access unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("Workspace access unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-account bdi")).toHaveCount(0);
  expect((await page.request.get(`/api/account/${actor.id}`)).status()).toBe(
    403,
  );
  await page
    .locator(".workspace-topbar")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL("/sign-in");
});

test("multi-role switching preserves chosen shared context and successful provider refresh", async ({
  page,
}) => {
  await signIn(page, ["tutor", "parent", "student"]);
  await page.goto("/account");
  await expect(page.locator(".workspace-account bdi")).toBeVisible();
  await expect(page.locator(".workspace-current")).toHaveText("Your account");
  for (const role of ["tutor", "parent", "student"]) {
    const title = `${role[0].toUpperCase() + role.slice(1)} workspace`;
    const chooser = page.locator(".workspace-chooser details");
    if ((await chooser.getAttribute("open")) === null)
      await chooser.locator("summary").click();
    await chooser.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(`/${role}`);
    await expect(chooser).not.toHaveAttribute("open");
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    await chooser.locator("summary").click();
    await chooser.getByRole("link", { name: title, exact: true }).click();
    await expect(chooser).not.toHaveAttribute("open");
    for (const [label, target] of [
      ...(role === "tutor"
        ? []
        : role === "parent"
          ? [["My Children", "/parent/children"]]
          : [["Learners", "/learners"]]),
      ["Account settings", "/account"],
      ["Support requests", "/support"],
    ]) {
      await page
        .locator(".workspace-sidebar")
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(page).toHaveURL(target);
      await expect(page.locator(".workspace-account bdi")).toBeVisible();
      await expect(page.locator(".workspace-current")).toHaveText(title);
    }
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hold = async (route: Route) => {
      await gate;
      await route.continue().catch(() => {});
    };
    await page.route("**/api/auth/get-session**", hold);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("learli:account-updated")),
    );
    // The same user/session keeps its name and links during the refresh.
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    await expect(
      page.locator('.workspace-sidebar nav[aria-label$="work areas"]'),
    ).toHaveCount(1);
    await expect(page.locator(".workspace-current")).toHaveText(title);
    release();
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    await expect(page.locator(".workspace-current")).toHaveText(title);
    await page.unroute("**/api/auth/get-session**", hold);
  }
});

test("native account entry with one grant and current revocation remain safe", async ({
  page,
}) => {
  const actor = await signIn(page, ["tutor"]);
  await page.goto("/tutor");
  await expect(page.locator(".workspace-account bdi")).toBeVisible();
  await page
    .getByRole("button", { name: "Account Workspace test account" })
    .click();
  await page
    .locator(".header-account-panel")
    .getByRole("link", { name: "Account settings" })
    .click();
  await expect(page).toHaveURL("/account");
  await expect(page.locator(".workspace-account bdi")).toBeVisible();
  await expect(page.locator(".workspace-current")).toHaveText(
    "Tutor workspace",
  );
  await owner.pool.query("DELETE FROM user_roles WHERE user_id=$1", [actor.id]);
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Support requests" })
    .click();
  await expect(page).toHaveURL("/support");
  await expect(page.locator(".workspace-account bdi")).toBeVisible();
  await expect(page.getByText("No workspace assigned.")).toBeVisible();
  await expect(
    page.locator('.workspace-sidebar nav[aria-label$="work areas"]'),
  ).toHaveCount(0);
  expect((await page.request.get("/api/tutor/availability")).status()).toBe(
    403,
  );
});

test("cross-tab signout clears shell identity and grants, and a changed account cannot reuse them", async ({
  page,
  context,
}) => {
  const actor = await signIn(page, ["tutor"]);
  await page.goto("/tutor");
  await expect(page.locator(".workspace-account bdi")).toBeVisible();
  const other = await context.newPage();
  await other.goto("/account");
  await other
    .getByRole("button", { name: "Account Workspace test account" })
    .click();
  await other
    .locator(".header-account-panel")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(other).toHaveURL("/sign-in");
  // Settled identity loss replaces the entire private document, including its
  // inline page bootstrap, rather than retaining a signed-out shell.
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.locator(".workspace-account bdi")).toHaveCount(0);
  await expect(
    page.locator('.workspace-sidebar nav[aria-label$="work areas"]'),
  ).toHaveCount(0);
  expect((await page.request.get(`/api/account/${actor.id}`)).status()).toBe(
    401,
  );
  await signIn(other, ["parent"], "Replacement parent");
  await page.goto("/account");
  await expect(page).toHaveURL("/account");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("learli:account-updated")),
  );
  await expect(page.locator(".workspace-account bdi")).toHaveText(
    "Replacement parent",
  );
  await expect(page.locator(".workspace-current")).toHaveText(
    "Parent workspace",
  );
  await expect(
    page.getByText("Workspace test account", { exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get(`/api/account/${actor.id}`)).status()).toBe(
    404,
  );
  await other.close();
});

for (const [role, scope] of [
  ["parent", "guardian"],
  ["student", "student"],
  ["tutor", "tutor"],
]) {
  test(`${role} shared booking scope and unavailable-detail return retain the active section`, async ({
    page,
  }) => {
    await signIn(page, [role]);
    await page.goto(`/bookings/${randomUUID()}?scope=${scope}`);
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    const nav = page.locator(
      '.workspace-sidebar nav[aria-label$="work areas"]',
    );
    await expect(
      nav.getByRole("link", { name: "Bookings", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (role === "parent")
      await expect(
        nav.getByRole("link", { name: "Parent Dashboard", exact: true }),
      ).not.toHaveAttribute("aria-current", "page");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Go to your bookings", exact: true })
      .click();
    await expect(page).toHaveURL(`/bookings?scope=${scope}`);
    await expect(page.locator(".workspace-account bdi")).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Bookings", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (role === "parent")
      await expect(
        nav.getByRole("link", { name: "Parent Dashboard", exact: true }),
      ).not.toHaveAttribute("aria-current", "page");
    await expect(page.locator(".workspace-current")).toHaveText(
      `${role[0].toUpperCase() + role.slice(1)} workspace`,
    );
  });
}
