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
  noJs,
  mirrorOrigin,
} from "./w8-fixtures";
import { provisionResponseGrant } from "../../src/features/safeguarding/fixture-tooling";
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });
test.beforeAll(ensureOwner);
test.afterAll(closeOwner);
test("report, metadata dispatch, acknowledgement, escalation and document lifetime privacy", async ({
  browser,
}, info) => {
  const f = await fixture(),
    requester = await register(browser, "Fictional W8 concern requester"),
    body = "Fictional private concern " + randomUUID(),
    subject = "Fictional private subject " + randomUUID();
  await requester.page.goto("/safeguarding/report");
  await accessible(requester.page, info, "report");
  await noJs(browser, requester.context, "/safeguarding/report");
  await requester.page.getByLabel("Report subject").fill(subject);
  await requester.page.getByLabel("Concern", { exact: true }).fill(body);
  await requester.page
    .getByRole("button", { name: "Save synthetic report" })
    .click();
  await expect(requester.page).toHaveURL(/\/safeguarding\/cases\/[^/]+$/);
  const caseId = requester.page.url().split("/").at(-1)!;
  await expect(requester.page.getByText(body, { exact: true })).toBeVisible();
  const expiry = new Date(f.safeguarding.validUntil);
  await provisionResponseGrant(
    owner,
    caseId,
    f.accounts.dispatcher.id,
    "dispatcher",
    expiry,
  );
  await provisionResponseGrant(
    owner,
    caseId,
    f.accounts.reviewer.id,
    "reviewer_choice",
    expiry,
  );
  await provisionResponseGrant(
    owner,
    caseId,
    f.accounts.escalation.id,
    "reviewer_choice",
    expiry,
    "authorized",
    true,
  );
  const dispatcher = await admin(browser, "dispatcher");
  const response = await dispatcher.page.goto("/admin/safeguarding");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(await dispatcher.page.content()).not.toContain(body);
  expect(await dispatcher.page.content()).not.toContain(subject);
  await accessible(dispatcher.page, info, "dispatch-queue");
  await dispatcher.page
    .getByRole("link", { name: "Open case", exact: true })
    .and(
      dispatcher.page.locator(
        `a[href="/admin/safeguarding/${caseId}?scope=dispatcher"]`,
      ),
    )
    .click();
  expect(await dispatcher.page.content()).not.toContain(body);
  const dispatchApi = await dispatcher.context.request.get(
    "/api/admin/safeguarding/" + caseId + "?scope=dispatcher",
    { headers: { origin: mirrorOrigin } },
  );
  expect(dispatchApi.status()).toBe(200);
  expect(await dispatchApi.text()).not.toMatch(
    /Fictional private|body|subject|learner|meeting|bookingId/,
  );
  await dispatcher.page
    .getByLabel("Exact permitted reviewer")
    .selectOption(f.accounts.reviewer.id);
  await dispatcher.page
    .getByRole("button", { name: "Save assignment" })
    .click();
  await expect(dispatcher.page.getByText(/Revision 1/).first()).toBeVisible();
  const reviewer = await admin(browser, "reviewer");
  await reviewer.page.goto("/admin/safeguarding/" + caseId);
  await expect(reviewer.page.getByText(body, { exact: true })).toBeVisible();
  await reviewer.page
    .getByRole("button", { name: "Close synthetic case", exact: true })
    .click();
  await expect(
    reviewer.page.locator("#main-content").getByRole("alert"),
  ).toContainText("changed");
  await expect(
    reviewer.page.locator("#main-content").getByRole("alert"),
  ).toBeFocused();
  await accessible(reviewer.page, info, "case-review");
  await noJs(browser, reviewer.context, "/admin/safeguarding/" + caseId);
  await reviewer.page
    .getByRole("button", { name: "Acknowledge assignment" })
    .click();
  await expect(
    reviewer.page.getByText("Current assignment acknowledged", { exact: true }),
  ).toBeVisible();
  await reviewer.page
    .getByLabel("Escalation reviewer")
    .selectOption(f.accounts.escalation.id);
  await reviewer.page
    .getByRole("button", { name: "Request escalation" })
    .click();
  await expect(
    reviewer.page.getByText("Escalation requested", { exact: true }),
  ).toBeVisible();
  await dispatcher.page.reload();
  await dispatcher.page
    .getByLabel("Assignment action")
    .selectOption("escalate");
  await dispatcher.page
    .getByLabel("Exact permitted reviewer")
    .selectOption(f.accounts.escalation.id);
  await dispatcher.page
    .getByRole("button", { name: "Save assignment" })
    .click();
  await expect(dispatcher.page.getByText(/Revision 4/).first()).toBeVisible();
  expect(await dispatcher.page.content()).not.toContain(body);
  // A prior document must not retain its private inline bootstrap through auth navigation.
  await reviewer.page.goto("/sign-in");
  await expect(reviewer.page).toHaveURL(/\/sign-in$/);
  await expect(
    reviewer.page.getByLabel("Test email", { exact: true }),
  ).toBeVisible();
  expect(await reviewer.page.content()).not.toContain(body);
  await reviewer.page.goBack();
  await expect(reviewer.page.getByText(body, { exact: true })).toHaveCount(0);
  expect(await reviewer.page.content()).not.toContain(body);
  await reviewer.page.goto("/admin/safeguarding/" + caseId);
  await expect(reviewer.page.getByText(body, { exact: true })).toHaveCount(0);
  const denial = await reviewer.context.request.get(
    "/api/admin/safeguarding/" + caseId,
    { headers: { origin: mirrorOrigin } },
  );
  expect(denial.status()).toBe(404);
  expect(await denial.text()).not.toContain(body);
  const escalation = await admin(browser, "escalation");
  await escalation.page.goto("/admin/safeguarding/" + caseId);
  await expect(
    escalation.page.getByText("Current assignment not acknowledged"),
  ).toBeVisible();
  await escalation.page
    .getByRole("button", { name: "Acknowledge assignment" })
    .click();
  await expect(
    escalation.page.getByText("Current assignment acknowledged", {
      exact: true,
    }),
  ).toBeVisible();
  await escalation.page
    .getByRole("button", { name: "Close synthetic case", exact: true })
    .click();
  await expect(escalation.page.getByText(/closed · Revision 6/)).toBeVisible();
  await escalation.page
    .getByRole("button", { name: "Reopen synthetic case", exact: true })
    .click();
  await expect(
    escalation.page.getByText(/in_review · Revision 7/),
  ).toBeVisible();
  await expect(
    escalation.page.getByText("Current assignment not acknowledged"),
  ).toBeVisible();
  const outsider = await admin(browser, "outsider");
  await outsider.page.goto("/admin/safeguarding/" + caseId);
  expect(await outsider.page.content()).not.toContain(body);
  await expect(outsider.page.getByLabel("Escalation reviewer")).toHaveCount(0);
  // Logout replaces the full private document; Back must fetch current authority again.
  const signOut = await escalation.context.request.post("/api/auth/sign-out", {
    headers: { origin: mirrorOrigin },
    data: {},
  });
  expect(signOut.status()).toBe(200);
  await escalation.page.goto("/sign-in");
  await expect(
    escalation.page.getByLabel("Test email", { exact: true }),
  ).toBeVisible();
  expect(await escalation.page.content()).not.toContain(body);
  await escalation.page.goBack();
  await expect(escalation.page).toHaveURL(/\/sign-in\?next=/);
  expect(await escalation.page.content()).not.toContain(body);
  for (const context of [
    requester.context,
    dispatcher.context,
    reviewer.context,
    escalation.context,
    outsider.context,
  ])
    await context.close();
});
