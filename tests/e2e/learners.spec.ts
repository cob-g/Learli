import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";

// Only synthetic data. Auth cookies/passwords are never captured in traces.
test.use({ trace: "off", screenshot: "off" });
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-browser-learner-passphrase-123";
async function verificationMail(email: string) {
  const mailbox = localMailbox("test");
  for (const file of (await readdir(mailbox))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(mailbox, file), "utf8"),
    ) as LocalMessage;
    if (message.to === email && message.kind === "verification") return message;
  }
  throw new Error("Local verification capture was not created.");
}
async function actor(
  browser: Browser,
  role: "parent" | "student" | "tutor",
  profiles = 0,
) {
  const context = await browser.newContext({ baseURL });
  const email = `learner-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic test account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query(
    'UPDATE "user" SET email_verified = true WHERE id = $1',
    [id],
  );
  await owner.pool.query(
    "INSERT INTO user_roles (user_id, role) VALUES ($1,$2)",
    [id, role],
  );
  const signIn = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
  expect(signIn.status()).toBe(200);
  const ids: string[] = [];
  for (let ordinal = 0; ordinal < profiles; ordinal++) {
    const result = await owner.pool.query(
      "INSERT INTO learner_profiles (fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,'local_fixture',$2,$3,$4,$5,'Asia/Manila') RETURNING id",
      [
        randomUUID(),
        role === "student" ? "self" : "guardian",
        role === "student" ? id : null,
        `Synthetic private learner ${ordinal}`,
        role === "student" ? "college_support" : "elementary",
      ],
    );
    const learnerId = result.rows[0].id as string;
    if (role === "parent")
      await owner.pool.query(
        "INSERT INTO guardian_learner_links (guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
        [id, learnerId],
      );
    ids.push(learnerId);
  }
  return { context, page: await context.newPage(), id, ids };
}
async function accessible(page: Page) {
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
// Reset only synthetic test throttle counters; application rate limits stay enabled.
test.beforeEach(async () => {
  await owner.pool.query("UPDATE rate_limit SET count = 0");
});
test.afterAll(() => owner.pool.end());

test("new Parent registers, verifies locally, enrolls and saves a Grade 8 child through the UI", async ({
  page,
}) => {
  const email = `parent-child-journey-${randomUUID()}@learli.test`;
  await page.goto("/sign-up");
  await page
    .getByRole("radio", { name: "Parent or guardian", exact: true })
    .check();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fictional new parent");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Registration request received.",
  );
  const registered = await owner.pool.query<{
    id: string;
    email_verified: boolean;
  }>('SELECT id,email_verified FROM "user" WHERE email=$1', [email]);
  expect(registered.rowCount).toBe(1);
  const id = registered.rows[0].id;
  expect(registered.rows[0].email_verified).toBe(false);
  const roles = async () =>
    (
      await owner.pool.query<{ role: string }>(
        "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
        [id],
      )
    ).rows.map((row) => row.role);
  expect(await roles()).toEqual([]);
  await page.goto((await verificationMail(email)).url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(await roles()).toEqual([]);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/parent/onboarding");
  await page
    .getByRole("button", { name: "Continue as parent", exact: true })
    .click();
  await expect(page).toHaveURL("/parent");
  expect(await roles()).toEqual(["parent"]);
  expect(
    (
      await owner.pool.query(
        "SELECT learner_id FROM guardian_learner_links WHERE guardian_user_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(0);
  await page
    .getByRole("navigation", { name: "Parent work areas" })
    .getByRole("link", { name: "Parent Profile", exact: true })
    .click();
  await expect(page).toHaveURL("/parent/profile");
  await expect(
    page.getByText(`Registered email: ${email}`, { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fictional parent updated");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Account settings saved." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Fictional parent updated",
  );
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await page
    .getByRole("main")
    .getByRole("link", { name: "My Children", exact: true })
    .click();
  await expect(page).toHaveURL("/parent/children");
  await page.getByRole("link", { name: "Add Child", exact: true }).click();
  await expect(page).toHaveURL("/parent/children/new");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fictional Grade Eight Child");
  await page.getByLabel("Level", { exact: true }).selectOption("middle_school");
  await page.getByLabel("Grade (optional)", { exact: true }).selectOption("8");
  await page
    .getByRole("button", { name: "Save child profile", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Child profile saved for local testing." }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "My Children", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL("/parent/children");
  await expect(
    page.getByRole("heading", { name: "My Children", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Grade Eight Child",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Middle School · Grade 8", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Edit child profile for Fictional Grade Eight Child",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/parent\/children\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Edit child profile", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Grade (optional)", { exact: true }),
  ).toHaveValue("8");
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  expect(await roles()).toEqual(["parent"]);
  const created = await owner.pool.query<{
    grade: number;
    management: string;
    level: string;
  }>(
    "SELECT l.grade,l.management,l.level FROM learner_creation_events e JOIN learner_profiles l ON l.id=e.learner_id WHERE e.actor_user_id=$1",
    [id],
  );
  expect(created.rows).toEqual([
    { grade: 8, management: "guardian", level: "middle_school" },
  ]);
});

test("parent lists and edits authorized profiles with keyboard, responsive validation and error states", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent", 2);
  const page = parent.page;
  await page.goto("/parent");
  await page
    .getByRole("link", { name: "My Children", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("link", { name: /Edit child profile for/ }),
  ).toHaveCount(2);
  await page
    .getByRole("link", {
      name: "Edit child profile for Synthetic private learner 0",
    })
    .click();
  await expect(page).toHaveTitle("Edit child profile | Learli");
  const longName =
    "Synthetic Álex María With A Long Multiword Learner Display Name For Testing";
  await page.getByLabel("Display name", { exact: true }).fill(longName);
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page.getByRole("button", { name: "Save profile", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved" }),
  ).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    longName,
  );
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
    "high_school",
  );
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "America/New_York",
  );
  for (const [width, height] of [
    [390, 844],
    [320, 720],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading learner profiles…", { exact: true }),
    ).toHaveCount(0);
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`learner-form-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("Display name", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Enter a display name.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Profile could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeFocused();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic unsaved value");
  await page.route("**/api/learners/*", (route) => route.abort());
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Profile could not be saved" }),
  ).toContainText("Check your connection");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Synthetic unsaved value",
  );
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("learner-save-error.png"),
    fullPage: true,
  });
  await parent.context.close();
});

