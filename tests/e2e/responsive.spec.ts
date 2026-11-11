import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
import { familyLearner, familyReservation } from "../support/family-fixtures";

// Every route, as the role that can open it, at every supported width: no
// page may scroll sideways, and nothing may sit outside the viewport. Long
// synthetic names stress wrapping. RESPONSIVE_EVIDENCE=<dir> also writes the
// full report and screenshots at the key widths for review.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "default" });

const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const origin = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = "Synthetic-responsive-passphrase-123";
const evidence = process.env.RESPONSIVE_EVIDENCE;
const widths = [
  320, 360, 375, 390, 414, 430, 640, 768, 820, 1024, 1280, 1440, 1920,
];
const shotWidths = new Set([320, 390, 768, 1440]);
const longName =
  "Alexandria Montgomery Fernández-Chen With A Very Long Synthetic Family Name";

type Finding = {
  role: string;
  route: string;
  width: number;
  overflow: number;
  offenders: string[];
  smallTargets: string[];
};
const findings: Finding[] = [];

test.beforeEach(async () => {
  await owner.pool.query("DELETE FROM rate_limit");
});
test.afterAll(async () => {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(evidence, "responsive-report.json"),
      JSON.stringify(findings, null, 2),
    );
  }
  await owner.pool.end();
});

async function signIn(page: Page, roles: string[], name = longName) {
  const email = `responsive-${randomUUID()}@learli.test`;
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
  return id;
}

async function tutorProfile(userId: string) {
  const profile = await owner.pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic mathematics and science support for every learner level','Synthetic profile only. A long biography that keeps going so the page has to wrap it properly on a narrow phone screen without spilling past the edge.','Synthetic fixture only.','Asia/Manila','approved') RETURNING id,slug",
    [userId, `responsive-${randomUUID()}`],
  );
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','middle_school','high_school','college_support']::text[] FROM subjects WHERE slug IN ('math','science','english')",
    [profile.rows[0].id],
  );
  return profile.rows[0] as { id: string; slug: string };
}

