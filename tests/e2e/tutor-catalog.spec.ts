import { provisionScreeningAssignment } from "../../src/features/tutor-screening/fixture-tooling";
import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
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

const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3100";
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
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  if (roles.includes("admin")) await enrollBrowserAdmin(context, password);
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
    admin.getByRole("button", { name: `Activate ${subjectName}`, exact: true }),
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
  const assignedProfile = (
    await owner.pool.query(
      'SELECT t.id FROM tutor_profiles t JOIN "user" u ON u.id=t.user_id WHERE u.name=$1',
      [tutorName],
    )
  ).rows[0].id;
  const assignedAdmin = (
    await (await admin.request.get("/api/auth/get-session")).json()
  ).user.id;
  await provisionScreeningAssignment(
    owner,
    assignedProfile,
    assignedAdmin,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
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

  // Signed out, the approved tutor is now discoverable everywhere.
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await visitor.setViewportSize({ width, height });
    await visitor.goto("/tutors");
    await expect(visitor.getByRole("status")).toHaveText("1 tutor");
    await expectAccessible(visitor);
    await visitor.screenshot({
      path: info.outputPath(`directory-${width}.png`),
      fullPage: true,
    });
  }
  await visitor.setViewportSize({ width: 1440, height: 900 });
  await visitor.getByLabel("Subject").selectOption("math");
  await visitor.getByLabel("Level").selectOption("high_school");
  await visitor.getByRole("button", { name: "Apply filters" }).click();
  await expect(visitor).toHaveURL("/tutors?subject=math&level=high_school");
  await expect(visitor.getByRole("heading", { name: tutorName })).toBeVisible();
  await visitor
    .getByRole("link", { name: "Remove filter: High School" })
    .click();
  await expect(visitor).toHaveURL("/tutors?subject=math");
  await visitor.goto("/tutors?subject=science");
  await expect(
    visitor.getByRole("heading", {
      name: "No tutors teach Science on Learli right now",
    }),
  ).toBeVisible();
  await visitor.goto("/tutors?subject=math&level=college_support");
  await expect(
    visitor.getByRole("heading", { name: "No tutors match these filters" }),
  ).toBeVisible();
  await visitor.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(visitor).toHaveURL("/tutors");

  // Guided matching reaches the same tutor by the same rule.
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 720],
  ]) {
    await visitor.setViewportSize({ width, height });
    await visitor.goto("/get-matched");
    await expect(visitor.getByText("Question 1 of 3")).toBeVisible();
    await expectAccessible(visitor);
  }
  await visitor.setViewportSize({ width: 1440, height: 900 });
  await visitor.getByLabel("High School").check();
  await visitor.getByRole("button", { name: "Continue" }).click();
  await expect(visitor).toHaveURL(
    /\/get-matched\?change=subject&level=high_school/,
  );
  await expect(visitor.getByText("Question 2 of 3")).toBeVisible();
  await expectAccessible(visitor);
  await visitor.getByRole("link", { name: "Back", exact: true }).click();
  await expect(visitor.getByLabel("High School")).toBeChecked();
  await visitor.getByRole("button", { name: "Continue" }).click();
  await visitor.getByLabel("Math", { exact: true }).check();
  await visitor.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(visitor.getByText("Question 3 of 3")).toBeVisible();
  await visitor.getByLabel("Your time zone").selectOption("Asia/Manila");
  await visitor.getByLabel("Any time", { exact: true }).check();
  // Owned synthetic schedule; matching now requires actual date-specific times.
  await owner.pool.query(
    'INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT id,day,0,1440 FROM tutor_profiles CROSS JOIN generate_series(1,7) day WHERE slug IN (SELECT slug FROM tutor_profiles JOIN "user" ON "user".id=tutor_profiles.user_id WHERE name=$1)',
    [tutorName],
  );
  await visitor.getByRole("button", { name: "Show matching tutors" }).click();
  await expect(visitor.getByRole("status")).toContainText(
    "1 tutor teaches Math at High School",
  );
  await expect(visitor.getByRole("heading", { name: tutorName })).toBeVisible();
  await expectAccessible(visitor);
  await visitor.screenshot({
    path: info.outputPath("match-results-1440.png"),
    fullPage: true,
  });
  await visitor.goto(
    "/get-matched?level=college_support&subject=math&timezone=UTC&when=any",
  );
  await expect(
    visitor.getByRole("heading", { name: "No tutors match your answers" }),
  ).toBeVisible();
  await expect(
    visitor.getByText("College Support · Math · Any time"),
  ).toBeVisible();
  await visitor.getByRole("link", { name: "Change answers" }).click();
  await expect(visitor.getByText("Question 3 of 3")).toBeVisible();
  await visitor.goto("/get-matched?level=phd");
  await expect(visitor.getByRole("main").getByRole("alert")).toHaveText(
    "Choose a level",
  );

  await visitor.goto("/subjects");
  await visitor.getByRole("link", { name: "Math, High School" }).click();
  await expect(visitor).toHaveURL("/tutors?subject=math&level=high_school");
  await expect(
    visitor.getByRole("link", { name: "Science, High School" }),
  ).toHaveCount(0);

  await visitor.goto("/");
  await expect(
    visitor.getByRole("heading", { name: "Tutors on Learli" }),
  ).toBeVisible();
  await expectAccessible(visitor);
  await visitor.screenshot({
    path: info.outputPath("home-1440.png"),
    fullPage: true,
  });
  await visitor.getByRole("search").getByLabel("Subject").selectOption("math");
  await visitor.getByRole("button", { name: "Find a tutor" }).click();
  await expect(visitor).toHaveURL(/\/tutors\?subject=math/);
  await visitor
    .getByRole("link", { name: `View profile: ${tutorName}` })
    .click();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    tutorName,
  );
  const profileUrl = visitor.url();
  await expect(visitor.getByText("Specialty: Algebra")).toBeVisible();
  await expect(
    visitor.getByText("Learli has not checked these details"),
  ).toBeVisible();
  await expect(
    visitor.getByRole("heading", { name: "Choose a time" }),
  ).toBeVisible();
  await expect(visitor.getByText(/Local simulation only/)).toBeVisible();
  // Public HTML carries no sign-in email; the selected zone belongs to the viewer.
  const html = await visitor.content();
  expect(html).not.toContain("@learli.test");
  await expect(visitor.getByLabel("Time zone", { exact: true })).toHaveValue(
    await visitor.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  );
  await visitor.setViewportSize({ width: 390, height: 844 });
  await expectAccessible(visitor);
  await visitor.screenshot({
    path: info.outputPath("public-profile-390.png"),
    fullPage: true,
  });
  await tutor.getByRole("link", { name: "View public profile" }).click();
  await expect(tutor).toHaveURL(
    (url) => url.pathname === new URL(profileUrl).pathname,
  );

  await admin.getByRole("button", { name: "Suspend tutor" }).click();
  await admin
    .getByRole("dialog", { name: "Suspend this tutor?" })
    .getByRole("button", { name: "Suspend tutor" })
    .click();
  await expect(admin.getByRole("status")).toHaveText("Tutor suspended.");
  // Suspension removes the tutor from every public page at once.
  expect((await visitor.goto(profileUrl))?.status()).toBe(404);
  await visitor.goto("/tutors");
  await expect(
    visitor.getByRole("heading", { name: "No tutors are listed right now" }),
  ).toBeVisible();
  await expect(visitor.getByRole("search")).toHaveCount(0);
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
