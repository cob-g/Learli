import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { bookingSelectionHref } from "../../src/features/bookings/selection";
import { publicProfileHref } from "../../src/features/public-availability/links";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import { startAdmissionMirror } from "../support/learner-admission-mirror";
import { totpCode } from "../support/admin-mfa";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(120000);
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
  normal = process.env.APP_URL!,
  password = "Synthetic-admission-browser-passphrase-123";
let mirror: Awaited<ReturnType<typeof startAdmissionMirror>>;
const contexts: BrowserContext[] = [];
const secrets: string[] = [];
const privatePatterns: string[] = [];
async function mailbox(email: string, origin: string) {
  const directory = path.join(
    origin === normal ? process.cwd() : mirror.root,
    ".local/mail/test",
  );
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith(".json"))
    .reverse()) {
    const notice = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as { to: string; kind: string; url: string };
    if (notice.to === email && notice.kind === "verification")
      return notice.url;
  }
  throw new Error("Expected own captured verification.");
}
async function signup(
  browser: Browser,
  origin = mirror.origin,
  next = "/account",
  admin = false,
) {
  await owner.pool.query(
    "UPDATE rate_limit SET count=0 WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/sign-in/email%' OR key LIKE '%/two-factor/%'",
  );
  const context = await browser.newContext({ baseURL: origin }),
    page = await context.newPage();
  let hydrationErrors = 0;
  page.on("pageerror", (error) => {
    if (/hydration|hydrated|react.*418/i.test(error.message)) hydrationErrors++;
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|hydrated|react.*418/i.test(message.text())
    )
      hydrationErrors++;
  });
  contexts.push(context);
  const email = `admission-${randomUUID()}@learli.test`;
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic admission account");
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create test account", exact: true })
    .click();
  await expect(
    page.getByText(/a verification message is available/),
  ).toBeVisible();
  await page.goto(await mailbox(email, origin));
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const id = (
    await owner.pool.query('SELECT id FROM "user" WHERE email=$1', [email])
  ).rows[0].id as string;
  if (admin)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [id],
    );
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(next.split("?")[0].replaceAll("/", "\\/")),
  );
  expect(hydrationErrors).toBe(0);
  return { context, page, email, id };
}
async function enroll(page: Page) {
  await page.goto("/account/security");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  await expect(page.locator("[data-mfa-secret]").first()).toBeVisible();
  const secret = (await page
    .locator("[data-mfa-secret]")
    .first()
    .textContent())!;
  secrets.push(secret);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
  return secret;
}
async function accessible(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
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
  const heights = await page
    .locator(
      'button:not([disabled]),input:not([type="checkbox"]):not([type="hidden"]),select',
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => node.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height >= 44)).toBe(true);
}
async function submitIntake(page: Page, name: string, self = false) {
  if (self) await page.getByLabel("Request type").selectOption("self");
  await page.getByLabel("Fictional display name").fill(name);
  await page
    .getByRole("button", { name: "Request admission review", exact: true })
    .click();
  await expect(page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
  privatePatterns.push(name);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
async function record(page: Page, check: string) {
  await page.getByLabel("Review check").selectOption(check);
  const reference = `browser:${randomUUID()}`;
  privatePatterns.push(reference);
  await page.getByLabel("Opaque synthetic reference").fill(reference);
  await page
    .getByRole("button", { name: "Record evidence", exact: true })
    .click();
  await expect(page.getByText(reference, { exact: false })).toBeVisible();
}
async function approve(page: Page) {
  await page
    .getByRole("button", { name: "Save admission decision", exact: true })
    .click();
  await expect(
    page.getByText("Status: authorized.", { exact: true }),
  ).toBeVisible();
}
async function publicTutor() {
  const user = randomUUID(),
    slug = `w5-preview-${randomUUID()}`;
  await owner.pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES($1,$2,$3,true)',
    [user, "Synthetic admission preview tutor", `w5-tutor-${user}@learli.test`],
  );
  await owner.pool.query("INSERT INTO user_access(user_id) VALUES($1)", [user]);
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
    [user],
  );
  const id = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Academic support','Synthetic local preview fixture.','Synthetic local fixture.','UTC','approved') RETURNING id",
      [user, slug],
    )
  ).rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math'",
    [id],
  );
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,480,1200)",
      [id, day],
    );
  return { id, slug };
}