/** Measures the current layout; reports only real problems. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
      return `${el.tagName.toLowerCase()}${id}${cls} "${text.slice(0, 40)}"`;
    };
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const style = getComputedStyle(p);
        if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX))
          return p !== document.body && p !== document.documentElement;
      }
      return false;
    };
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        box.width > 0 &&
        box.height > 0 &&
        !el.closest('[aria-hidden="true"],[hidden],dialog:not([open])')
      );
    };
    const offenders: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || clipped(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.right > vw + 1 || box.left < -1) {
        // Report the outermost offender only.
        const parent = el.parentElement;
        if (parent) {
          const p = parent.getBoundingClientRect();
          if ((p.right > vw + 1 || p.left < -1) && !clipped(parent)) continue;
        }
        offenders.push(describe(el));
      }
    }
    // WCAG 2.2 target size: 24px minimum, except links inline in text.
    const smallTargets: string[] = [];
    for (const el of document.querySelectorAll(
      'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"]',
    )) {
      if (!visible(el)) continue;
      const box = el.getBoundingClientRect();
      const inline =
        el.tagName === "A" &&
        getComputedStyle(el).display === "inline" &&
        !!el.parentElement?.closest("p,li,dd,td,label,legend,span");
      if (inline) continue;
      if (
        (el as HTMLInputElement).type === "radio" ||
        (el as HTMLInputElement).type === "checkbox"
      ) {
        const label = el.closest("label");
        if (label && label.getBoundingClientRect().height >= 24) continue;
      }
      if (box.width < 24 || box.height < 24) smallTargets.push(describe(el));
    }
    return { overflow, offenders: offenders.slice(0, 8), smallTargets };
  });
}

async function audit(page: Page, role: string, routes: string[]) {
  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(route);
    expect(response?.status(), `${role} ${route}`).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    for (const width of widths) {
      await page.setViewportSize({
        width,
        height: width < 640 ? 844 : width < 1280 ? 1024 : 900,
      });
      await page.waitForTimeout(120);
      const result = await measure(page);
      findings.push({ role, route, width, ...result });
      if (evidence && shotWidths.has(width)) {
        const dir = path.join(evidence, role);
        await mkdir(dir, { recursive: true });
        await page.screenshot({
          path: path.join(
            dir,
            `${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
}

function problems(role: string) {
  return findings
    .filter((f) => f.role === role && (f.overflow > 0 || f.offenders.length))
    .map(
      (f) =>
        `${f.route} @${f.width}px overflow=${f.overflow} ${f.offenders.join(" | ")}`,
    );
}

test("public and sign-in pages fit every width", async ({ page }) => {
  test.setTimeout(600_000);
  const tutor = await tutorProfile(
    await signIn(page, ["tutor"], "Synthetic Public Tutor With Long Name"),
  );
  await page.context().clearCookies();
  await audit(page, "public", [
    "/",
    "/tutors",
    `/tutors/${tutor.slug}`,
    "/subjects",
    "/get-matched",
    "/get-matched?level=college_support&subject=science&timezone=UTC&when=any",
    "/how-it-works",
    "/become-a-tutor",
    "/contact",
    "/report-a-concern",
    "/privacy",
    "/terms",
    "/cancellations",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/verify-email",
    "/a-page-that-does-not-exist",
  ]);
  expect(problems("public")).toEqual([]);
});

test("parent workspace fits every width", async ({ page }) => {
  test.setTimeout(600_000);
  const parent = await signIn(page, ["parent"]);
  const child = await familyLearner(
    owner.pool,
    parent,
    "guardian",
    "Synthetic Zoë With A Long Private Learner Label",
  );
  const tutor = await tutorProfile(
    await (async () => {
      const id = randomUUID();
      await owner.pool.query(
        'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
        [
          id,
          "Synthetic María With A Long Tutor Display Name",
          `t-${id}@learli.test`,
        ],
      );
      await owner.pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [
        id,
      ]);
      await owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')",
        [id],
      );
      return id;
    })(),
  );
  const booking = await familyReservation(owner.pool, {
    learnerId: child,
    actorId: parent,
    tutorId: tutor.id,
  });
  await familyReservation(owner.pool, {
    learnerId: child,
    actorId: parent,
    tutorId: tutor.id,
    expired: true,
    startMinutes: 600,
  });
  await audit(page, "parent", [
    "/parent",
    "/parent/profile",
    "/parent/children",
    "/parent/children/new",
    `/parent/children/${child}`,
    "/parent/onboarding",
    "/bookings?scope=guardian",
    `/bookings/${booking}?scope=guardian`,
    `/bookings/${booking}/reschedule?scope=guardian`,
    "/bookings/new?scope=guardian",
    "/account",
    "/account/email",
    "/account/sessions",
    "/support",
    "/safeguarding/report",
    // Public pages with a signed-in header.
    "/",
    "/tutors",
  ]);
  expect(problems("parent")).toEqual([]);
});

test("student workspace fits every width", async ({ page }) => {
  test.setTimeout(600_000);
  const student = await signIn(page, ["student"]);
  const learner = await familyLearner(
    owner.pool,
    student,
    "self",
    "Synthetic College Learner With A Long Self-Managed Name",
  );
  await audit(page, "student", [
    "/student",
    "/student/onboarding",
    "/learners",
    "/learners/new",
    `/learners/${learner}`,
    "/bookings?scope=student",
    "/bookings/new?scope=student",
    "/account",
  ]);
  expect(problems("student")).toEqual([]);
});

test("tutor workspace fits every width", async ({ page }) => {
  test.setTimeout(600_000);
  const tutorUser = await signIn(page, ["tutor"]);
  const tutor = await tutorProfile(tutorUser);
  const parentId = randomUUID();
  await owner.pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [parentId, "Synthetic Parent", `p-${parentId}@learli.test`],
  );
  const child = await familyLearner(
    owner.pool,
    parentId,
    "guardian",
    "Synthetic Learner With A Very Long Display Name For Wrapping",
  );
  const booking = await familyReservation(owner.pool, {
    learnerId: child,
    actorId: parentId,
    tutorId: tutor.id,
  });
  await audit(page, "tutor", [
    "/tutor",
    "/tutor/availability",
    "/tutor/time-off",
    "/tutor/profile",
    "/tutor/screening",
    "/tutor/meetings",
    `/bookings/${booking}?scope=tutor`,
    "/account",
    "/account/security",
  ]);
  expect(problems("tutor")).toEqual([]);
});

test("admin workspace fits every width", async ({ page, context }) => {
  test.setTimeout(900_000);
  await signIn(page, ["admin"]);
  await enrollBrowserAdmin(context, password);
  const tutorUser = randomUUID();
  await owner.pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [
      tutorUser,
      "Synthetic Reviewed Tutor With A Long Display Name",
      `a-${tutorUser}@learli.test`,
    ],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [
    tutorUser,
  ]);
  const tutor = await tutorProfile(tutorUser);
  await audit(page, "admin", [
    "/admin",
    "/admin/tutors",
    `/admin/tutors/${tutor.id}`,
    "/admin/subjects",
    "/admin/accounts",
    `/admin/accounts/${tutorUser}`,
    "/admin/bookings",
    "/admin/requests",
    "/admin/reviews",
    "/admin/publication-reviews",
    "/admin/learner-admission",
    "/admin/safeguarding",
    "/admin/support",
    "/admin/support/dispatch",
    "/account",
    "/account/security",
  ]);
  expect(problems("admin")).toEqual([]);
});

test("workspace dock and its menu sheet work on phones and tablets", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await tutorProfile(await signIn(page, ["tutor"]));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 1024 });
    await page.goto("/tutor/availability");
    const dock = page.getByRole("navigation", { name: "Workspace shortcuts" });
    const menu = page.getByRole("button", { name: "Workspace menu" });
    if (width >= 1024) {
      await expect(dock).toBeHidden();
      continue;
    }
    // Three destinations named as in the sidebar, then Menu.
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link")).toHaveText([
      /Bookings/,
      /Availability/,
      /Time off/,
    ]);
    await expect(
      dock.getByRole("link", { name: "Availability", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const box = (await dock.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    // The page's foot stays reachable above the dock.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const main = (await page.getByRole("main").boundingBox())!;
    const lastInMain = await page
      .getByRole("main")
      .locator("button, a, input, select")
      .last()
      .boundingBox();
    if (lastInMain)
      expect(lastInMain.y + lastInMain.height).toBeLessThanOrEqual(
        (await dock.boundingBox())!.y,
      );
    expect(main.width).toBeGreaterThan(0);
    if (evidence) {
      await mkdir(path.join(evidence, "dock"), { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(evidence, "dock", `closed-${width}.png`),
      });
    }
    // Menu opens every destination as a sheet above the dock.
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const sheet = page.locator(".workspace-sidebar");
    await expect(sheet).toBeVisible();
    const sheetBox = (await sheet.boundingBox())!;
    expect(sheetBox.y).toBeGreaterThanOrEqual(0);
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(
      (await dock.boundingBox())!.y,
    );
    // Only Menu is filled while open; the page stays current for assistive
    // technology and is marked inside the sheet.
    const current = dock.getByRole("link", {
      name: "Availability",
      exact: true,
    });
    await expect(current).toHaveAttribute("aria-current", "page");
    expect(
      await current.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    // Focus moves into the sheet, to its first link.
    await expect(sheet.locator("a, summary").first()).toBeFocused();
    if (evidence)
      await page.screenshot({
        path: path.join(evidence, "dock", `open-${width}.png`),
      });
    // A tap outside closes it; so does Escape, returning focus to Menu.
    await page.mouse.click(5, 5);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    // A destination in the sheet navigates and closes it.
    await menu.click();
    await sheet.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/tutor\/profile$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
});

test("every workspace role has its own dock", async ({ page, context }) => {
  test.setTimeout(240_000);
  const roles: [role: string, path: string, items: RegExp[]][] = [
    // The third item depends on the deployment: Book where booking is on,
    // otherwise the next destination (Children).
    ["parent", "/parent", [/Dashboard/, /Bookings/, /Book|Children/]],
    ["student", "/student", [/Bookings/, /Learners/]],
    ["admin", "/admin", [/Overview/]],
  ];
  for (const [role, route, items] of roles) {
    await context.clearCookies();
    await signIn(page, [role]);
    if (role === "admin") await enrollBrowserAdmin(context, password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const dock = page.getByRole("navigation", { name: "Workspace shortcuts" });
    await expect(dock).toBeVisible();
    const links = dock.getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(items.length);
    expect(await links.count()).toBeLessThanOrEqual(3);
    for (const [index, item] of items.entries())
      await expect(links.nth(index)).toHaveText(item);
    await expect(links.first()).toHaveAttribute("aria-current", "page");
    await expect(
      dock.getByRole("button", { name: "Workspace menu" }),
    ).toBeVisible();
    if (evidence) {
      await mkdir(path.join(evidence, "dock"), { recursive: true });
      await page.screenshot({
        path: path.join(evidence, "dock", `${role}-390.png`),
      });
    }
  }
});

test("account pass opens inside the viewport at every width", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await tutorProfile(await signIn(page, ["tutor"], "Test tutor"));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
    await page.goto("/tutor");
    const trigger = page.getByRole("button", { name: "Account Test tutor" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const pass = page.locator(".account-pass");
    await expect(pass).toBeVisible();
    await expect(pass.getByText("Tutor", { exact: true })).toBeVisible();
    await expect(
      pass.getByRole("button", { name: "Copy email" }),
    ).toBeVisible();
    const box = (await pass.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (evidence) {
      await mkdir(path.join(evidence, "pass"), { recursive: true });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(evidence, "pass", `pass-${width}.png`),
      });
    }
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  // The public header opens the same pass, without a workspace role.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Account Test tutor" });
    await trigger.click();
    const pass = page.locator(".account-pass");
    await expect(pass).toBeVisible();
    const box = (await pass.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    if (evidence) {
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(evidence, "pass", `public-${width}.png`),
      });
    }
    await page.keyboard.press("Escape");
  }
});
