import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "../../src/features/private-workflow/config";
import { runPrivateWorkflowOperation } from "../../src/features/private-workflow/operator";
import { totpCode } from "../support/admin-mfa";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { resetPrivateBrowserAuthAttempts } from "../support/private-student-browser";

test.use({ trace: "off", screenshot: "off", video: "off" });
const password = "Fictional-browser-workflow-passphrase-123";
const contexts: BrowserContext[] = [];
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
let packet: PrivateWorkflowPacket;
let binding: PrivateWorkflowBinding;
const emailFor = (role: string) =>
  packet.accountEmails.find(
    (email) =>
      email.startsWith(`${role}-`) &&
      (role.includes("other") || !email.startsWith(`${role}-other-`)),
  )!;

test.beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  const raw = JSON.parse(
    readFileSync(process.env.PRIVATE_WORKFLOW_CONFIG_FILE!, "utf8"),
  );
  binding = { origin: process.env.APP_URL!, database: raw.database };
  packet = parsePrivateWorkflow(raw, binding);
  await resetPrivateBrowserAuthAttempts(owner);
});
test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  await owner.pool.end();
});

async function operate(
  command: Parameters<typeof runPrivateWorkflowOperation>[3],
) {
  const client = await owner.pool.connect();
  try {
    return await runPrivateWorkflowOperation(client, packet, binding, command);
  } finally {
    client.release();
  }
}