test.beforeAll(async () => {
  test.setTimeout(180000);
  const cap = await provisionAdmissionPolicy(owner.pool);
  mirror = await startAdmissionMirror(process.cwd(), cap.policyId);
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
  await mirror?.stop();
  await owner.pool.end();
});
test("shipped disabled intake collects no child fields and refuses malformed POST without payload echoes", async ({
  browser,
}) => {
  const actor = await signup(browser, normal, "/learner-admission/new");
  await expect(
    actor.page.getByText("No learner details are collected.", { exact: false }),
  ).toBeVisible();
  expect(await actor.page.locator("input,select").count()).toBe(0);
  const result = await actor.context.request.post("/api/learner-admission", {
    headers: { origin: normal, "content-type": "application/json" },
    data: "{malformed private child",
  });
  expect(result.status()).toBe(503);
  expect(await result.text()).not.toContain("private child");
  await accessible(actor.page, 320);
  const noJs = await browser.newContext({
    baseURL: normal,
    javaScriptEnabled: false,
    storageState: await actor.context.storageState(),
  });
  contexts.push(noJs);
  const page = await noJs.newPage();
  await page.goto("/learner-admission/new");
  expect(await page.locator("input,select").count()).toBe(0);
  await expect(
    page.getByText("No learner details are collected.", { exact: false }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Save settings" }),
  ).toBeDisabled();
  expect(await page.locator("form").first().getAttribute("method")).toBe(
    "post",
  );
  await page.goto("/sign-up");
  await expect(page.getByLabel("Test email", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Create test account", exact: true }),
  ).toBeDisabled();
  expect(await page.locator("form").getAttribute("method")).toBe("post");
});
test("guardian request preserves actual public selection through authentication, assigned MFA evidence, approval and stale return", async ({
  browser,
}) => {
  const tutor = await publicTutor();
  const visitor = await browser.newContext({ baseURL: mirror.origin });
  contexts.push(visitor);
  const page = await visitor.newPage();
  await page.goto(
    publicProfileHref({
      tutorSlug: tutor.slug,
      subjectSlug: "math",
      level: "elementary",
      displayTimezone: "Asia/Manila",
    }),
  );
  const radio = page.locator('input[name="time"]').first();
  await expect(radio).toBeVisible();
  const [startAtUtc, endAtUtc] = (await radio.getAttribute("value"))!.split(
    "|",
  );
  const next = bookingSelectionHref({
    tutorSlug: tutor.slug,
    subjectSlug: "math",
    level: "elementary",
    displayTimezone: "Asia/Manila",
    startAtUtc,
    endAtUtc,
  });
  await radio.check();
  await page
    .getByRole("button", { name: "Review simulated booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  const family = await signup(browser, mirror.origin, next);
  await family.page
    .getByRole("link", { name: "Learner admission and review", exact: true })
    .click();
  await expect(
    family.page.getByRole("heading", {
      name: "Request learner admission",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    family.page.getByRole("button", { name: "Request admission review" }),
  ).toBeEnabled();
  await family.page
    .getByRole("button", { name: "Request admission review" })
    .focus();
  await family.page.keyboard.press("Enter");
  await expect(family.page.getByLabel("Fictional display name")).toBeFocused();
  for (const width of [320, 390, 1440]) await accessible(family.page, width);
  const id = await submitIntake(
    family.page,
    "Fictional browser guardian learner",
  );
  await expect(
    family.page.getByText("Learner access is not authorized.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await family.page
      .getByRole("link", { name: "Return to selected tutor and time" })
      .getAttribute("href"),
  ).toBe(next);
  await family.page.reload();
  expect(
    await family.page
      .getByRole("link", { name: "Return to selected tutor and time" })
      .getAttribute("href"),
  ).toBe(next);
  expect(
    (
      await owner.pool.query("SELECT role FROM user_roles WHERE user_id=$1", [
        family.id,
      ])
    ).rows,
  ).toEqual([]);
  const staff = await signup(browser, mirror.origin, "/account", true);
  await assignAdmissionReviewer(owner.pool, id, staff.id);
  await staff.page.goto(`/admin/learner-admission/${id}`);
  await expect(staff.page).toHaveURL(/\/account\/security$/);
  await enroll(staff.page);
  await staff.page.goto(`/admin/learner-admission/${id}`);
  await staff.page
    .getByRole("button", { name: "Save admission decision" })
    .click();
  await expect(staff.page.locator('p[role="alert"]')).toBeVisible();
  await record(staff.page, "guardian_authority");
  await record(staff.page, "guardian_notice");
  await approve(staff.page);
  await family.page.reload();
  await family.page
    .getByRole("link", { name: "Your authorized learners" })
    .click();
  await expect(family.page).toHaveURL(mirror.origin + "/learners");
  await expect(
    family.page.getByRole("heading", {
      name: "Fictional browser guardian learner",
    }),
  ).toBeVisible();
  await family.page
    .getByRole("link", {
      name: "Edit profile for Fictional browser guardian learner",
      exact: true,
    })
    .click();
  await expect(family.page.getByLabel("Level", { exact: true })).toBeDisabled();
  await owner.pool.query("DELETE FROM tutor_availability WHERE tutor_id=$1", [
    tutor.id,
  ]);
  await family.page.goto(`/learner-admission/${id}`);
  await family.page
    .getByRole("link", { name: "Return to selected tutor and time" })
    .click();
  await expect(family.page).toHaveURL(mirror.origin + next);
  await expect(
    family.page.getByRole("button", {
      name: /Create local|Reserve|Book lesson/,
    }),
  ).toHaveCount(0);
  expect(
    (
      await owner.pool.query(
        "SELECT count(*)::int n FROM bookings WHERE learner_id=(SELECT learner_id FROM learner_admissions WHERE id=$1)",
        [id],
      )
    ).rows[0].n,
  ).toBe(0);
});
test("independent College needs separate evidence and no guardian controls or link", async ({
  browser,
}) => {
  const family = await signup(browser, mirror.origin, "/learner-admission/new");
  await family.page.getByLabel("Request type").selectOption("self");
  expect(await family.page.getByLabel("Learner level").count()).toBe(0);
  await expect(family.page.getByText(/no guardian is required/)).toBeVisible();
  const id = await submitIntake(
    family.page,
    "Fictional browser independent College",
    true,
  );
  const staff = await signup(browser, mirror.origin, "/account", true);
  await assignAdmissionReviewer(owner.pool, id, staff.id);
  await enroll(staff.page);
  await staff.page.goto(`/admin/learner-admission/${id}`);
  expect(
    await staff.page
      .getByLabel("Review check")
      .locator("option")
      .allTextContents(),
  ).toEqual(["Independent eligibility"]);
  await record(staff.page, "independent_eligibility");
  await approve(staff.page);
  await family.page.reload();
  await family.page
    .getByRole("link", { name: "Your authorized learners" })
    .click();
  await expect(family.page).toHaveURL(mirror.origin + "/learners");
  await expect(
    family.page.getByRole("heading", {
      name: "Fictional browser independent College",
    }),
  ).toBeVisible();
  expect(
    (
      await owner.pool.query("SELECT role FROM user_roles WHERE user_id=$1", [
        family.id,
      ])
    ).rows,
  ).toEqual([{ role: "student" }]);
  expect(
    (
      await owner.pool.query(
        "SELECT * FROM guardian_learner_links WHERE learner_id=(SELECT learner_id FROM learner_admissions WHERE id=$1)",
        [id],
      )
    ).rows,
  ).toEqual([]);
});
test("revocation, unrelated actors, Back and auth document replacement deny fresh learner/evidence access", async ({
  browser,
}) => {
  const family = await signup(browser, mirror.origin, "/learner-admission/new");
  const name = "Fictional revoke privacy learner";
  const id = await submitIntake(family.page, name);
  const staff = await signup(browser, mirror.origin, "/account", true);
  await assignAdmissionReviewer(owner.pool, id, staff.id);
  await enroll(staff.page);
  await staff.page.goto(`/admin/learner-admission/${id}`);
  await record(staff.page, "guardian_authority");
  await record(staff.page, "guardian_notice");
  await approve(staff.page);
  await family.page.reload();
  await family.page
    .getByRole("link", { name: "Your authorized learners" })
    .click();
  await expect(family.page).toHaveURL(mirror.origin + "/learners");
  const learner = (
    await owner.pool.query(
      "SELECT learner_id FROM learner_admissions WHERE id=$1",
      [id],
    )
  ).rows[0].learner_id as string;
  await family.page.goto(`/learners/${learner}`);
  await expect(family.page.getByText(`Profile for ${name}`)).toBeVisible();
  await family.page.goto("/account");
  await staff.page
    .getByRole("checkbox", { name: /Remove current learner/ })
    .check();
  await staff.page
    .getByRole("button", { name: "Revoke admission", exact: true })
    .click();
  await expect(
    staff.page.getByText("Status: revoked.", { exact: true }),
  ).toBeVisible();
  await family.page.goBack();
  await expect(
    family.page.getByRole("heading", { name: "Learner profile unavailable" }),
  ).toBeVisible();
  expect(await family.page.content()).not.toContain(name);
  const unrelated = await signup(browser);
  expect(
    (
      await unrelated.context.request.get(`/api/learner-admission/${id}`)
    ).status(),
  ).toBe(404);
  await unrelated.page.goto(`/learner-admission/${id}`);
  expect(await unrelated.page.content()).not.toContain(name);
  await staff.page.goto("/sign-in");
  await expect(
    staff.page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const authHtml = await staff.page.content();
  for (const pattern of privatePatterns)
    expect(authHtml).not.toContain(pattern);
  for (const secret of secrets) expect(authHtml).not.toContain(secret);
  for (const url of [
    "/",
    "/tutors",
    "/sign-in",
    "/sign-up",
    "/api/learner-admission/" + id,
  ]) {
    const response = await unrelated.context.request.get(url);
    const body = await response.text();
    for (const pattern of privatePatterns) expect(body).not.toContain(pattern);
    for (const secret of secrets) expect(body).not.toContain(secret);
  }
});
test("native no-script private status works, intake cannot leak fields to URLs and exact assigned reviewer is required", async ({
  browser,
}) => {
  const family = await signup(browser, mirror.origin, "/learner-admission/new");
  const id = await submitIntake(family.page, "Fictional no-script admission");
  const noJs = await browser.newContext({
    baseURL: mirror.origin,
    javaScriptEnabled: false,
    storageState: await family.context.storageState(),
  });
  contexts.push(noJs);
  const page = await noJs.newPage();
  await page.goto(`/learner-admission/${id}`);
  await expect(
    page.getByText("Status: pending.", { exact: true }),
  ).toBeVisible();
  await page.goto("/learner-admission/new");
  await expect(
    page.getByRole("button", { name: "Request admission review" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Enable JavaScript to send this private request/),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  const unassigned = await signup(browser, mirror.origin, "/account", true);
  await enroll(unassigned.page);
  await unassigned.page.goto(`/admin/learner-admission/${id}`);
  await expect(
    unassigned.page.getByRole("heading", { name: "Admission unavailable" }),
  ).toBeVisible();
  expect(await unassigned.page.content()).not.toContain(
    "Fictional no-script admission",
  );
  await family.page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  for (const width of [320, 390, 1440]) await accessible(family.page, width);
  await family.page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  await family.page.setViewportSize({ width: 390, height: 844 });
  await family.page.screenshot({
    path: ".local/learner-admission/pending-390.png",
    fullPage: true,
  });
  await family.page.setViewportSize({ width: 1440, height: 900 });
  await family.page.screenshot({
    path: ".local/learner-admission/pending-1440.png",
    fullPage: true,
  });
});

test("policy removal and self-review stay unavailable, and real offline failure locks uncertain retry", async ({
  browser,
}) => {
  const family = await signup(browser, mirror.origin, "/learner-admission/new");
  await family.page
    .getByLabel("Fictional display name")
    .fill("Fictional uncertain request");
  await family.context.setOffline(true);
  await family.page
    .getByRole("button", { name: "Request admission review", exact: true })
    .click();
  await expect(family.page.locator('p[role="alert"]')).toHaveText(/uncertain/);
  await expect(
    family.page.getByRole("button", { name: "Request admission review" }),
  ).toBeDisabled();
  await family.context.setOffline(false);
  await family.page.reload();
  await owner.pool.query(
    "UPDATE learner_admission_policy_state SET enabled=false,revision=revision+1",
  );
  try {
    await family.page.reload();
    expect(await family.page.locator("input,select").count()).toBe(0);
    const response = await family.context.request.post(
      "/api/learner-admission",
      {
        headers: { origin: mirror.origin },
        data: { displayName: "Forbidden new child payload" },
      },
    );
    expect(response.status()).toBe(503);
    expect(await response.text()).not.toContain("child");
  } finally {
    await owner.pool.query(
      "UPDATE learner_admission_policy_state SET enabled=true,revision=revision+1",
    );
  }
  const self = await signup(
    browser,
    mirror.origin,
    "/learner-admission/new",
    true,
  );
  const id = await submitIntake(
    self.page,
    "Fictional administrator own request",
  );
  await enroll(self.page);
  await self.page.goto(`/admin/learner-admission/${id}`);
  await expect(
    self.page.getByRole("heading", { name: "Admission unavailable" }),
  ).toBeVisible();
  expect(await self.page.content()).not.toContain(
    "Fictional administrator own request",
  );
});