test("self learner needs no guardian and foreign records stay private", async ({
  browser,
}, info) => {
  const self = await actor(browser, "student", 1);
  const parent = await actor(browser, "parent", 1);
  const page = self.page;
  await page.goto("/student");
  await page.getByRole("link", { name: "Your learners", exact: true }).click();
  await page.getByRole("link", { name: /Edit profile for/ }).click();
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
    "college_support",
  );
  await expect(
    page.getByLabel("Level", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic independent learner");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved" }),
  ).toBeVisible();
  const own = await page.request.get(`/api/learners/${self.ids[0]}`);
  expect(own.headers()["cache-control"]).toContain("private, no-store");
  const html = await page.request.get(`/learners/${self.ids[0]}`);
  expect(html.headers()["cache-control"]).toContain("no-store");
  expect(
    (await html.text()).match(/<meta name="robots"[^>]+>/g)?.join(),
  ).toContain("noindex");
  await parent.page.goto(`/learners/${self.ids[0]}`);
  await expect(
    parent.page.getByRole("heading", { name: "Learner profile unavailable" }),
  ).toBeVisible();
  await expect(
    parent.page.getByText("Synthetic independent learner"),
  ).toHaveCount(0);
  expect(
    (
      await parent.page.request.patch(`/api/learners/${self.ids[0]}`, {
        headers: { origin: baseURL },
        data: {
          displayName: "Forged",
          level: "college_support",
          timezone: "UTC",
        },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/learners", {
        headers: { origin: baseURL },
        data: { learnerId: parent.ids[0] },
      })
    ).status(),
  ).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  const visitor = await anonymous.newPage();
  await visitor.goto(`/learners/${self.ids[0]}`);
  await expect(visitor).toHaveURL(/\/sign-in\?next=/);
  for (const route of ["/", "/tutors", "/subjects"])
    expect(await (await anonymous.request.get(route)).text()).not.toContain(
      "Synthetic independent learner",
    );
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("learner-unavailable.png"),
    fullPage: true,
  });
  await Promise.all([
    self.context.close(),
    parent.context.close(),
    anonymous.close(),
  ]);
});

test("empty profiles, wrong-role and suspended access are honest", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const tutor = await actor(browser, "tutor");
  await parent.page.goto("/learners");
  await expect(
    parent.page.getByRole("heading", { name: "No learner profiles available" }),
  ).toBeVisible();
  await parent.page.setViewportSize({ width: 390, height: 844 });
  await accessible(parent.page);
  await parent.page.screenshot({
    path: info.outputPath("learner-empty.png"),
    fullPage: true,
  });
  await tutor.page.goto("/learners");
  await expect(
    tutor.page.getByRole("heading", { name: "Learner profiles unavailable" }),
  ).toBeVisible();
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [parent.id],
  );
  await parent.page.reload();
  await expect(
    parent.page.getByRole("heading", { name: "Learner profiles unavailable" }),
  ).toBeVisible();
  await Promise.all([parent.context.close(), tutor.context.close()]);
});

