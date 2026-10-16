import { enrollBrowserAdmin } from "../support/browser-admin-mfa";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import { familyLearner, familyReservation } from "../support/family-fixtures";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
} from "../../src/features/account-restrictions/fixture-tooling";
import {
  authorizeFixtureReviewer,
  assignFixtureCase,
} from "../../src/features/support/fixture-tooling";
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const baseURL = process.env.APP_URL!;
const password = "Synthetic-combined-browser-password-123";
const nextPassword = "Synthetic-combined-browser-rotated-456";
const privateUrl = "https://zoom.us/j/12345678901?pwd=combinedBrowserPrivate";
test.use({ trace: "off", screenshot: "off" });
test.beforeEach(async () => {
  await mkdir(".local/four-feature/recovery-final", { recursive: true });
  await owner.pool.query("UPDATE rate_limit SET count=0");
});
test.afterAll(() => owner.pool.end());
async function actor(browser: Browser, role: "tutor" | "parent" | "admin") {
  const context = await browser.newContext({ baseURL });
  const email = `combined-${randomUUID()}@learli.test`;
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic combined account" },
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
  if (role === "admin") await enrollBrowserAdmin(context, password);
  return { id, email, context, page: await context.newPage() };
}
async function fixture(browser: Browser) {
  const parent = await actor(browser, "parent"),
    tutor = await actor(browser, "tutor"),
    staff = await actor(browser, "admin");
  const learnerId = await familyLearner(
    owner.pool,
    parent.id,
    "guardian",
    "PRIVATE COMBINED BROWSER LEARNER",
  );
  const profileId = (
    await owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor','Synthetic only','Fixture','UTC','approved') RETURNING id",
      [tutor.id, `combined-browser-${randomUUID()}`],
    )
  ).rows[0].id as string;
  await authorizeFixtureReviewer(owner, staff.id);
  await provisionRestrictionTarget(owner, parent.id);
  await authorizeRestrictionTarget(owner, staff.id, parent.id);
  const bookingId = await familyReservation(owner.pool, {
    actorId: parent.id,
    learnerId,
    tutorId: profileId,
  });
  const close = async () => {
    await owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profileId],
    );
    await Promise.all([
      parent.context.close(),
      tutor.context.close(),
      staff.context.close(),
    ]);
  };
  return { parent, tutor, staff, learnerId, profileId, bookingId, close };
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function restrict(page: Page, targetId: string, restore = false) {
  await page.goto(`/admin/accounts/${targetId}`);
  await page
    .getByLabel("Local test reason")
    .selectOption(restore ? "local_restore_test" : "local_access_test");
  await page
    .getByRole("button", {
      name: restore ? "Restore local account" : "Suspend local account",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: restore ? "Restore account access" : "Suspend account access",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Local action recorded." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: restore ? "Suspend local account" : "Restore local account",
      exact: true,
    }),
  ).toBeVisible();
}
test("linked private booking/report and scoped UI suspension restore then password rotation preserve current cookie and deny old sessions", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const old = await browser.newContext({ baseURL });
  try {
    const api = `/api/bookings/${f.bookingId}/meeting-link`;
    await f.tutor.page.goto(`/bookings/${f.bookingId}?scope=tutor`);
    await f.tutor.page
      .getByLabel("Zoom or Google Meet test link")
      .fill(privateUrl);
    await f.tutor.page
      .getByRole("button", { name: "Save test meeting link", exact: true })
      .click();
    await expect(
      f.tutor.page
        .getByRole("status")
        .filter({ hasText: "Test meeting link saved." }),
    ).toBeVisible();
    await f.parent.page.goto(`/bookings/${f.bookingId}?scope=guardian`);
    await expect(
      f.parent.page.getByRole("link", {
        name: "Open test link on Zoom (new tab)",
        exact: true,
      }),
    ).toHaveAttribute("href", `${api}?open=1`);
    for (const width of [320, 390, 1440]) {
      await f.parent.page.setViewportSize({ width, height: 900 });
      await accessible(f.parent.page);
    }
    const opening = await f.parent.context.request.get(`${api}?open=1`, {
      maxRedirects: 0,
    });
    expect(opening.status()).toBe(303);
    expect(opening.headers().location === privateUrl).toBe(true);
    const supportResponsePromise = f.parent.page.waitForResponse(
      (response) =>
        response.request().isNavigationRequest() &&
        response.url().includes("/contact?bookingId="),
    );
    await f.parent.page
      .getByRole("link", {
        name: "Report a simulated booking issue",
        exact: true,
      })
      .click();
    const supportResponse = await supportResponsePromise;
    expect(supportResponse.status()).toBe(200);
    expect((await supportResponse.text()).includes(privateUrl)).toBe(false);
    await expect(
      f.parent.page.getByRole("heading", { name: "Related simulated booking" }),
    ).toBeVisible();
    await expect(
      f.parent.page.getByText("PRIVATE COMBINED BROWSER LEARNER"),
    ).toHaveCount(0);
    expect((await f.parent.page.content()).includes(privateUrl)).toBe(false);
    await f.parent.page
      .getByLabel("Subject", { exact: true })
      .fill("Synthetic joint booking issue");
    await f.parent.page
      .getByLabel("Fictional description")
      .fill("Fictional local report only");
    await f.parent.page
      .getByRole("button", { name: "Save fictional report", exact: true })
      .click();
    await expect(f.parent.page).toHaveURL(/\/support\/[a-f0-9-]+$/);
    const caseId = f.parent.page.url().split("/").pop()!;
    const requesterCase = await f.parent.context.request.get(
      `/api/support/${caseId}`,
    );
    expect(requesterCase.status()).toBe(200);
    expect(
      JSON.stringify(await requesterCase.json()).includes(privateUrl),
    ).toBe(false);
    await assignFixtureCase(owner, caseId, f.staff.id);
    await f.staff.page.goto(`/admin/support/${caseId}`);
    await expect(
      f.staff.page.getByRole("heading", { name: "Related simulated booking" }),
    ).toBeVisible();
    expect((await f.staff.page.content()).includes(privateUrl)).toBe(false);
    const records = (
      await owner.pool.query(
        "SELECT (SELECT count(*)::int FROM session WHERE user_id=$1) AS sessions,(SELECT count(*)::int FROM booking_events WHERE booking_id=$2) AS events",
        [f.parent.id, f.bookingId],
      )
    ).rows[0];
    await restrict(f.staff.page, f.parent.id);
    for (const width of [320, 390, 1440]) {
      await f.staff.page.setViewportSize({ width, height: 900 });
      await accessible(f.staff.page);
    }
    await f.staff.page.screenshot({
      path: info.outputPath("scoped-suspended-desktop.png"),
      fullPage: true,
    });
    expect((await f.parent.context.request.get(api)).status()).toBe(404);
    expect(
      (
        await f.parent.context.request.post("/api/account/password", {
          headers: { origin: baseURL },
          data: {
            currentPassword: password,
            newPassword: nextPassword,
            confirmPassword: nextPassword,
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await f.parent.context.request.get(`/api/support/${caseId}`)).status(),
    ).toBe(403);
    const scoped = await f.staff.context.request.get(
      `/api/admin/support/${caseId}`,
    );
    expect((await scoped.json()).booking).toEqual({ available: false });
    expect(
      (
        await owner.pool.query(
          "SELECT (SELECT count(*)::int FROM session WHERE user_id=$1) AS sessions,(SELECT count(*)::int FROM booking_events WHERE booking_id=$2) AS events",
          [f.parent.id, f.bookingId],
        )
      ).rows[0],
    ).toEqual(records);
    await restrict(f.staff.page, f.parent.id, true);
    expect((await f.parent.context.request.get(api)).status()).toBe(200);
    expect(
      (
        await old.request.post("/api/auth/sign-in/email", {
          headers: { origin: baseURL },
          data: { email: f.parent.email, password },
        })
      ).status(),
    ).toBe(200);
    await f.parent.page.goto("/account");
    const region = f.parent.page.getByRole("region", {
      name: "Change password",
    });
    for (const width of [320, 390, 1440]) {
      await f.parent.page.setViewportSize({ width, height: 900 });
      await accessible(f.parent.page);
    }
    await region.getByLabel("Current password", { exact: true }).fill(password);
    await region.getByLabel("New password", { exact: true }).fill(nextPassword);
    await region
      .getByLabel("Confirm new password", { exact: true })
      .fill(nextPassword);
    const responsePromise = f.parent.page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/account/password") &&
        r.request().method() === "POST",
    );
    await region
      .getByRole("button", { name: "Change password", exact: true })
      .focus();
    await f.parent.page.keyboard.press("Enter");
    const changed = await responsePromise;
    expect(changed.status()).toBe(200);
    expect(await changed.json()).toEqual({ status: true });
    await expect(region.getByRole("status")).toHaveText(
      "Password changed. Other sessions ended.",
    );
    expect((await f.parent.context.request.get(api)).status()).toBe(200);
    expect((await old.request.get(api)).status()).toBe(401);
    expect(
      (
        await old.request.post("/api/auth/sign-in/email", {
          headers: { origin: baseURL },
          data: { email: f.parent.email, password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await old.request.post("/api/auth/sign-in/email", {
          headers: { origin: baseURL },
          data: { email: f.parent.email, password: nextPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await f.parent.page.locator("head").innerHTML()).includes(privateUrl),
    ).toBe(false);
  } finally {
    await old.close();
    await f.close();
  }
});
test("restoration leaves real TTL elapsed; guardian revocation and reassignment remove joint link/support authority", async ({
  browser,
}) => {
  const f = await fixture(browser);
  try {
    const bookingId = await familyReservation(owner.pool, {
      actorId: f.parent.id,
      learnerId: f.learnerId,
      tutorId: f.profileId,
      startMinutes: 360,
      expiresInSeconds: 4,
    });
    const api = `/api/bookings/${bookingId}/meeting-link`;
    expect(
      (
        await f.tutor.context.request.put(api, {
          headers: { origin: baseURL },
          data: {
            url: privateUrl,
            expectedRevision: 0,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(200);
    const caseResponse = await f.parent.context.request.post("/api/support", {
      headers: { origin: baseURL },
      data: {
        bookingId,
        requestKey: randomUUID(),
        category: "general",
        subject: "Synthetic expiry issue",
        body: "Fictional local only",
      },
    });
    expect(caseResponse.status()).toBe(200);
    const caseId = (await caseResponse.json()).id as string;
    await assignFixtureCase(owner, caseId, f.staff.id);
    await restrict(f.staff.page, f.parent.id);
    await new Promise((r) => setTimeout(r, 4200));
    await restrict(f.staff.page, f.parent.id, true);
    const expired = await f.parent.context.request.get(api);
    expect(await expired.json()).toEqual({ state: "expired" });
    expect(
      (
        await f.parent.context.request.get(`${api}?open=1`, { maxRedirects: 0 })
      ).headers().location,
    ).toBeUndefined();
    await f.parent.page.goto(`/bookings/${bookingId}?scope=guardian`);
    await expect(
      f.parent.page.getByText(
        "This simulation has expired. Its test meeting link is unavailable.",
      ),
    ).toBeVisible();
    await owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
      [f.parent.id, f.learnerId],
    );
    expect((await f.parent.context.request.get(api)).status()).toBe(404);
    expect(
      (
        await f.staff.context.request.get(`/api/admin/support/${caseId}`)
      ).status(),
    ).toBe(200);
    expect(
      (
        await (
          await f.staff.context.request.get(`/api/admin/support/${caseId}`)
        ).json()
      ).booking,
    ).toEqual({ available: false });
    const other = await actor(browser, "admin");
    try {
      await authorizeFixtureReviewer(owner, other.id);
      await assignFixtureCase(owner, caseId, other.id);
      expect(
        (
          await f.staff.context.request.get(`/api/admin/support/${caseId}`)
        ).status(),
      ).toBe(404);
    } finally {
      await other.context.close();
    }
    expect(
      (
        await owner.pool.query(
          "SELECT state,(SELECT count(*)::int FROM booking_events e WHERE e.booking_id=b.id) AS events FROM bookings b WHERE id=$1",
          [bookingId],
        )
      ).rows[0],
    ).toEqual({ state: "demo_reserved", events: 1 });
  } finally {
    await f.close();
  }
});

test("same-browser sign-out and different account sign-in clear prior private meeting payload and Back rechecks authority", async ({
  browser,
}) => {
  const f = await fixture(browser);
  const other = await actor(browser, "parent");
  try {
    const api = `/api/bookings/${f.bookingId}/meeting-link`;
    expect(
      (
        await f.tutor.context.request.put(api, {
          headers: { origin: baseURL },
          data: {
            url: privateUrl,
            expectedRevision: 0,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(200);
    await f.parent.page.goto(`/bookings/${f.bookingId}?scope=guardian`);
    expect((await f.parent.page.content()).includes(privateUrl)).toBe(true);
    await f.parent.page
      .getByRole("link", { name: "Change account time zone", exact: true })
      .click();
    await expect(
      f.parent.page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await f.parent.page
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(f.parent.page).toHaveURL(/\/sign-in$/);
    await expect(
      f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const signedOutHasPrivatePayload = (await f.parent.page.content()).includes(
      privateUrl,
    );
    const signedOutLinkStatus = (
      await f.parent.context.request.get(api)
    ).status();
    await f.parent.page.getByLabel("Email", { exact: true }).fill(other.email);
    await f.parent.page.getByLabel("Password", { exact: true }).fill(password);
    await f.parent.page
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(f.parent.page).toHaveURL(/\/account$/);
    await expect(
      f.parent.page.getByRole("heading", {
        name: "Your account",
        exact: true,
      }),
    ).toBeVisible();
    const differentActorHasPrivatePayload = (
      await f.parent.page.content()
    ).includes(privateUrl);
    const differentActorLinkStatus = (
      await f.parent.context.request.get(api)
    ).status();
    await f.parent.page.goBack();
    await expect(f.parent.page).toHaveURL(
      new RegExp(`/bookings/${f.bookingId}`),
    );
    const backHasPrivatePayload = (await f.parent.page.content()).includes(
      privateUrl,
    );
    await writeFile(
      ".local/four-feature/recovery-final/actor-transition-observation.json",
      JSON.stringify(
        {
          signedOutHasPrivatePayload,
          signedOutLinkStatus,
          differentActorHasPrivatePayload,
          differentActorLinkStatus,
          backHasPrivatePayload,
        },
        null,
        2,
      ) + "\n",
    );
    expect({
      signedOutHasPrivatePayload,
      signedOutLinkStatus,
      differentActorHasPrivatePayload,
      differentActorLinkStatus,
      backHasPrivatePayload,
    }).toEqual({
      signedOutHasPrivatePayload: false,
      signedOutLinkStatus: 401,
      differentActorHasPrivatePayload: false,
      differentActorLinkStatus: 404,
      backHasPrivatePayload: false,
    });
  } finally {
    await other.context.close();
    await f.close();
  }
});

test("revoked-session reauthentication as another actor clears prior meeting payload without explicit sign-out", async ({
  browser,
}) => {
  const f = await fixture(browser);
  const other = await actor(browser, "parent");
  try {
    const api = `/api/bookings/${f.bookingId}/meeting-link`;
    expect(
      (
        await f.tutor.context.request.put(api, {
          headers: { origin: baseURL },
          data: {
            url: privateUrl,
            expectedRevision: 0,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(200);
    await f.parent.page.goto(`/bookings/${f.bookingId}?scope=guardian`);
    expect((await f.parent.page.content()).includes(privateUrl)).toBe(true);
    await owner.pool.query("DELETE FROM session WHERE user_id=$1", [
      f.parent.id,
    ]);
    expect((await f.parent.context.request.get(api)).status()).toBe(401);
    await f.parent.page
      .getByRole("link", { name: "Change account time zone", exact: true })
      .click();
    await expect(f.parent.page).toHaveURL(/\/sign-in\?/);
    await expect(
      f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const beforeSigninHasPrivatePayload = (
      await f.parent.page.content()
    ).includes(privateUrl);
    await f.parent.page.getByLabel("Email", { exact: true }).fill(other.email);
    await f.parent.page.getByLabel("Password", { exact: true }).fill(password);
    await f.parent.page
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(f.parent.page).toHaveURL(/\/account$/);
    await expect(
      f.parent.page.getByRole("heading", { name: "Your account", exact: true }),
    ).toBeVisible();
    const afterSigninHasPrivatePayload = (
      await f.parent.page.content()
    ).includes(privateUrl);
    const differentActorLinkStatus = (
      await f.parent.context.request.get(api)
    ).status();
    await f.parent.page.goBack();
    await expect(f.parent.page).toHaveURL(
      new RegExp(`/bookings/${f.bookingId}`),
    );
    const backHasPrivatePayload = (await f.parent.page.content()).includes(
      privateUrl,
    );
    await writeFile(
      ".local/four-feature/recovery-final/reauth-transition-observation.json",
      JSON.stringify(
        {
          beforeSigninHasPrivatePayload,
          afterSigninHasPrivatePayload,
          differentActorLinkStatus,
          backHasPrivatePayload,
        },
        null,
        2,
      ) + "\n",
    );
    expect({
      beforeSigninHasPrivatePayload,
      afterSigninHasPrivatePayload,
      differentActorLinkStatus,
      backHasPrivatePayload,
    }).toEqual({
      beforeSigninHasPrivatePayload: false,
      afterSigninHasPrivatePayload: false,
      differentActorLinkStatus: 404,
      backHasPrivatePayload: false,
    });
  } finally {
    await other.context.close();
    await f.close();
  }
});

for (const sessionLoss of ["revoked", "expired"] as const) {
  test(`${sessionLoss} session clears the sign-in document and Back before any successful reauthentication`, async ({
    browser,
  }) => {
    const f = await fixture(browser);
    try {
      const api = `/api/bookings/${f.bookingId}/meeting-link`;
      expect(
        (
          await f.tutor.context.request.put(api, {
            headers: { origin: baseURL },
            data: {
              url: privateUrl,
              expectedRevision: 0,
              requestId: randomUUID(),
            },
          })
        ).status(),
      ).toBe(200);
      const privatePath = `/bookings/${f.bookingId}?scope=guardian`;
      await f.parent.page.goto(privatePath);
      expect((await f.parent.page.content()).includes(privateUrl)).toBe(true);
      if (sessionLoss === "revoked")
        await owner.pool.query("DELETE FROM session WHERE user_id=$1", [
          f.parent.id,
        ]);
      else
        await owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
          [f.parent.id],
        );
      const rejectedStatus = (await f.parent.context.request.get(api)).status();
      expect(rejectedStatus).toBe(401);
      await f.parent.page
        .getByRole("link", { name: "Change account time zone", exact: true })
        .click();
      await expect(
        f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
      ).toBeVisible();
      await expect(f.parent.page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
      const hasPrivatePayload = async () => {
        // A legitimate auth/Back document replacement can destroy the read's
        // execution context. Capture one complete root through Playwright's
        // context-aware wait; check privacy only after this snapshot resolves.
        const snapshot = await f.parent.page.waitForFunction(() => {
          if (document.readyState !== "complete") return "";
          return document.documentElement.outerHTML;
        });
        const html = await snapshot.jsonValue();
        await snapshot.dispose();
        return [
          privateUrl,
          encodeURIComponent(privateUrl),
          ...new URL(privateUrl).searchParams.values(),
        ].some((value) => html.includes(value));
      };
      const beforeSigninHasPrivatePayload = await hasPrivatePayload();
      expect(beforeSigninHasPrivatePayload).toBe(false);
      await f.parent.page
        .getByLabel("Email", { exact: true })
        .fill(f.parent.email);
      await f.parent.page
        .getByLabel("Password", { exact: true })
        .fill("Wrong-synthetic-password-123");
      await f.parent.page
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(
        f.parent.page.getByRole("main").getByRole("alert"),
      ).toContainText("Sign-in could not be completed");
      const failedSigninHasPrivatePayload = await hasPrivatePayload();
      expect(failedSigninHasPrivatePayload).toBe(false);
      await f.parent.page.goBack();
      await expect(
        f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
      ).toBeVisible();
      await expect(f.parent.page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(privatePath)}`),
      );
      const backHasPrivatePayload = await hasPrivatePayload();
      expect(backHasPrivatePayload).toBe(false);
      expect((await f.parent.context.request.get(api)).status()).toBe(401);
      await writeFile(
        `.local/four-feature/recovery-final/${sessionLoss}-abandoned-reauth-observation.json`,
        JSON.stringify(
          {
            rejectedStatus,
            beforeSigninHasPrivatePayload,
            failedSigninHasPrivatePayload,
            backHasPrivatePayload,
            successfulReauthentication: false,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await f.close();
    }
  });
}
