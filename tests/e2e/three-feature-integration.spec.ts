import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
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
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";
import {
  familyLearner,
  familyReservation,
  familyTutor,
} from "../support/family-fixtures";

const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-three-feature-browser-123";
const profiles: string[] = [];
test.use({ trace: "off", screenshot: "off" });
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(async () => {
  if (profiles.length)
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
      [profiles],
    );
  await owner.pool.end();
});
async function login(context: BrowserContext, email: string) {
  return context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
}
async function actor(browser: Browser, roles: string[]) {
  const context = await browser.newContext({ baseURL });
  const email = `three-feature-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic integration account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  for (const role of roles)
    await owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,$2)",
      [id, role],
    );
  expect((await login(context, email)).status()).toBe(200);
  if (roles.includes("admin")) await enrollBrowserAdmin(context, password);
  return { context, page: await context.newPage(), email, id };
}
async function code(
  email: string,
  kind: "email-change-current" | "email-change-new",
) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((v) => v.endsWith(".json"))
    .sort()
    .reverse()) {
    const value = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (value.to === email && value.kind === kind && "otp" in value)
      return value.otp;
  }
  throw Error("Expected owned private proof capture.");
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("renamed specialized labels preserve dated directory counts, pagination, matching and native phone GET after deactivation", async ({
  browser,
}) => {
  // Repeated complete 21-tutor dated reads, native navigation and axe scans.
  test.setTimeout(60_000);
  const admin = await actor(browser, ["admin"]);
  const created = await admin.context.request.post("/api/admin/subjects", {
    headers: { origin: baseURL },
    data: { name: `Combined ${randomUUID().slice(0, 8)}` },
  });
  expect(created.status()).toBe(200);
  const subject = (await created.json()) as {
    id: string;
    slug: string;
    name: string;
  };
  const corrected = `Applied Statistics ${randomUUID().slice(0, 8)}`;
  const publicContext = await browser.newContext({ baseURL });
  const page = await publicContext.newPage();
  try {
    for (let i = 0; i < 21; i++) {
      const id = await familyTutor(owner.pool);
      profiles.push(id);
      await owner.pool.query(
        'UPDATE "user" SET name=$2 WHERE id=(SELECT user_id FROM tutor_profiles WHERE id=$1)',
        [id, `Synthetic combined tutor ${String(i).padStart(2, "0")}`],
      );
      await owner.pool.query(
        "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['college_support'])",
        [id, subject.id],
      );
      await owner.pool.query(
        "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,n,0,1440 FROM generate_series(1,7) n",
        [id],
      );
    }
    const before = (
      await owner.pool.query(
        "SELECT md5(row_to_json(t)::text) AS hash FROM tutor_subjects t WHERE subject_id=$1 ORDER BY hash",
        [subject.id],
      )
    ).rows;
    await admin.page.goto("/admin/subjects");
    const editor = admin.page
      .locator("details")
      .filter({ has: admin.page.locator(`#subject-name-${subject.id}`) });
    await editor.locator("summary").click();
    await editor.getByLabel("Display name").fill(corrected);
    await editor.getByLabel("Display name").press("Tab");
    await admin.page.keyboard.press("Enter");
    await expect(editor.getByRole("status")).toHaveText("Subject name saved.");
    const filtered = `/tutors?subject=${subject.slug}&level=college_support&when=any&timezone=UTC`;
    await page.goto(filtered);
    await expect(page.getByRole("status")).toHaveText("21 tutors");
    await expect(page.getByText("Next time that fits")).toHaveCount(20);
    await expect(
      page.locator("li").filter({
        has: page.getByRole("heading", {
          name: "Synthetic combined tutor 00",
          exact: true,
        }),
      }),
    ).toContainText(corrected);
    await page.getByRole("link", { name: "Next page", exact: true }).click();
    await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/, { timeout: 15_000 });
    await expect(page.getByText("Next time that fits")).toHaveCount(1);
    await expect(page.getByRole("status")).toHaveText("21 tutors");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await accessible(page);
    }
    await mkdir(".local/next-wave/screenshots", { recursive: true });
    await page.screenshot({
      path: ".local/next-wave/screenshots/combined-directory-1440.png",
      fullPage: true,
    });
    await page.goto(
      `/get-matched?level=college_support&subject=${subject.slug}&when=any&timezone=UTC`,
    );
    await expect(page.getByRole("main")).toContainText(corrected);
    await expect(
      page.getByRole("link", { name: /^View profile:/ }),
    ).toHaveCount(5);
    const native = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const phone = await native.newPage();
      await phone.goto(filtered);
      await expect(phone.getByRole("status")).toHaveText("21 tutors");
      await phone.getByRole("button", { name: "Apply filters" }).click();
      await expect(phone.getByRole("status")).toHaveText("21 tutors");
      await phone.screenshot({
        path: ".local/next-wave/screenshots/combined-directory-nojs-390.png",
        fullPage: true,
      });
    } finally {
      await native.close();
    }
    const deactivate = await admin.context.request.patch(
      `/api/admin/subjects/${subject.id}`,
      { headers: { origin: baseURL }, data: { isActive: false } },
    );
    expect(deactivate.status()).toBe(200);
    await page.goto(filtered);
    await expect(
      page.getByRole("link", { name: /^View profile:/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.goto(
      `/get-matched?level=college_support&subject=${subject.slug}&when=any&timezone=UTC`,
    );
    await expect(
      page.getByRole("link", { name: /^View profile:/ }),
    ).toHaveCount(0);
    expect(
      (
        await owner.pool.query(
          "SELECT md5(row_to_json(t)::text) AS hash FROM tutor_subjects t WHERE subject_id=$1 ORDER BY hash",
          [subject.id],
        )
      ).rows,
    ).toEqual(before);
    const identity = (
      await owner.pool.query(
        "SELECT slug,category,name_revision,is_active FROM subjects WHERE id=$1",
        [subject.id],
      )
    ).rows[0];
    expect(identity).toEqual({
      slug: subject.slug,
      category: "specialized",
      name_revision: 1,
      is_active: false,
    });
  } finally {
    await publicContext.close();
    await admin.context.close();
  }
});