test("Parent Profile to My Children saves Grade 8 without duplicates after commit uncertainty", async ({
  browser,
}, info) => {
  const parent = await actor(browser, "parent");
  const page = parent.page;
  await page.goto("/parent/profile");
  await expect(
    page.getByRole("heading", { name: "Parent Profile", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fictional parent profile");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Account settings saved." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Fictional parent profile",
  );
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await page
    .getByRole("main")
    .getByRole("link", { name: "My Children", exact: true })
    .click();
  let finishNavigation: () => void = () => {};
  const navigationGate = new Promise<void>((resolve) => {
    finishNavigation = resolve;
  });
  await page.route("**/parent/children/new**", async (route) => {
    const response = await route.fetch();
    await navigationGate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("link", { name: "Add Child", exact: true }).click();
    await expect(
      page.getByText("Loading learner profiles…", { exact: true }),
    ).toBeVisible();
    finishNavigation();
    await expect(page).toHaveTitle("Add Child | Learli");
  } finally {
    finishNavigation();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(
    page.getByText(/does not verify real consent, age or guardian identity/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save child profile", exact: true })
    .click();
  await expect(page.getByLabel("Display name", { exact: true })).toBeFocused();
  await expect(
    page.getByText("Choose a level.", { exact: true }),
  ).toBeVisible();
  const privateName =
    "Synthetic onboarding Álex With A Long Display Name For Local Testing";
  await page.getByLabel("Display name", { exact: true }).fill(privateName);
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page.getByLabel("Grade (optional)", { exact: true }).selectOption("8");
  for (const [width, height] of [
    [390, 844],
    [320, 720],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`creation-${width}.png`),
      fullPage: true,
    });
    expect(page.url()).not.toContain("displayName");
  }
  let intercept = true;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/learners", async (route) => {
    if (!intercept) {
      await route.continue();
      return;
    }
    intercept = false;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await gate;
    await route.abort();
  });
  const button = page.getByRole("button", {
    name: "Retry this request",
    exact: true,
  });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Saving child profile…", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await page.screenshot({
    path: info.outputPath("creation-pending.png"),
    fullPage: true,
  });
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not confirm creation" }),
  ).toBeFocused();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    privateName,
  );
  await page
    .getByRole("button", { name: "Retry this request", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Child profile saved for local testing." }),
  ).toBeFocused();
  const rows = await owner.pool.query(
    "SELECT e.learner_id,l.grade FROM learner_creation_events e JOIN learner_profiles l ON l.id=e.learner_id WHERE e.actor_user_id=$1",
    [parent.id],
  );
  expect(rows.rowCount).toBe(1);
  expect(rows.rows[0].grade).toBe(8);
  const id = rows.rows[0].learner_id as string;
  await page
    .getByRole("link", { name: "Edit child profile", exact: true })
    .click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    privateName,
  );
  await expect(
    page.getByLabel("Grade (optional)", { exact: true }),
  ).toHaveValue("8");
  await page.reload();
  await expect(
    page.getByLabel("Grade (optional)", { exact: true }),
  ).toHaveValue("8");
  await page
    .getByRole("main")
    .getByRole("link", { name: "My Children", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: privateName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("High School · Grade 8", { exact: true }),
  ).toBeVisible();
  const publicResponse = await parent.context.request.get("/tutors");
  expect(await publicResponse.text()).not.toContain(privateName);
  const privateResponse = await parent.context.request.get(
    "/parent/children/new",
  );
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  const html = await privateResponse.text();
  expect(html.match(/<title>[^<]+<\/title>/)?.[0]).not.toContain(privateName);
  expect(html).toContain("noindex");
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in/);
  expect(await page.content()).not.toContain(privateName);
  await page.goto("/parent/children");
  await expect(
    page.getByRole("heading", { name: privateName, exact: true }),
  ).toBeVisible();
  const signedOut = await parent.context.request.post("/api/auth/sign-out", {
    headers: { origin: baseURL },
    data: {},
  });
  expect(signedOut.status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(await page.content()).not.toContain(privateName);
  await page.goBack();
  await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  const visitor = await browser.newContext({ baseURL });
  expect((await visitor.request.get(`/api/learners/${id}`)).status()).toBe(401);
  await Promise.all([parent.context.close(), visitor.close()]);
});

