import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";

if (
  !process.env.LEARLI_PERFORMANCE_ROOT ||
  realpathSync(process.env.LEARLI_PERFORMANCE_ROOT) !==
    realpathSync(process.cwd()) ||
  !realpathSync(process.cwd()).startsWith(
    `${realpathSync("/tmp")}/learli-booking-perf-`,
  )
)
  throw new Error("Explicit owned performance copy required");
const fixture = JSON.parse(
  readFileSync(".local/performance-fixture.json", "utf8"),
);
if (fixture.origin !== "http://127.0.0.1:3410")
  throw new Error("Owned origin required");
const browser = await chromium.launch();
const contexts = [];
const results = {
  parentReschedule: false,
  parentCancellation: false,
  studentCancellation: false,
  responsive: [],
};
try {
  const actors = {};
  for (const role of ["parent", "student", "tutor"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    contexts.push(context);
    await context.addCookies(
      fixture[role].cookie.split("; ").map((part) => {
        const index = part.indexOf("=");
        return {
          name: part.slice(0, index),
          value: part.slice(index + 1),
          url: fixture.origin,
        };
      }),
    );
    actors[role] = context;
  }
  const open = async (role, route) => {
    const page = await actors[role].newPage();
    const response = await page.goto(fixture.origin + route);
    expect(response.status()).toBe(200);
    return page;
  };
  const currentResponse = await actors.parent.request.get(
    `${fixture.origin}/api/bookings/${fixture.parent.bookingId}?scope=guardian`,
  );
  expect(currentResponse.status()).toBe(200);
  const current = await currentResponse.json();
  fixture.parent.bookingId = current.currentHeadId;
  async function submit(page, endpoint, name) {
    let resolve, reject;
    const captured = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const url = fixture.origin + endpoint;
    await page.route(
      url,
      async (route) => {
        try {
          const response = await route.fetch({
            maxRetries: 0,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          const value = await response.json();
          await route.fulfill({ response });
          resolve(value);
        } catch (error) {
          reject(error);
          await route.abort();
        }
      },
      { times: 1 },
    );
    try {
      const [value] = await Promise.all([
        captured,
        page.getByRole("button", { name, exact: true }).click(),
      ]);
      return value;
    } finally {
      await page.unroute(url);
    }
  }
  const parentDashboard = await open("parent", "/parent");
  const tutorDetail = await open(
    "tutor",
    `/bookings/${fixture.parent.bookingId}?scope=tutor`,
  );
  const tutorStudent = await open(
    "tutor",
    `/bookings/${fixture.student.bookingId}?scope=tutor`,
  );
  const studentDetail = await open(
    "student",
    `/bookings/${fixture.student.bookingId}?scope=student`,
  );
  const change = await open(
    "parent",
    `/bookings/${fixture.parent.bookingId}/reschedule?scope=guardian`,
  );
  for (const width of [390, 1440]) {
    await change.setViewportSize({ width, height: 900 });
    await expect(change.locator('input[name="slot"]').first()).toBeVisible();
    expect(
      await change.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    results.responsive.push(width);
  }
  await change.locator('input[name="slot"]').first().check();
  const moveEndpoint = `/api/bookings/${fixture.parent.bookingId}/workflow/reschedule`;
  const moved = await submit(change, moveEndpoint, "Reschedule booking");
  await expect(tutorDetail).toHaveURL(
    `${fixture.origin}/bookings/${moved.id}?scope=tutor`,
    { timeout: 10000 },
  );
  await expect(change).toHaveURL(
    `${fixture.origin}/bookings/${moved.id}?scope=guardian`,
  );
  await expect(
    parentDashboard.locator(`a[href*="/bookings/${moved.id}"]`).first(),
  ).toBeVisible({ timeout: 10000 });
  const detailResponse = await actors.tutor.request.get(
    `${fixture.origin}/api/bookings/${moved.id}?scope=tutor`,
  );
  expect(detailResponse.status()).toBe(200);
  const detail = await detailResponse.json();
  await expect(
    tutorDetail.getByText(detail.time.time, { exact: true }).first(),
  ).toBeVisible();
  results.parentReschedule = true;
  const cancelEndpoint = `/api/bookings/${moved.id}/workflow/cancel`;
  await change.locator("summary").filter({ hasText: "Cancel booking" }).click();
  await submit(change, cancelEndpoint, "Cancel booking");
  await expect(
    tutorDetail.getByRole("heading", {
      level: 1,
      name: "Cancelled",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    parentDashboard.getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible({ timeout: 10000 });
  results.parentCancellation = true;
  const studentRead = await actors.student.request.get(
    `${fixture.origin}/api/bookings/${fixture.student.bookingId}?scope=student`,
  );
  expect(studentRead.status()).toBe(200);
  const studentBooking = await studentRead.json();
  const studentCancel = await actors.student.request.post(
    `${fixture.origin}/api/bookings/${fixture.student.bookingId}/workflow/cancel`,
    {
      headers: { origin: fixture.origin },
      data: {
        requestId: randomUUID(),
        expectedRevision: studentBooking.workflowRevision,
        reasonCode: "local_participant_change",
      },
    },
  );
  expect(studentCancel.status()).toBe(200);
  for (const page of [studentDetail, tutorStudent])
    await expect(
      page.getByRole("heading", { level: 1, name: "Cancelled", exact: true }),
    ).toBeVisible({ timeout: 10000 });
  results.studentCancellation = true;
  writeFileSync(
    ".local/live-verification.json",
    JSON.stringify(results, null, 2),
    { mode: 0o600 },
  );
  console.log(
    "Parent reschedule/cancellation and Student cancellation updated open participant pages; phone/desktop checks passed.",
  );
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
