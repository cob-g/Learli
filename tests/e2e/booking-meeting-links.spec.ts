import { randomUUID } from "node:crypto";
import { test, expect, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
test.use({ trace: "off", screenshot: "off" });
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
  baseURL = process.env.APP_URL!;
const testLink = "https://zoom.us/j/12345678901?pwd=privateBrowserFixture";
const nextLink = "https://meet.google.com/abc-defg-hij";
async function account(
  browser: Browser,
  role: "parent" | "tutor" | "admin",
  javaScriptEnabled = true,
) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled });
  const email = `meeting-${randomUUID()}@learli.test`,
    password = "Synthetic-meeting-browser-passphrase-123";
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic meeting account" },
  });
  expect(signup.status()).toBe(200);
  const id = (await signup.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  await owner.pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [
    id,
    role,
  ]);
  expect(
    (
      await context.request.post("/api/auth/sign-in/email", {
        headers: { origin: baseURL },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { id, context, page: await context.newPage() };
}
async function fixture(browser: Browser) {
  await owner.pool.query("UPDATE rate_limit SET count=0");
  const tutor = await account(browser, "tutor"),
    parent = await account(browser, "parent");
  const learnerId = (
    await owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic learner','elementary','UTC') RETURNING id",
      [randomUUID()],
    )
  ).rows[0].id as string;
  await owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [parent.id, learnerId],
  );
  const profileId = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor','Synthetic only','Fixture','UTC','approved') RETURNING id",
      [tutor.id, `meeting-${randomUUID()}`],
    )
  ).rows[0].id as string;
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  let index = 0;
  async function booking(remaining = 600000) {
    const id = randomUUID(),
      start = new Date(Date.now() + (++index + 20) * 86400000);
    await owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,'demo_reserved',clock_timestamp()-interval '10 minutes'+$10*interval '1 millisecond',clock_timestamp()+$10*interval '1 millisecond')",
      [
        id,
        profileId,
        learnerId,
        parent.id,
        subject,
        start,
        new Date(start.getTime() + 3600000),
        randomUUID(),
        "a".repeat(64),
        remaining,
      ],
    );
    return id;
  }
  const close = async () => {
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profileId],
    );
    await tutor.context.close();
    await parent.context.close();
  };
  return { tutor, parent, learnerId, booking, profileId, close };
}
test.afterAll(() => owner.pool.end());
test("tutor save/replace, participant native action, conflict and private no-cache boundaries", async ({
  browser,
}) => {
  const f = await fixture(browser);
  try {
    const id = await f.booking(),
      path = `/bookings/${id}?scope=tutor`,
      api = `/api/bookings/${id}/meeting-link`;
    await f.tutor.page.goto(path);
    await expect(
      f.tutor.page.getByText("No test meeting link has been provided."),
    ).toBeVisible();
    await f.tutor.page
      .getByLabel("Zoom or Google Meet test link")
      .fill(testLink);
    await f.tutor.page
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      f.tutor.page
        .getByRole("status")
        .filter({ hasText: "Test meeting link saved." }),
    ).toBeVisible();
    await expect(
      f.tutor.page.getByRole("link", {
        name: "Open test link on Zoom (new tab)",
        exact: true,
      }),
    ).toHaveAttribute("href", `${api}?open=1`);
    await f.parent.page.goto(`/bookings/${id}?scope=guardian`);
    await expect(
      f.parent.page.getByLabel("Zoom or Google Meet test link"),
    ).toHaveCount(0);
    // Check redirect headers directly without following or visiting the provider.
    const open = await f.parent.context.request.get(`${api}?open=1`, {
      maxRedirects: 0,
    });
    expect(open.status()).toBe(303);
    expect(open.headers().location).toBe(testLink);
    expect(open.headers()["cache-control"]).toContain("no-store");
    expect(await f.parent.page.title()).not.toContain(testLink);
    expect(await f.parent.page.locator("head").innerHTML()).not.toContain(
      testLink,
    );
    expect(
      (
        await f.parent.context.request.get(`/api/bookings/${id}?scope=guardian`)
      ).status(),
    ).toBe(200);
    const changed = await f.tutor.context.request.put(api, {
      headers: { origin: baseURL },
      data: { url: nextLink, expectedRevision: 1, requestId: randomUUID() },
    });
    expect(changed.status()).toBe(200);
    await f.tutor.page
      .getByRole("button", { name: "Replace test meeting link" })
      .click();
    await expect(
      f.tutor.page
        .getByRole("status")
        .filter({ hasText: "The meeting link changed." }),
    ).toBeVisible();
    await expect(
      f.tutor.page.getByRole("button", { name: "Replace test meeting link" }),
    ).toBeDisabled();
    await f.tutor.page
      .getByRole("button", { name: "Reload meeting link" })
      .click();
    await expect(
      f.tutor.page.getByLabel("Zoom or Google Meet test link"),
    ).toHaveValue(nextLink);
    await expect(
      f.tutor.page.getByRole("button", { name: "Replace test meeting link" }),
    ).toBeEnabled();
    await owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
      [f.parent.id, f.learnerId],
    );
    const denied = await f.parent.context.request.get(`${api}?open=1`, {
      maxRedirects: 0,
    });
    expect(denied.status()).toBe(404);
    expect(denied.headers().location).toBeUndefined();
  } finally {
    await f.close();
  }
});
test("responsive/keyboard accessible missing, valid and invalid states plus safe screenshots", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  try {
    const id = await f.booking();
    const p = f.tutor.page;
    await p.goto(`/bookings/${id}?scope=tutor`);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p
        .getByRole("heading", { name: "Test meeting link", exact: true })
        .scrollIntoViewIfNeeded();
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page: p }).analyze()).violations).toEqual(
        [],
      );
      // No credentials/private URL visible in these deliberately missing-link screenshots.
      if ([320, 390, 1440].includes(width))
        await p.screenshot({
          path: info.outputPath(`meeting-missing-${width}.png`),
          fullPage: true,
        });
    }
    const field = p.getByLabel("Zoom or Google Meet test link");
    await field.focus();
    await expect(field).toBeFocused();
    await p.keyboard.press("Tab");
    await expect(
      p.getByRole("button", { name: "Save test meeting link", exact: true }),
    ).toBeFocused();
    await field.fill("https://evil.test/meeting");
    await p
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      p.getByRole("status").filter({ hasText: "Enter a supported HTTPS" }),
    ).toBeVisible();
    await field.fill(testLink);
    await p
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      p.getByRole("link", {
        name: "Open test link on Zoom (new tab)",
        exact: true,
      }),
    ).toBeVisible();
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.setViewportSize({ width: 720, height: 450 });
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page: p }).analyze()).violations).toEqual(
      [],
    );
  } finally {
    await f.close();
  }
});
test("expired and forbidden states, current open denial and read-only no-JS detail", async ({
  browser,
}) => {
  const f = await fixture(browser);
  try {
    const expired = await f.booking(-1000);
    await f.parent.page.goto(`/bookings/${expired}?scope=guardian`);
    await expect(
      f.parent.page.getByText(
        "This simulation has expired. Its test meeting link is unavailable.",
      ),
    ).toBeVisible();
    await expect(
      f.parent.page.getByRole("link", { name: /Open test link/ }),
    ).toHaveCount(0);
    const id = await f.booking();
    expect(
      (
        await f.tutor.context.request.put(`/api/bookings/${id}/meeting-link`, {
          headers: { origin: baseURL },
          data: { url: testLink, expectedRevision: 0, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(200);
    const nojs = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      storageState: await f.parent.context.storageState(),
    });
    try {
      const page = await nojs.newPage();
      await page.goto(`/bookings/${id}?scope=guardian`);
      await expect(
        page.getByRole("heading", { name: "Test meeting link", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: "Open test link on Zoom (new tab)",
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await nojs.close();
    }
    const admin = await account(browser, "admin");
    try {
      await admin.page.goto(`/bookings/${id}?scope=tutor`);
      await expect(
        admin.page.getByRole("heading", {
          name: "We can't find that booking on this account",
        }),
      ).toBeVisible();
      const denied = await admin.context.request.get(
        `/api/bookings/${id}/meeting-link`,
      );
      expect(denied.status()).toBe(404);
      expect(await denied.text()).not.toContain(testLink);
    } finally {
      await admin.context.close();
    }
  } finally {
    await f.close();
  }
});
test("pending/service error and denied refresh replace private action with clear recovery", async ({
  browser,
}) => {
  const f = await fixture(browser);
  try {
    const id = await f.booking(),
      api = `/api/bookings/${id}/meeting-link`;
    await f.tutor.page.goto(`/bookings/${id}?scope=tutor`);
    await f.tutor.page.route(`**${api}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 503,
        json: { message: "Service unavailable" },
      });
    });
    await f.tutor.page
      .getByLabel("Zoom or Google Meet test link")
      .fill(testLink);
    await f.tutor.page
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      f.tutor.page.getByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    await expect(
      f.tutor.page
        .getByRole("status")
        .filter({ hasText: "The save could not be confirmed." }),
    ).toBeVisible();
    await f.tutor.page
      .getByRole("button", { name: "Reload meeting link" })
      .click();
    await expect(
      f.tutor.page.getByText(
        "Test meeting links could not be loaded. Try again.",
      ),
    ).toBeVisible();
    await f.tutor.page.unroute(`**${api}`);
    await f.tutor.page
      .getByRole("button", { name: "Reload meeting link" })
      .click();
    await expect(
      f.tutor.page.getByText("No test meeting link has been provided."),
    ).toBeVisible();
  } finally {
    await f.close();
  }
});