test("local own College Support creation is singular and session loss denies mutation", async ({
  browser,
}) => {
  const self = await actor(browser, "student");
  const page = self.page;
  await page.goto("/learners/new");
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue(
    "college_support",
  );
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic own college");
  await page
    .getByRole("button", { name: "Create local learner", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Local learner created" }),
  ).toBeVisible();
  expect(
    (
      await owner.pool.query(
        "SELECT 1 FROM guardian_learner_links WHERE guardian_user_id=$1",
        [self.id],
      )
    ).rowCount,
  ).toBe(0);
  await page.goto("/learners/new");
  await expect(
    page.getByRole("heading", {
      name: "Your local profile already exists",
      exact: true,
    }),
  ).toBeVisible();
  const parent = await actor(browser, "parent");
  await parent.page.goto("/learners/new");
  await parent.page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic stale session");
  await parent.page
    .getByLabel("Level", { exact: true })
    .selectOption("elementary");
  await owner.pool.query('DELETE FROM "session" WHERE user_id=$1', [parent.id]);
  await parent.page
    .getByRole("button", { name: "Create local learner", exact: true })
    .click();
  await expect(
    parent.page
      .getByRole("alert")
      .filter({ hasText: "Learner could not be created" }),
  ).toBeFocused();
  expect(
    (
      await owner.pool.query(
        "SELECT 1 FROM learner_creation_events WHERE actor_user_id=$1",
        [parent.id],
      )
    ).rowCount,
  ).toBe(0);
  await Promise.all([self.context.close(), parent.context.close()]);
});

test("parent child routes deny another family, non-parent roles and logged-out visits", async ({
  browser,
}) => {
  const parent = await actor(browser, "parent", 1);
  const otherParent = await actor(browser, "parent");
  const student = await actor(browser, "student");
  const tutor = await actor(browser, "tutor");
  const privateName = "Synthetic private learner 0";
  try {
    await otherParent.page.goto(`/parent/children/${parent.ids[0]}`);
    await expect(
      otherParent.page.getByRole("heading", {
        name: "Child profile unavailable",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      otherParent.page.getByText(privateName, { exact: true }),
    ).toHaveCount(0);
    for (const denied of [student, tutor]) {
      for (const [path, title] of [
        ["/parent/profile", "Parent profile unavailable"],
        ["/parent/children", "Children unavailable"],
        ["/parent/children/new", "Add Child unavailable"],
      ]) {
        await denied.page.goto(path);
        await expect(
          denied.page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
        await expect(
          denied.page.getByLabel("Display name", { exact: true }),
        ).toHaveCount(0);
        await expect(
          denied.page.getByLabel("Grade (optional)", { exact: true }),
        ).toHaveCount(0);
      }
    }
    await parent.context.request.post("/api/auth/sign-out", {
      headers: { origin: baseURL },
      data: {},
    });
    for (const path of [
      "/parent/profile",
      "/parent/children",
      "/parent/children/new",
      `/parent/children/${parent.ids[0]}`,
    ]) {
      await parent.page.goto(path);
      await expect(parent.page).toHaveURL(/\/sign-in\?next=/);
      await expect(
        parent.page.getByText(privateName, { exact: true }),
      ).toHaveCount(0);
    }
  } finally {
    await Promise.all([
      parent.context.close(),
      otherParent.context.close(),
      student.context.close(),
      tutor.context.close(),
    ]);
  }
});

test("unhydrated create form cannot submit private fields as a URL", async ({
  browser,
}) => {
  const parent = await actor(browser, "parent", 1);
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await parent.context.storageState(),
  });
  const page = await context.newPage();
  await page.goto("/learners");
  await expect(
    page.getByRole("heading", {
      name: "Synthetic private learner 0",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Edit profile for Synthetic private learner 0",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Display name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/JavaScript is required to edit this profile/),
  ).toBeVisible();
  expect(await page.locator("form").getAttribute("method")).toBe("post");
  await page.keyboard.press("Enter");
  expect(page.url()).not.toContain("displayName");
  await page.getByRole("link", { name: "Your learners", exact: true }).click();
  await page
    .getByRole("link", { name: "Create a local learner", exact: true })
    .click();
  await expect(
    page.getByText(
      /JavaScript is required to create a local demonstration profile/,
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Create local learner", exact: true }),
  ).toBeDisabled();
  expect(await page.locator("form").getAttribute("method")).toBe("post");
  await page.keyboard.press("Enter");
  expect(page.url()).toBe(`${baseURL}/learners/new`);
  expect(
    (
      await owner.pool.query(
        "SELECT 1 FROM learner_creation_events WHERE actor_user_id=$1",
        [parent.id],
      )
    ).rowCount,
  ).toBe(0);
  await Promise.all([context.close(), parent.context.close()]);
});