async function register(browser: Browser, role: string, next = "/account") {
  const context = await browser.newContext({ baseURL: packet.origin });
  contexts.push(context);
  const page = await context.newPage();
  const email = emailFor(role);
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await expect(
    page.getByRole("complementary", { name: "Private staging" }),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill(`Fictional ${role}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (role.startsWith("parent"))
    await page.getByLabel("Account type").selectOption("parent");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(/a verification message is available/),
  ).toBeVisible();
  const messages = readdirSync(path.join(process.cwd(), ".local/mail/test"))
    .filter((file) => file.endsWith(".json"))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(
            path.join(process.cwd(), ".local/mail/test", file),
            "utf8",
          ),
        ) as { to: string; kind: string; url: string },
    );
  const notice = messages.findLast(
    (message) => message.to === email && message.kind === "verification",
  );
  expect(Boolean(notice)).toBe(true);
  await page.goto(notice!.url);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  const id = (
    await owner.pool.query<{ id: string }>(
      'SELECT id FROM public."user" WHERE email=$1 AND email_verified',
      [email],
    )
  ).rows[0]?.id;
  expect(Boolean(id)).toBe(true);
  if (role.startsWith("parent")) {
    await expect(
      page.getByRole("button", { name: "Continue as parent", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Continue as parent", exact: true })
      .click();
    await expect(page).toHaveURL(/\/parent$/);
  }
  return { context, page, email, id: id! };
}

async function enroll(page: Page) {
  await page.goto("/account/security");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const key = page.locator("[data-mfa-secret]").first();
  await expect(key).toBeVisible();
  const secret = (await key.textContent())!;
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
  await expect(
    page.getByText("Administrator verification is current.", { exact: false }),
  ).toBeVisible();
}

async function responsive(page: Page) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    // Do not include private document content in a failing assertion artifact.
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  }
}

test("normal private build connects reviewed Parent/Tutor registration, discovery, confirmation and a shared private meeting", async ({
  browser,
}) => {
  // No copied source, factory overrides, automated approval, factor receipts or guardian links.
  const admin = await register(browser, "admin");
  await owner.pool.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
    [admin.id],
  );
  await enroll(admin.page);
  await operate({ action: "prepare", apply: true, reviewerEmail: admin.email });

  const parent = await register(browser, "parent");
  const otherParent = await register(browser, "parent-other");
  const tutor = await register(browser, "tutor");
  await tutor.page.goto("/become-a-tutor");
  await tutor.page
    .getByRole("button", { name: "Start tutor application", exact: true })
    .click();
  await expect(tutor.page).toHaveURL(/\/tutor\/profile$/);
  await tutor.page
    .getByLabel("Headline")
    .fill("Fictional Mathematics tutoring");
  await tutor.page
    .getByLabel("Introduction")
    .fill("A fictional tutor for the private workflow test.");
  await tutor.page
    .getByLabel("Teaching background")
    .fill("Fictional education and teaching experience for QA only.");
  await tutor.page.getByLabel("Time zone").selectOption("Asia/Manila");
  await tutor.page
    .getByRole("group", { name: "Math", exact: true })
    .getByLabel("Middle School", { exact: true })
    .check();
  await tutor.page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(tutor.page.getByRole("status")).toHaveText(
    "Application submitted.",
  );
  const profile = (
    await owner.pool.query<{ id: string; slug: string }>(
      "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
      [tutor.id],
    )
  ).rows[0];
  await tutor.page.reload();
  await expect(tutor.page.getByLabel("Introduction")).toHaveValue(
    "A fictional tutor for the private workflow test.",
  );
  const unapprovedResponse = await parent.page.goto(`/tutors/${profile.slug}`);
  expect(unapprovedResponse?.status()).toBe(404);
  await expect(
    parent.page.getByRole("heading", { name: "Fictional tutor", exact: true }),
  ).toHaveCount(0);

  console.info("Private workflow: accounts verified and Tutor profile saved.");
  await tutor.page.goto("/tutor/screening");
  await tutor.page
    .getByRole("button", { name: "Request synthetic screening", exact: true })
    .click();
  await expect(tutor.page.getByText(/Screening status: pending/)).toBeVisible();
  await operate({
    action: "assign-screening",
    apply: true,
    tutorId: profile.id,
    reviewerEmail: admin.email,
    validUntil: packet.screening.validUntil,
  });
  await admin.page.goto(`/admin/tutors/${profile.id}`);
  // Required evidence cannot be skipped even by a current, assigned MFA admin.
  await admin.page
    .getByRole("button", { name: "Approve synthetic screening", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Confirm screening decision", exact: true })
    .click();
  await expect(
    admin.page.locator("#main-content").getByRole("alert"),
  ).toContainText("required");
  for (const code of packet.screening.requiredCheckCodes) {
    await admin.page.getByLabel("Required check").selectOption(code);
    await admin.page
      .getByLabel("Evidence reference")
      .fill(`screening:${randomUUID()}`);
    await admin.page
      .getByLabel("Checked at (UTC ISO date)")
      .fill(new Date(Date.now() - 60_000).toISOString());
    await admin.page
      .getByLabel("Expires at (UTC ISO date)")
      .fill(packet.screening.validUntil);
    await admin.page
      .getByRole("button", { name: "Record check", exact: true })
      .click();
    await expect(
      admin.page.getByText(`${code}: Current passed evidence`, { exact: true }),
    ).toBeVisible();
  }
  await admin.page
    .getByRole("button", { name: "Approve synthetic screening", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Confirm screening decision", exact: true })
    .click();
  await expect(admin.page.getByText(/State: approved\./)).toBeVisible();

  console.info("Private workflow: Tutor screening approved.");
  const availability = {
    version: 0,
    timezone: "Asia/Manila",
    windows: Array.from({ length: 7 }, (_, i) => ({
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  };
  expect(
    (
      await tutor.context.request.put("/api/tutor/availability", {
        headers: { origin: packet.origin },
        data: availability,
      })
    ).status(),
  ).toBe(200);
  await tutor.page.goto("/tutor/availability");
  await expect(
    tutor.page.getByRole("heading", {
      name: "Weekly availability",
      exact: true,
    }),
  ).toBeVisible();

  await parent.page.goto("/learners");
  await parent.page
    .getByRole("link", { name: "Add a learner", exact: true })
    .click();
  await parent.page
    .getByLabel("Learner display name", { exact: true })
    .fill("Student A fictional");
  await parent.page
    .getByLabel("Learner level", { exact: true })
    .selectOption("middle_school");
  await parent.page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await parent.page
    .getByRole("button", { name: "Request admission review", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
  const admissionId = new URL(parent.page.url()).pathname.split("/").at(-1)!;
  await expect(
    parent.page.getByText(/Learner access is not authorized/),
  ).toBeVisible();
  const pending = (
    await owner.pool.query<{ id: string; status: string; links: number }>(
      "SELECT l.id,l.status,(SELECT count(*)::int FROM guardian_learner_links g WHERE g.learner_id=l.id) links FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1",
      [admissionId],
    )
  ).rows[0];
  expect(pending.status).toBe("inactive");
  expect(pending.links).toBe(0);
  expect(
    (
      await parent.context.request.post("/api/learners", {
        headers: { origin: packet.origin },
        data: {
          displayName: "Bypass attempt",
          level: "middle_school",
          timezone: "Asia/Manila",
          management: "guardian",
          requestId: randomUUID(),
        },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await otherParent.context.request.get(
        `/api/learner-admission/${admissionId}`,
      )
    ).status(),
  ).toBe(404);
  await operate({
    action: "assign-admission",
    apply: true,
    admissionId,
    reviewerEmail: admin.email,
  });
  await admin.page.goto(`/admin/learner-admission/${admissionId}`);
  for (const check of ["guardian_authority", "guardian_notice"]) {
    await admin.page.getByLabel("Review check").selectOption(check);
    const reference = `browser:${randomUUID()}`;
    await admin.page.getByLabel("Opaque test reference").fill(reference);
    await admin.page
      .getByRole("button", { name: "Record evidence", exact: true })
      .click();
    await expect(
      admin.page.getByText(reference, { exact: false }),
    ).toBeVisible();
  }
  await admin.page
    .getByRole("button", { name: "Save admission decision", exact: true })
    .click();
  await expect(admin.page.getByText(/Status: authorized\./)).toBeVisible();
  console.info("Private workflow: learner review authorized.");
  await parent.page.goto("/learners");
  await expect(
    parent.page.getByRole("heading", {
      name: "Student A fictional",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await otherParent.context.request.get(`/api/learners/${pending.id}`)
    ).status(),
  ).toBe(404);

  await parent.page.goto("/tutors");
  const filters = parent.page.getByRole("search", {
    name: "Filter tutors",
    exact: true,
  });
  await filters.getByLabel("Subject", { exact: true }).selectOption("math");
  await filters
    .getByLabel("Level", { exact: true })
    .selectOption("middle_school");
  await filters
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(parent.page.getByRole("status")).toHaveText("1 tutor");
  await parent.page
    .getByRole("link", { name: "View profile: Fictional tutor", exact: true })
    .click();
  await expect(parent.page).toHaveURL(
    new RegExp(`/tutors/${profile.slug}(?:\\?|$)`),
  );
  await expect(
    parent.page.getByRole("heading", { name: "Fictional tutor", exact: true }),
  ).toBeVisible();
  await expect(
    parent.page.getByText(
      "Fictional education and teaching experience for QA only.",
      { exact: true },
    ),
  ).toBeVisible();
  await parent.page.getByLabel("Subject", { exact: true }).selectOption("math");
  await parent.page
    .getByLabel("Level", { exact: true })
    .selectOption("middle_school");
  await parent.page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await parent.page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await parent.page.locator('input[name="time"]').first().check();
  await parent.page
    .getByRole("button", { name: "Review booking", exact: true })
    .click();
  await expect(parent.page).toHaveURL(/\/bookings\/new\?/);
  await parent.page
    .getByLabel("Learner", { exact: true })
    .selectOption(pending.id);
  await parent.page
    .getByRole("button", { name: "Show available times", exact: true })
    .click();
  await expect(parent.page.getByRole("radio").first()).toBeChecked();
  const requestedStart = await parent.page
    .getByRole("radio")
    .first()
    .getAttribute("value");
  await parent.page
    .getByRole("button", { name: "Request booking", exact: true })
    .click();
  await expect(parent.page).toHaveURL(
    /\/bookings\/[a-f0-9-]+\?scope=guardian$/,
  );
  const bookingId = new URL(parent.page.url()).pathname.split("/").at(-1)!;
  await expect(
    parent.page.getByRole("heading", {
      name: "Provisional booking",
      exact: true,
    }),
  ).toBeVisible();
  const booking = (
    await owner.pool.query<{
      logical_booking_id: string;
      state: string;
      start_at_utc: Date;
      subject_slug: string;
      learner_id: string;
      tutor_id: string;
    }>(
      "SELECT b.logical_booking_id,b.state,b.start_at_utc,s.slug subject_slug,b.learner_id,b.tutor_id FROM bookings b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1",
      [bookingId],
    )
  ).rows[0];
  expect(booking.state).toBe("provisional");
  expect(booking.start_at_utc.toISOString()).toBe(requestedStart);
  expect(booking.learner_id).toBe(pending.id);
  expect(booking.tutor_id).toBe(profile.id);
  expect(booking.subject_slug).toBe("math");
  await operate({
    action: "grant-confirmation",
    apply: true,
    bookingId,
    reviewerEmail: admin.email,
    validUntil: packet.screening.validUntil,
  });
  await admin.page.goto(`/admin/bookings/${bookingId}`);
  await admin.page
    .getByRole("button", { name: "Confirm booking prerequisites", exact: true })
    .click();
  await expect(admin.page.getByText(/Math · Confirmed/)).toBeVisible();
  console.info("Private workflow: shared booking confirmed.");
  await parent.page.goto("/parent");
  await expect(
    parent.page
      .locator(`a[href="/bookings/${bookingId}?scope=guardian"]`)
      .first(),
  ).toBeVisible();
  await tutor.page.goto("/tutor");
  await expect(
    tutor.page.locator(`a[href="/bookings/${bookingId}?scope=tutor"]`).first(),
  ).toBeVisible();
  await tutor.page.goto(`/bookings/${bookingId}?scope=tutor`);
  await expect(
    tutor.page.getByRole("heading", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  await expect(
    tutor.page.getByText("Student A fictional · Middle School", {
      exact: true,
    }),
  ).toBeVisible();
  await tutor.page
    .getByLabel("Zoom or Google Meet link", { exact: true })
    .fill("https://meet.google.com/abc-defg-hij");
  await tutor.page
    .getByRole("button", { name: "Save meeting link", exact: true })
    .click();
  await expect(
    tutor.page
      .getByRole("status")
      .filter({ hasText: "Private meeting link saved." }),
  ).toBeVisible();
  await tutor.page.reload();
  await parent.page.goto(`/bookings/${bookingId}?scope=guardian`);
  for (const actor of [parent, tutor]) {
    await actor.context.route("https://meet.google.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Intercepted fictional meeting</title>",
      }),
    );
    const popup = actor.context.waitForEvent("page");
    await actor.page
      .getByRole("link", {
        name: "Open meeting on Google Meet (new tab)",
        exact: true,
      })
      .click();
    const external = await popup;
    await external.waitForLoadState();
    expect(external.url() === "https://meet.google.com/abc-defg-hij").toBe(
      true,
    );
    await external.close();
  }
  expect(
    (
      await otherParent.context.request.get(
        `/api/bookings/${bookingId}?scope=guardian`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await otherParent.context.request.get(
        `/api/bookings/${bookingId}/meeting-link`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await tutor.context.request.post("/api/admin/subjects", {
        headers: { origin: packet.origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const premature = await tutor.context.request.post(
    `/api/bookings/${bookingId}/workflow/complete`,
    {
      headers: { origin: packet.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: "synthetic_completed",
      },
    },
  );
  expect(premature.status()).toBe(409);
  expect(
    (
      await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
        bookingId,
      ])
    ).rows[0].state,
  ).toBe("confirmed");
  await parent.page.goto("/bookings?scope=guardian&filter=all");
  await expect(
    parent.page.locator(`a[href="/bookings/${bookingId}?scope=guardian"]`),
  ).toBeVisible();
  await responsive(parent.page);
  await tutor.page.goto("/admin");
  await expect(
    tutor.page.getByRole("heading", { name: /Admin workspace/ }),
  ).toHaveCount(0);
  const foreign = await parent.context.request.get(`/tutors/${profile.slug}`);
  expect(
    (await foreign.text()).includes("https://meet.google.com/abc-defg-hij"),
  ).toBe(false);
});