test("production both-code email completion denies old admin and private sessions, retains trusted owner relationships and clears the document", async ({
  browser,
}) => {
  const account = await actor(browser, ["admin", "parent", "tutor"]);
  const old = await browser.newContext({ baseURL });
  const foreign = await actor(browser, ["parent"]);
  try {
    expect((await login(old, account.email)).status()).toBe(200);
    const learnerId = await familyLearner(
      owner.pool,
      account.id,
      "guardian",
      "PRIVATE COMBINED EMAIL BROWSER LEARNER",
    );
    const tutorId = (
      await owner.pool.query(
        "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic','Local fixture only','Fixture','UTC','approved') RETURNING id",
        [account.id, `combined-email-${randomUUID()}`],
      )
    ).rows[0].id as string;
    profiles.push(tutorId);
    const bookingId = await familyReservation(owner.pool, {
      actorId: account.id,
      learnerId,
      tutorId,
    });
    const meetingApi = `/api/bookings/${bookingId}/meeting-link`;
    expect(
      (
        await account.context.request.put(meetingApi, {
          headers: { origin: baseURL },
          data: {
            url: "https://zoom.us/j/12345678901?pwd=combinedEmailBrowserPrivate",
            expectedRevision: 0,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(200);
    const created = await account.context.request.post("/api/admin/subjects", {
      headers: { origin: baseURL },
      data: { name: `Email seam ${randomUUID().slice(0, 8)}` },
    });
    expect(created.status()).toBe(200);
    const subject = (await created.json()) as { id: string };
    const page = account.page;
    await page.goto("/account/email");
    await page
      .getByRole("button", { name: "Send current-address code" })
      .click();
    await expect(page.getByLabel("Current-address code")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Verify current address" })
        .getByRole("status"),
    ).toBeFocused();
    const newEmail = `combined-new-${randomUUID()}@learli.test`;
    await page.getByLabel("New test email").fill(newEmail);
    await page
      .getByLabel("Current-address code")
      .fill(await code(account.email, "email-change-current"));
    await page.getByLabel("Current-address code").press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("New-address code")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Verify new address" })
        .getByRole("status"),
    ).toBeFocused();
    await page.evaluate(() => {
      document.documentElement.dataset.beforeEmailChange = "yes";
    });
    await page
      .getByLabel("New-address code")
      .fill(await code(newEmail, "email-change-new"));
    await page.getByLabel("New-address code").press("Tab");
    await page.getByRole("button", { name: "Confirm new address" }).focus();
    await expect(
      page.getByRole("button", { name: "Confirm new address" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/account$/);
    expect(
      await page.evaluate(
        () => document.documentElement.dataset.beforeEmailChange === undefined,
      ),
    ).toBe(true);
    expect((await page.getByRole("main").innerText()).includes(newEmail)).toBe(
      true,
    );
    const editPath = `/api/admin/subjects/${subject.id}/name`;
    const body = {
      name: `Corrected ${randomUUID().slice(0, 8)}`,
      expectedRevision: 0,
    };
    expect(
      (
        await old.request.patch(editPath, {
          headers: { origin: baseURL },
          data: body,
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await old.request.get(`/api/bookings/${bookingId}?scope=guardian`)
      ).status(),
    ).toBe(401);
    expect((await old.request.get(meetingApi)).status()).toBe(401);
    expect(
      (
        await account.context.request.patch(editPath, {
          headers: { origin: baseURL },
          data: body,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await account.context.request.get(
          `/api/bookings/${bookingId}?scope=guardian`,
        )
      ).status(),
    ).toBe(200);
    expect((await account.context.request.get(meetingApi)).status()).toBe(200);
    expect((await foreign.context.request.get(meetingApi)).status()).toBe(404);
    expect(
      (
        await owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
          [account.id],
        )
      ).rows,
    ).toEqual([{ role: "admin" }, { role: "parent" }, { role: "tutor" }]);
    expect(
      (
        await owner.pool.query(
          "SELECT status FROM guardian_learner_links WHERE guardian_user_id=$1 AND learner_id=$2",
          [account.id, learnerId],
        )
      ).rows,
    ).toEqual([{ status: "authorized" }]);
    await page.goto("/account/email");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await accessible(page);
    }
    const publicResponse = await account.context.request.get(
      "/tutors?when=any&timezone=UTC",
    );
    const publicText = await publicResponse.text();
    expect(
      [newEmail, learnerId, bookingId, "combinedEmailBrowserPrivate"].some(
        (v) => publicText.includes(v),
      ),
    ).toBe(false);
  } finally {
    await account.context.close();
    await old.close();
    await foreign.context.close();
  }
});
