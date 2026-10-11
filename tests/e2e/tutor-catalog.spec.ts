import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";

// Never record auth cookies, passwords or verification tokens in traces.
test.use({ trace: "off", screenshot: "off" });
test.describe.configure({ mode: "serial" });

const baseURL = "http://127.0.0.1:3100";
const password = "Browser-synthetic-passphrase-123";
const run = randomUUID().slice(0, 8);
const tutorName = `Zoë Müller-Castañeda ${run}`;
const subjectName = `E2E Robotics ${run}`;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
type Session = Awaited<
  ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
>;
const sessions: Record<"tutor" | "admin" | "visitor", Session> = {} as never;

async function verificationUrl(email: string) {
  for (const file of (await readdir(localMailbox("test")))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()) {
    const capture = JSON.parse(
      await readFile(path.join(localMailbox("test"), file), "utf8"),
    ) as LocalMessage;
    if (capture.to === email && capture.kind === "verification")
      return capture.url;
  }
  throw new Error("Local mail capture was not created.");
}

/** Signs up through the real flow; roles come from trusted test-only setup. */
async function createSession(browser: Browser, name: string, roles: string[]) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const email = `catalog-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, name, password, callbackURL: "/sign-in" },
  });
  const { user } = await response.json();
  for (const role of roles)
    await owner.pool.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
      [user.id, role],
    );
  await page.goto(await verificationUrl(email));
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  const state = await context.storageState();
  await context.close();
  return state;
}
async function open(browser: Browser, who: keyof typeof sessions) {
  const context = await browser.newContext({
    baseURL,
    storageState: sessions[who],
  });
  return context.newPage();
}
async function expectAccessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test.beforeAll(async ({ browser }) => {
  await owner.pool.query("DELETE FROM rate_limit");
  sessions.tutor = await createSession(browser, tutorName, ["tutor"]);
  sessions.admin = await createSession(browser, `Admin ${run}`, ["admin"]);
  sessions.visitor = await createSession(browser, `Visitor ${run}`, []);
});
test.afterAll(async () => {
  await owner.pool.query("DELETE FROM subjects WHERE name = $1", [subjectName]);
  await owner.pool.end();
});

test("tutor and admin pages keep other accounts out", async ({
  browser,
  page,
}) => {
  for (const route of [
    "/tutor/profile",
    "/admin/tutors",
    "/admin/subjects",
    `/admin/tutors/${randomUUID()}`,
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  }
  const visitor = await open(browser, "visitor");
  await visitor.goto("/tutor/profile");
  await expect(
    visitor.getByRole("heading", { name: "Tutor profile unavailable" }),
  ).toBeVisible();
  const tutor = await open(browser, "tutor");
  for (const route of ["/admin/tutors", "/admin/subjects"]) {
    await tutor.goto(route);
    await expect(
      tutor.getByRole("heading", { name: "Workspace access unavailable" }),
    ).toBeVisible();
    await expect(
      tutor.getByRole("navigation", { name: "Admin work areas" }),
    ).toHaveCount(0);
  }
  await tutor.goto(`/admin/tutors/${randomUUID()}`);
  await expect(
    tutor.getByRole("heading", { name: "We can't find that application" }),
  ).toBeVisible();
  const forged = await tutor.request.post(
    `/api/admin/tutor-applications/${randomUUID()}`,
    { headers: { origin: baseURL }, data: { action: "approve" } },
  );
  expect(forged.status()).toBe(403);
  const admin = await open(browser, "admin");
  await admin.goto("/tutor/profile");
  await expect(
    admin.getByRole("heading", { name: "Tutor profile unavailable" }),
  ).toBeVisible();
});

test("an admin manages subjects and a deactivated subject leaves the tutor form", async ({
  browser,
}) => {
  const admin = await open(browser, "admin");
  const response = await admin.goto("/admin/subjects");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    admin.getByRole("heading", { name: "Subjects", level: 1 }),
  ).toBeVisible();
  for (const name of ["Math", "SAT", "Homework help"])
    await expect(admin.getByText(name, { exact: true })).toBeVisible();
  await admin.getByLabel("Subject name").fill(subjectName);
  await admin.getByRole("button", { name: "Add subject" }).click();
  await expect(admin.getByRole("status")).toHaveText("Subject added.");
  await expect(admin.getByText(subjectName, { exact: true })).toBeVisible();
  await admin.getByLabel("Subject name").fill(subjectName.toUpperCase());
  await admin.getByRole("button", { name: "Add subject" }).click();
  await expect(admin.getByRole("main").getByRole("alert")).toContainText(
    "already exists",
  );
  await expectAccessible(admin);

  const tutor = await open(browser, "tutor");
  await tutor.goto("/tutor/profile");
  await expect(tutor.getByRole("group", { name: subjectName })).toBeVisible();
  await admin
    .getByRole("button", { name: `Deactivate ${subjectName}` })
    .click();
  await expect(
    admin.getByRole("button", { name: `Activate ${subjectName}` }),
  ).toBeVisible();
  await tutor.reload();
  await expect(tutor.getByRole("group", { name: "Math" })).toBeVisible();
  await expect(tutor.getByRole("group", { name: subjectName })).toHaveCount(0);
});

test("a tutor applies, an admin decides, and each sees the stored result", async ({
  browser,
}, info) => {
  const tutor = await open(browser, "tutor");
  await tutor.goto("/tutor");
  await expect(
    tutor.getByRole("heading", { name: "Your profile is not public yet" }),
  ).toBeVisible();
  await tutor.getByRole("link", { name: "Edit profile" }).click();
  await expect(tutor).toHaveURL("/tutor/profile");
  await tutor.getByLabel("Headline").fill("Synthetic algebra tutor");
  await tutor
    .getByLabel("Introduction")
    .fill("Fictional introduction.\nWritten by an automated browser test.");
  await tutor.getByLabel("Teaching background").fill("Fictional background.");
  await tutor.getByLabel("Time zone").selectOption("Asia/Manila");
  await expect(
    tutor.getByLabel("Time zone").locator("option:checked"),
  ).toHaveText("Manila (GMT+8)");
  // No subject chosen yet: the form says what is missing and moves focus there.
  await tutor.getByRole("button", { name: "Submit application" }).click();
  await expect(tutor.getByText("Choose at least one subject")).toBeVisible();
  const math = tutor.getByRole("group", { name: "Math" });
  // Focus lands on the first checkbox of the group; subjects sort by name.
  await expect(
    tutor.getByRole("group", { name: "English" }).getByLabel("Elementary"),
  ).toBeFocused();
  await math.getByLabel("Elementary").focus();
  await tutor.keyboard.press("Space");
  await math.getByLabel("High School").check();
  await tutor.getByLabel("Math specialty").fill("Algebra");
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await tutor.setViewportSize({ width, height });
    await expectAccessible(tutor);
    await tutor.screenshot({
      path: info.outputPath(`tutor-profile-${width}.png`),
      fullPage: true,
    });
  }
  await tutor.getByRole("button", { name: "Submit application" }).click();
  await expect(tutor.getByRole("status")).toHaveText("Application submitted.");
  await expect(
    tutor.getByRole("heading", {
      name: "Learli is reviewing your application",
    }),
  ).toBeVisible();
  await expect(
    tutor.getByRole("button", { name: "Save profile" }),
  ).toBeVisible();
  await tutor.reload();
  await expect(tutor.getByLabel("Headline")).toHaveValue(
    "Synthetic algebra tutor",
  );
  await expect(math.getByLabel("Elementary")).toBeChecked();
  await expect(math.getByLabel("Middle School")).not.toBeChecked();

  const admin = await open(browser, "admin");
  await admin.goto("/admin");
  await admin.getByRole("link", { name: "Tutor review queue" }).click();
  await expect(
    admin.getByRole("link", { name: "Tutor review queue" }),
  ).toHaveAttribute("aria-current", "page");
  await expectAccessible(admin);
  await admin.setViewportSize({ width: 320, height: 720 });
  await expectAccessible(admin);
  await admin.screenshot({
    path: info.outputPath("review-queue-320.png"),
    fullPage: true,
  });
  await admin.setViewportSize({ width: 1440, height: 900 });
  await admin.screenshot({
    path: info.outputPath("review-queue-1440.png"),
    fullPage: true,
  });
  await admin.getByRole("link", { name: tutorName }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText(tutorName);
  await expect(admin.getByText("Specialty: Algebra")).toBeVisible();
  await expect(admin.getByText("Elementary · High School")).toBeVisible();
  await expect(admin.getByText("Manila (GMT+8)")).toBeVisible();
  // The tutor's sign-in address is not part of a review.
  await expect(admin.getByText("@learli.test")).toHaveCount(0);
  await expectAccessible(admin);

  const approve = admin.getByRole("button", { name: "Approve application" });
  await approve.click();
  const dialog = admin.getByRole("dialog", {
    name: "Approve this application?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(tutorName);
  await expectAccessible(admin);
  await admin.screenshot({ path: info.outputPath("review-dialog-1440.png") });
  await admin.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(approve).toBeFocused();
  await approve.click();
  await dialog.getByRole("button", { name: "Approve application" }).click();
  await expect(admin.getByRole("status")).toHaveText("Application approved.");
  await expect(admin.getByRole("status")).toBeFocused();
  await expect(admin.getByText("Approved", { exact: true })).toBeVisible();
  await expect(
    admin.getByRole("button", { name: "Approve application" }),
  ).toHaveCount(0);
  await admin.setViewportSize({ width: 390, height: 844 });
  await expectAccessible(admin);
  await admin.screenshot({
    path: info.outputPath("review-detail-390.png"),
    fullPage: true,
  });

  await tutor.goto("/tutor");
  await expect(
    tutor.getByRole("heading", { name: "Your application is approved" }),
  ).toBeVisible();
  await expectAccessible(tutor);

  await admin.getByRole("button", { name: "Suspend tutor" }).click();
  await admin
    .getByRole("dialog", { name: "Suspend this tutor?" })
    .getByRole("button", { name: "Suspend tutor" })
    .click();
  await expect(admin.getByRole("status")).toHaveText("Tutor suspended.");
  await tutor.goto("/tutor/profile");
  await expect(
    tutor.getByRole("heading", { name: "Your tutor profile is suspended" }),
  ).toBeVisible();
  await expect(tutor.getByText("Synthetic algebra tutor")).toBeVisible();
  await expect(tutor.getByRole("form")).toHaveCount(0);
  await expectAccessible(tutor);
  const mathId = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug = 'math'")
  ).rows[0].id;
  const blocked = await tutor.request.put("/api/tutor/profile", {
    headers: { origin: baseURL },
    data: {
      headline: "Edited while suspended",
      bio: "Fictional.",
      teachingBackground: "Fictional.",
      timezone: "UTC",
      offerings: [{ subjectId: mathId, levels: ["elementary"] }],
    },
  });
  expect(blocked.status()).toBe(409);
});

test("a signed-in account starts a tutor application from the public page", async ({
  browser,
  page,
}) => {
  await page.goto("/become-a-tutor");
  await expect(
    page.getByRole("heading", { name: "Become a tutor", level: 1 }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Start tutor application" }).click();
  await expect(page).toHaveURL("/sign-in?next=%2Fbecome-a-tutor");

  const visitor = await open(browser, "visitor");
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await visitor.setViewportSize({ width, height });
    await visitor.goto("/become-a-tutor");
    await expectAccessible(visitor);
  }
  await visitor
    .getByRole("button", { name: "Start tutor application" })
    .click();
  await expect(visitor).toHaveURL("/tutor/profile");
  await expect(
    visitor.getByRole("heading", { name: "Your profile is not public yet" }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "Submit application" }),
  ).toBeVisible();
  // The tutor role opens the tutor's own pages only.
  await visitor.goto("/admin/tutors");
  await expect(
    visitor.getByRole("heading", { name: "Workspace access unavailable" }),
  ).toBeVisible();
});
