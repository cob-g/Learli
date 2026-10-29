import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  owner,
  ensureOwner,
  closeOwner,
  fixture,
  register,
  admin,
  accessible,
  decision,
  noJs,
  mirrorOrigin,
} from "./w8-fixtures";
import { provisionScreeningAssignment } from "../../src/features/tutor-screening/fixture-tooling";
import { provisionSafetyRestriction } from "../../src/features/safeguarding/fixture-tooling";
import { restoreW6BrowserTutor } from "../support/w6-browser-fixtures";
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.beforeAll(ensureOwner);
test.afterAll(closeOwner);

function localPickerValue(instant: string | Date) {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function screeningCheckLabel(code: string) {
  if (code === "identity") return "Identity check";
  if (code === "eligibility") return "Eligibility check";
  return code
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

test("ordinary shipped screening and intake remain disabled without synthetic composition", async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: process.env.APP_URL }),
    p = await c.newPage();
  for (const [route, input] of [
    ["/api/safeguarding/cases", { body: "must not store" }],
    ["/api/tutor/screening/" + randomUUID(), { requestKey: randomUUID() }],
  ] as const) {
    const r = await c.request.post(route, {
      headers: { origin: process.env.APP_URL! },
      data: input,
    });
    expect(r.status()).toBe(503);
    expect(await r.text()).not.toContain("must not store");
  }
  await p.goto("/safeguarding/report");
  await expect(p.getByLabel("Concern")).toHaveCount(0);
  const native = await browser.newContext({
      baseURL: process.env.APP_URL,
      javaScriptEnabled: false,
    }),
    nativePage = await native.newPage();
  await nativePage.goto("/sign-in");
  await expect(
    nativePage.getByText(/Enable JavaScript to use account forms/),
  ).toBeVisible();
  await expect(nativePage.getByLabel("Email", { exact: true })).toBeDisabled();
  await expect(
    nativePage.getByLabel("Password", { exact: true }),
  ).toBeDisabled();
  await expect(
    nativePage.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  expect(await nativePage.locator("form").getAttribute("method")).toBe("post");
  expect(await nativePage.locator("form").getAttribute("action")).toBe(
    "/api/auth/sign-in/email",
  );
  expect(
    await nativePage
      .locator("form")
      .evaluate((form) =>
        Array.from(new FormData(form as HTMLFormElement).keys()),
      ),
  ).toEqual([]);
  await native.close();
  await c.close();
});
test("application, missing-check denial, page evidence, current discovery, amendment/restriction denials", async ({
  browser,
}, info) => {
  const f = await fixture(),
    tutor = await register(browser, "Fictional W8 browser math tutor");
  await tutor.page.goto("/become-a-tutor");
  await tutor.page
    .getByRole("button", { name: "Start tutor application", exact: true })
    .click();
  await expect(tutor.page).toHaveURL(mirrorOrigin + "/tutor/profile");
  await tutor.page
    .getByLabel("Headline")
    .fill("Fictional W8 college math tutor");
  await tutor.page
    .getByLabel("Introduction")
    .fill("Fictional screening browser introduction.");
  await tutor.page
    .getByLabel("Teaching background")
    .fill("Fictional software test only.");
  await tutor.page.getByLabel("Time zone").selectOption("Asia/Manila");
  await tutor.page
    .getByRole("group", { name: "Math", exact: true })
    .getByLabel("College Support")
    .check();
  await tutor.page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(tutor.page.getByRole("status")).toHaveText(
    "Application submitted.",
  );
  const profile = (
    await owner.pool.query(
      "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
      [tutor.id],
    )
  ).rows[0];
  await tutor.page.goto("/tutor/screening");
  await tutor.page
    .getByRole("button", { name: "Request synthetic screening", exact: true })
    .click();
  await expect(
    tutor.page.getByText(/Synthetic screening: pending/),
  ).toBeVisible();
  await provisionScreeningAssignment(
    owner,
    profile.id,
    f.accounts.reviewer.id,
    "synthetic_readiness",
    new Date(f.screening.validUntil),
  );
  // Existing demo scheduling service supplies advisory readiness candidates.
  const a = await tutor.context.request.put("/api/tutor/availability", {
    headers: { origin: mirrorOrigin },
    data: {
      version: 0,
      timezone: "Asia/Manila",
      windows: Array.from({ length: 7 }, (_, i) => ({
        isoWeekday: i + 1,
        startMinute: 0,
        endMinute: 1440,
      })),
    },
  });
  expect(a.status()).toBe(200);
  const reviewer = await admin(browser, "reviewer");
  // A different eligible tutor may have the same display name. Keep that
  // inventory present throughout approval, amendment and exact-target denials.
  const decoy = await register(browser, "Fictional W8 browser math tutor"),
    retainedTutor = { id: decoy.id, profileId: "", slug: "" };
  const application = await decoy.context.request.post(
    "/api/tutor/application",
    {
      headers: { origin: mirrorOrigin },
      data: {},
    },
  );
  expect(application.status()).toBe(200);
  await restoreW6BrowserTutor(owner, decoy.context, reviewer.context, {
    origin: mirrorOrigin,
    reviewer: { id: reviewer.id },
    tutor: retainedTutor,
  });
  const profileHref = `/readiness/tutors/${profile.slug}`,
    retainedHref = `/readiness/tutors/${retainedTutor.slug}`;
  await reviewer.page.goto("/admin/tutors");
  await reviewer.page
    .getByRole("link", { name: "Fictional W8 browser math tutor", exact: true })
    .and(reviewer.page.locator(`a[href="/admin/tutors/${profile.id}"]`))
    .click();
  await decision(reviewer.page, "Approve synthetic screening");
  await expect(
    reviewer.page.locator("#main-content").getByRole("alert"),
  ).toContainText("required");
  await expect(
    reviewer.page.locator("#main-content").getByRole("alert"),
  ).toBeFocused();
  await accessible(reviewer.page, info, "screening");
  await noJs(browser, reviewer.context, "/admin/tutors/" + profile.id);
  await expect(reviewer.page.getByLabel("Evidence reference")).toHaveCount(0);
  const reviewerTimeZone = await reviewer.page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  await expect(reviewer.page.getByText(/Times entered here use/)).toContainText(
    reviewerTimeZone,
  );
  for (const code of ["synthetic_check_a", "synthetic_check_b"]) {
    await reviewer.page.getByLabel("Required check").selectOption(code);
    await reviewer.page
      .getByLabel("Checked at")
      .fill(localPickerValue(new Date(Date.now() - 1000)));
    await reviewer.page
      .getByLabel("Expires at")
      .fill(localPickerValue(f.screening.validUntil));
    await reviewer.page
      .getByRole("button", { name: "Record check", exact: true })
      .click();
    const checkCard = reviewer.page
      .getByRole("listitem")
      .filter({ hasText: screeningCheckLabel(code) });
    await expect(
      checkCard.getByText("Passed and current", { exact: true }),
    ).toBeVisible();
    await expect(checkCard.locator("code")).toHaveText(
      /^screening:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }
  const approvalTrigger = reviewer.page.getByRole("button", {
    name: "Approve synthetic screening",
    exact: true,
  });
  await approvalTrigger.focus();
  await expect(approvalTrigger).toBeFocused();
  await reviewer.page.keyboard.press("Enter");
  await expect(
    reviewer.page.getByRole("dialog", { name: "Change synthetic screening?" }),
  ).toBeVisible();
  await reviewer.page.keyboard.press("Escape");
  await expect(
    reviewer.page.getByRole("button", {
      name: "Approve synthetic screening",
      exact: true,
    }),
  ).toBeFocused();
  await decision(reviewer.page, "Approve synthetic screening");
  await expect(reviewer.page.getByText(/State: approved/)).toBeVisible();
  await tutor.page.goto("/readiness/tutors?subject=math&level=college_support");
  const intendedRow = tutor.page.getByRole("listitem").filter({
    has: tutor.page.locator(`a[href="${profileHref}"]`),
  });
  await expect(
    intendedRow.getByRole("heading", {
      name: "Fictional W8 browser math tutor",
      exact: true,
    }),
  ).toBeVisible();
  await expect(tutor.page.locator(`a[href="${retainedHref}"]`)).toBeVisible();
  await accessible(tutor.page, info, "readiness-directory");
  await intendedRow
    .getByRole("link", { name: "View synthetic profile", exact: true })
    .click();
  await expect(tutor.page).toHaveURL(mirrorOrigin + profileHref);
  await expect(
    tutor.page.getByRole("heading", { name: "Synthetic slot preview" }),
  ).toBeVisible();
  await expect(
    tutor.page.getByText("No open synthetic times right now."),
  ).toHaveCount(0);
  await tutor.page.goto("/readiness/get-matched");
  await expect(
    tutor.page
      .getByRole("link", {
        name: "Fictional W8 browser math tutor",
        exact: true,
      })
      .and(tutor.page.locator(`a[href="${profileHref}"]`)),
  ).toBeVisible();
  await tutor.page.goto("/tutor/profile");
  await tutor.page
    .getByLabel("Introduction")
    .fill("Fictional edited introduction.");
  await tutor.page
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await tutor.page.goto("/readiness/tutors");
  await expect(
    intendedRow.getByRole("heading", {
      name: "Fictional W8 browser math tutor",
      exact: true,
    }),
  ).toBeVisible();
  await provisionSafetyRestriction(
    owner,
    f.accounts.restriction.id,
    tutor.id,
    new Date(f.safeguarding.validUntil),
  );
  const restriction = await admin(browser, "restriction");
  await restriction.page.goto("/admin/safeguarding/accounts/" + tutor.id);
  await restriction.page
    .getByRole("button", { name: "Restrict synthetic account" })
    .click();
  await restriction.page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm access action" })
    .click();
  await expect(restriction.page.getByText(/suspended/)).toBeVisible();
  await reviewer.page.goto("/readiness/tutors");
  await expect(reviewer.page.locator(`a[href="${profileHref}"]`)).toHaveCount(
    0,
  );
  await expect(
    reviewer.page.locator(`a[href="${retainedHref}"]`),
  ).toBeVisible();
  await restriction.page
    .getByRole("button", { name: "Restore synthetic account" })
    .click();
  await restriction.page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm access action" })
    .click();
  await expect(restriction.page.getByText(/active/)).toBeVisible();
  await reviewer.page.goto("/admin/tutors/" + profile.id);
  await decision(reviewer.page, "Suspend screening");
  await expect(reviewer.page.getByText(/State: suspended/)).toBeVisible();
  await reviewer.page
    .getByLabel("Required check")
    .selectOption("synthetic_check_a");
  await reviewer.page.getByLabel("Check result").selectOption("revoked");
  await reviewer.page
    .getByLabel("Checked at")
    .fill(localPickerValue(new Date(Date.now() - 1000)));
  await reviewer.page
    .getByLabel("Expires at")
    .fill(localPickerValue(f.screening.validUntil));
  await reviewer.page.getByRole("button", { name: "Record check" }).click();
  const revokedCheck = reviewer.page
    .getByRole("listitem")
    .filter({ hasText: screeningCheckLabel("synthetic_check_a") });
  await expect(
    revokedCheck.getByText("Revoked", { exact: true }),
  ).toBeVisible();
  await decision(reviewer.page, "Reinstate synthetic screening");
  await expect(
    reviewer.page.locator("#main-content").getByRole("alert"),
  ).toContainText("required");
  await reviewer.page.goto("/readiness/tutors/" + profile.slug);
  await expect(
    reviewer.page.getByRole("heading", {
      name: "Synthetic profile unavailable",
    }),
  ).toBeVisible();
  await reviewer.page.goto("/readiness/get-matched");
  await expect(reviewer.page.locator(`a[href="${profileHref}"]`)).toHaveCount(
    0,
  );
  await expect(
    reviewer.page.locator(`a[href="${retainedHref}"]`),
  ).toBeVisible();
  for (const c of [
    tutor.context,
    decoy.context,
    reviewer.context,
    restriction.context,
  ])
    await c.close();
});
