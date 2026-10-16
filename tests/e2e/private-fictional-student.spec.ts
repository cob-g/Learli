import {
  test,
  expect,
  type Page,
  type Locator,
  type Request,
  type Route,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import type { WorkflowReceipt } from "../../src/features/booking-workflows/model";
import type { BookingPage } from "../../src/features/bookings/read-model";
import {
  PrivateStudentBrowser,
  resetPrivateBrowserAuthAttempts,
  type CollegeActor,
} from "../support/private-student-browser";
import { historicalWorkflowBooking } from "../support/booking-workflows-fixtures";

test.use({ trace: "off", screenshot: "off", video: "off" });
const h = new PrivateStudentBrowser();
const meeting = "https://meet.google.com/abc-defg-hij";
const replacementMeeting = "https://meet.google.com/klm-nopq-rst";
type CreateInput = {
  learnerId: string;
  tutorSlug: string;
  subjectSlug: string;
  displayTimezone: string;
  startAtUtc: string;
  endAtUtc: string;
  idempotencyKey: string;
};
type PublicChoice = Pick<
  CreateInput,
  "tutorSlug" | "subjectSlug" | "displayTimezone" | "startAtUtc" | "endAtUtc"
> & { level: "college_support" };
type ChangeInput = {
  requestId: string;
  expectedRevision: number;
  reasonCode: string;
  startAtUtc?: string;
  endAtUtc?: string;
  displayTimezone?: string;
};
type SavedBooking = {
  id: string;
  logical_booking_id: string;
  replaces_booking_id: string | null;
  revision: number;
  workflow_revision: number;
  state: string;
  start_at_utc: Date;
  end_at_utc: Date;
  expires_at: Date;
  learner_id: string;
  tutor_id: string;
  booked_by_user_id: string;
  subject_slug: string;
  workflow_policy_id: string;
  admission_policy_id: string;
};

test.beforeAll(async () => {
  h.load();
  await resetPrivateBrowserAuthAttempts(h.owner);
});
test.afterAll(() => h.close());

function requestAt(endpoint: string) {
  return (request: { url(): string; method(): string }) =>
    request.method() === "POST" && new URL(request.url()).pathname === endpoint;
}

async function submit<T>(
  page: Page,
  endpoint: string,
  button: Locator,
  double = false,
) {
  await expect(button).toBeEnabled();
  const url = new URL(endpoint, h.packet.origin).href;
  expect(new URL(page.url()).origin).toBe(h.packet.origin);
  let resolveCapture!: (value: { input: T; receipt: WorkflowReceipt }) => void;
  let rejectCapture!: (error: unknown) => void;
  const captured = new Promise<{ input: T; receipt: WorkflowReceipt }>(
    (resolve, reject) => {
      resolveCapture = resolve;
      rejectCapture = reject;
    },
  );
  let posts = 0;
  const countPost = (request: Request) => {
    if (request.method() === "POST" && request.url() === url) posts++;
  };
  const passthrough = async (route: Route) => {
    try {
      expect(route.request().method()).toBe("POST");
      const input = route.request().postDataJSON() as T;
      // Forward the original request exactly once. Buffer its actual response
      // before the page can navigate; never continue or synthesize a receipt.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      const receipt = (await response.json()) as WorkflowReceipt;
      await route.fulfill({ response });
      resolveCapture({ input, receipt });
    } catch (error) {
      rejectCapture(error);
      await route.abort().catch(() => {});
    }
  };
  page.on("request", countPost);
  try {
    await page.route(url, passthrough, { times: 1 });
    const [result] = await Promise.all([
      captured,
      double ? button.dblclick() : button.click(),
    ]);
    expect(posts).toBe(1);
    return result;
  } finally {
    page.off("request", countPost);
    await page.unroute(url, passthrough);
  }
}

async function savedBooking(id: string) {
  return (
    await h.owner.pool.query<SavedBooking>(
      "SELECT b.id,b.logical_booking_id,b.replaces_booking_id,b.revision,b.workflow_revision,b.state,b.start_at_utc,b.end_at_utc,b.expires_at,b.learner_id,b.tutor_id,b.booked_by_user_id,s.slug subject_slug,b.workflow_policy_id,b.admission_policy_id FROM bookings b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1",
      [id],
    )
  ).rows[0];
}

async function eventCount(id: string, event: string) {
  return (
    await h.owner.pool.query<{ n: number }>(
      "SELECT count(*)::int n FROM booking_lifecycle_events WHERE booking_id=$1 AND event=$2",
      [id, event],
    )
  ).rows[0].n;
}

async function post(actor: CollegeActor, endpoint: string, data: object) {
  return actor.context.request.post(endpoint, {
    headers: { origin: h.packet.origin },
    data,
  });
}

async function retry(
  actor: CollegeActor,
  endpoint: string,
  input: object,
  receipt: WorkflowReceipt,
) {
  const response = await post(actor, endpoint, input);
  expect(response.status()).toBe(200);
  const repeated = (await response.json()) as WorkflowReceipt;
  expect(repeated.id).toBe(receipt.id);
  expect(repeated.eventId).toBe(receipt.eventId);
  expect(repeated.logicalBookingId).toBe(receipt.logicalBookingId);
}

async function chooseFutureTime(
  page: Page,
  selector: string,
  earliest: number,
  exclude?: string,
) {
  const options = await page
    .locator(selector)
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value),
    );
  const selected = options.find(
    (value) =>
      Date.parse(value.split("|")[0]) >= earliest &&
      value.split("|")[0] !== exclude,
  );
  expect(Boolean(selected)).toBe(true);
  await page.locator(`${selector}[value="${selected}"]`).check();
  return selected!.split("|")[0];
}

function assertPublicChoice(
  path: string,
  expected: PublicChoice,
  pathname = "/bookings/new",
) {
  const value = new URL(path, h.packet.origin);
  expect(value.origin).toBe(h.packet.origin);
  expect(value.pathname).toBe(pathname);
  expect([...value.searchParams.keys()].sort()).toEqual(
    Object.keys(expected).sort(),
  );
  for (const [key, selected] of Object.entries(expected))
    expect(value.searchParams.get(key)).toBe(selected);
}

async function anonymousCollegeChoice(page: Page, tutorSlug: string) {
  await page.goto(`/tutors/${tutorSlug}`);
  await page.getByLabel("Subject", { exact: true }).selectOption("science");
  await page
    .getByLabel("Level", { exact: true })
    .selectOption("college_support");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  const startAtUtc = await chooseFutureTime(
    page,
    'input[name="time"]',
    Date.now() + 4 * 3600000,
  );
  await page
    .getByRole("button", { name: "Review booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const next = new URL(page.url()).searchParams.get("next");
  expect(Boolean(next)).toBe(true);
  const query = new URL(next!, h.packet.origin).searchParams;
  const selection: PublicChoice = {
    tutorSlug,
    subjectSlug: "science",
    level: "college_support",
    displayTimezone: "Asia/Manila",
    startAtUtc,
    endAtUtc: query.get("endAtUtc")!,
  };
  expect(Date.parse(selection.endAtUtc) - Date.parse(startAtUtc)).toBe(3600000);
  assertPublicChoice(next!, selection);
  return { next: next!, selection };
}

async function requestChoices(
  actor: CollegeActor,
  learnerId: string,
  tutorSlug: string,
  selected?: { startAtUtc: string; endAtUtc: string },
) {
  const query = new URLSearchParams({
    learnerId,
    tutorSlug,
    subjectSlug: "science",
    displayTimezone: "Asia/Manila",
    ...(selected ? { level: "college_support", ...selected } : {}),
  });
  await actor.page.goto(`/bookings/new?${query}`);
  await actor.page
    .getByRole("button", { name: "Show available times", exact: true })
    .click();
  await expect(
    actor.page.getByRole("button", { name: "Request booking", exact: true }),
  ).toBeEnabled();
}

async function saveMeeting(
  tutor: CollegeActor,
  bookingId: string,
  url: string,
) {
  await tutor.page.goto(`/bookings/${bookingId}?scope=tutor`);
  await tutor.page
    .getByLabel("Zoom or Google Meet link", { exact: true })
    .fill(url);
  await tutor.page
    .getByRole("button", { name: "Save meeting link", exact: true })
    .click();
  await expect(
    tutor.page
      .getByRole("status")
      .filter({ hasText: "Private meeting link saved." }),
  ).toBeVisible();
  await tutor.page.reload();
  const response = await tutor.context.request.get(
    `/api/bookings/${bookingId}/meeting-link`,
  );
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.state).toBe("present");
  expect(value.url === url).toBe(true);
}

async function openMeeting(
  actor: CollegeActor,
  bookingId: string,
  destination: string,
) {
  await actor.context.route("https://meet.google.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Intercepted fictional College meeting</title>",
    }),
  );
  await actor.page.goto(
    `/bookings/${bookingId}?scope=${actor.email.startsWith("college-tutor-") ? "tutor" : "student"}`,
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
  expect(external.url() === destination).toBe(true);
  await external.close();
}

async function noMeeting(
  actor: CollegeActor,
  id: string,
  state: "missing" | "expired",
) {
  const response = await actor.context.request.get(
    `/api/bookings/${id}/meeting-link`,
  );
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.state).toBe(state);
  expect("url" in value).toBe(false);
  expect(
    (
      await actor.context.request.get(
        `/api/bookings/${id}/meeting-link?open=1`,
        { maxRedirects: 0 },
      )
    ).status(),
  ).toBe(404);
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
    // Private document text, evidence and links are deliberately omitted.
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  }
}

async function accessibleCollegeOnboarding(
  page: Page,
  selection: PublicChoice,
) {
  // Reload the current intent-bearing URL; a bare setup path would discard it.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Set up College Student", exact: true }),
  ).toBeVisible();
  const next = new URL(page.url()).searchParams.get("next");
  expect(Boolean(next)).toBe(true);
  assertPublicChoice(next!, selection);
  await responsive(page);
  const request = page.getByRole("link", {
    name: "Request independent admission",
    exact: true,
  });
  // Reach the action through actual keyboard navigation, without depending on
  // its position among shared navigation links or setting focus by script.
  for (let tabs = 0; tabs < 30; tabs++) {
    await page.keyboard.press("Tab");
    if (await request.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(request).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/learner-admission/new" &&
      url.searchParams.get("management") === "self",
  );
  assertPublicChoice(new URL(page.url()).searchParams.get("next")!, selection);
  await expect(page.getByLabel("Request type", { exact: true })).toHaveValue(
    "self",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Set up College Student", exact: true }),
  ).toBeVisible();
}

test("normal private build connects independent College Students, Science booking changes and separate historical completion", async ({
  browser,
}) => {
  // No copied app, factory override, automatic learner approval or fake MFA.
  const admin = await h.register(browser, "college-admin");
  await h.enrollAdmin(admin);
  const tutor = await h.register(browser, "college-tutor");
  const profile = await h.approveScienceTutor(admin, tutor);
  const visitor = await h.context(browser);
  const continuation =
    await test.step("an anonymous Science/College profile supplies a real public selection for signup", async () =>
      anonymousCollegeChoice(await visitor.newPage(), profile.slug));
  const student = await h.register(browser, "college-a", continuation.next);
  const other = await h.register(browser, "college-b");
  await test.step("College onboarding is accessible at narrow and wide widths and by keyboard", async () => {
    await accessibleCollegeOnboarding(student.page, continuation.selection);
  });
  const learner = await h.requestIndependent(
    student,
    "Fictional College learner A",
  );
  const otherLearner = await h.requestIndependent(
    other,
    "Fictional College learner B",
  );

  await test.step("pending independent requests confer no booking authority", async () => {
    expect(
      (
        await other.context.request.get(
          `/api/learner-admission/${learner.admissionId}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await student.context.request.get(`/api/learners/${learner.id}`)
      ).status(),
    ).toBe(404);
    const unavailable = await post(student, "/api/bookings/demo", {
      learnerId: learner.id,
      tutorSlug: profile.slug,
      subjectSlug: "science",
      displayTimezone: "Asia/Manila",
      startAtUtc: new Date(Date.now() + 4 * 3600000).toISOString(),
      endAtUtc: new Date(Date.now() + 5 * 3600000).toISOString(),
      idempotencyKey: randomUUID(),
    });
    expect(unavailable.status()).toBe(404);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE learner_id=ANY($1::uuid[])",
          [[learner.id, otherLearner.id]],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  await h.authorizeIndependent(admin, student, learner);
  await h.authorizeIndependent(admin, other, otherLearner);

  await test.step("signup and reviewed admission retain the original public tutor and time", async () => {
    const saved = (
      await h.owner.pool.query<{ selection_path: string }>(
        "SELECT selection_path FROM learner_admissions WHERE id=$1",
        [learner.admissionId],
      )
    ).rows[0].selection_path;
    // The immutable SQL admission validator retains its historical canonical
    // /demo storage path; private presentation returns to /new with the same tuple.
    assertPublicChoice(saved, continuation.selection, "/bookings/demo");
    await student.page.goto(`/learner-admission/${learner.admissionId}`);
    const retained = student.page.getByRole("link", {
      name: "Return to selected tutor and time",
      exact: true,
    });
    const href = await retained.getAttribute("href");
    expect(Boolean(href)).toBe(true);
    assertPublicChoice(href!, continuation.selection);
    await retained.click();
    await expect(student.page).toHaveURL(
      (url) => url.pathname === "/bookings/new",
    );
    assertPublicChoice(student.page.url(), continuation.selection);
    await expect(
      student.page.getByRole("heading", {
        name: "Request a booking",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE learner_id=$1",
          [learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });

  await test.step("owned College profile saves without changing management or level", async () => {
    await student.page.goto(`/learners/${learner.id}`);
    await student.page
      .getByLabel("Display name", { exact: true })
      .fill("Fictional College learner A updated");
    await student.page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await expect(
      student.page.getByLabel("Level", { exact: true }),
    ).toBeDisabled();
    await expect(student.page.getByLabel("Level", { exact: true })).toHaveValue(
      "college_support",
    );
    await student.page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(student.page.getByRole("status")).toHaveText("Profile saved");
    await student.page.reload();
    await expect(
      student.page.getByLabel("Display name", { exact: true }),
    ).toHaveValue("Fictional College learner A updated");
    await expect(
      student.page.getByLabel("Time zone", { exact: true }),
    ).toHaveValue("Asia/Manila");
    expect(
      (
        await other.context.request.patch(`/api/learners/${learner.id}`, {
          headers: { origin: h.packet.origin },
          data: { displayName: "Unauthorized change", timezone: "UTC" },
        })
      ).status(),
    ).toBe(404);
    const own = await student.context.request.get(
      `/api/learners/${learner.id}`,
    );
    expect(own.status()).toBe(200);
    const value = await own.json();
    expect(value.displayName).toBe("Fictional College learner A updated");
    expect(value.level).toBe("college_support");
    expect(value.management).toBe("self");
  });

  let chosen: { startAtUtc: string; endAtUtc: string };
  await test.step("Science and College Support filters lead to the selected public slot", async () => {
    await student.page.goto("/tutors");
    const filters = student.page.getByRole("search", {
      name: "Filter tutors",
      exact: true,
    });
    await filters
      .getByLabel("Subject", { exact: true })
      .selectOption("science");
    await filters
      .getByLabel("Level", { exact: true })
      .selectOption("college_support");
    await filters
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    // The combined suite also reviews its own Science/College Tutor. Its exact
    // current-run fixture may be absent when this Student case runs alone.
    const opsEmail = h.packet.accountEmails.find((email) =>
      email.startsWith("ops-tutor-"),
    );
    const opsTutor = (
      await h.owner.pool.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM \"user\" u JOIN tutor_profiles t ON t.user_id=u.id JOIN user_access a ON a.user_id=u.id WHERE u.email=$1 AND t.review_status='approved' AND a.status='active') AS present",
        [opsEmail ?? null],
      )
    ).rows[0].present;
    const expectedProfiles = [
      "Fictional college-tutor",
      ...(opsTutor ? ["Fictional ops-tutor"] : []),
    ];
    await expect(student.page.getByRole("status")).toHaveText(
      `${expectedProfiles.length} ${expectedProfiles.length === 1 ? "tutor" : "tutors"}`,
    );
    await expect(
      student.page.getByRole("link", { name: /^View profile:/ }),
    ).toHaveCount(expectedProfiles.length);
    for (const name of expectedProfiles)
      await expect(
        student.page.getByRole("link", {
          name: `View profile: ${name}`,
          exact: true,
        }),
      ).toBeVisible();
    await student.page
      .getByRole("link", {
        name: "View profile: Fictional college-tutor",
        exact: true,
      })
      .click();
    await expect(student.page).toHaveURL(
      new RegExp(`/tutors/${profile.slug}(?:\\?|$)`),
    );
    await expect(
      student.page.getByText(
        "Fictional education and teaching experience for College QA only.",
        { exact: true },
      ),
    ).toBeVisible();
    await student.page
      .getByLabel("Subject", { exact: true })
      .selectOption("science");
    await student.page
      .getByLabel("Level", { exact: true })
      .selectOption("college_support");
    await student.page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await student.page
      .getByRole("button", { name: "Load open times", exact: true })
      .click();
    const startAtUtc = await chooseFutureTime(
      student.page,
      'input[name="time"]',
      Date.now() + 4 * 3600000,
    );
    const interval = await student.page
      .locator('input[name="time"]:checked')
      .inputValue();
    const instants = interval.split("|");
    expect(instants).toHaveLength(2);
    expect(instants[0]).toBe(startAtUtc);
    await student.page
      .getByRole("button", { name: "Review booking", exact: true })
      .click();
    await expect(student.page).toHaveURL(/\/bookings\/new\?/);
    const query = new URL(student.page.url()).searchParams;
    // Authenticated native GET retains the compound interval. Only auth returns
    // and the learner-selection form canonicalize it into split UTC fields.
    const nativeFields = {
      tutorSlug: profile.slug,
      subjectSlug: "science",
      level: "college_support",
      displayTimezone: "Asia/Manila",
      time: interval,
    };
    expect([...query.keys()].sort()).toEqual(Object.keys(nativeFields).sort());
    for (const [key, value] of Object.entries(nativeFields))
      expect(query.get(key)).toBe(value);
    chosen = { startAtUtc, endAtUtc: instants[1] };
    await student.page
      .getByLabel("Learner", { exact: true })
      .selectOption(learner.id);
    await student.page
      .getByRole("button", { name: "Show available times", exact: true })
      .click();
    await expect(student.page).toHaveURL(
      (url) =>
        url.pathname === "/bookings/new" &&
        url.searchParams.get("learnerId") === learner.id,
    );
    const split = new URL(student.page.url()).searchParams;
    expect(split.get("startAtUtc")).toBe(chosen.startAtUtc);
    expect(split.get("endAtUtc")).toBe(chosen.endAtUtc);
    expect(split.has("time")).toBe(false);
    await expect(
      student.page.locator(`input[name="slot"][value="${startAtUtc}"]`),
    ).toBeChecked();
    // Other Student loads the same currently open interval before A reserves it.
    await requestChoices(other, otherLearner.id, profile.slug, chosen);
    await other.page
      .locator(`input[name="slot"][value="${startAtUtc}"]`)
      .check();
  });

  const create = await submit<CreateInput>(
    student.page,
    "/api/bookings/demo",
    student.page.getByRole("button", { name: "Request booking", exact: true }),
    true,
  );
  const bookingId = create.receipt.id;
  await expect(student.page).toHaveURL(
    new RegExp(`/bookings/${bookingId}\\?scope=student$`),
  );
  await expect(
    student.page.getByRole("heading", {
      name: "Provisional booking",
      exact: true,
    }),
  ).toBeVisible();
  await retry(student, "/api/bookings/demo", create.input, create.receipt);
  const initial = await savedBooking(bookingId);
  expect(initial.state).toBe("provisional");
  expect(initial.learner_id).toBe(learner.id);
  expect(initial.booked_by_user_id).toBe(student.id);
  expect(initial.tutor_id).toBe(profile.id);
  expect(initial.subject_slug).toBe("science");
  expect(initial.start_at_utc.toISOString()).toBe(chosen!.startAtUtc);
  expect(initial.end_at_utc.toISOString()).toBe(chosen!.endAtUtc);
  expect(
    (
      await h.owner.pool.query(
        "SELECT count(*)::int n FROM bookings WHERE booked_by_user_id=$1 AND idempotency_key=$2",
        [student.id, create.input.idempotencyKey],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(await eventCount(bookingId, "workflow_provisional")).toBe(1);

  await test.step("a stale offered slot conflicts without creating another reservation", async () => {
    const conflict = other.page.waitForResponse((response) =>
      requestAt("/api/bookings/demo")(response.request()),
    );
    await other.page
      .getByRole("button", { name: "Request booking", exact: true })
      .click();
    expect((await conflict).status()).toBe(409);
    const conflictMessage =
      "That time is no longer available. Please choose another.";
    const conflictAlert = other.page
      .getByRole("alert")
      .filter({ hasText: conflictMessage });
    await expect(conflictAlert).toBeVisible();
    await expect(conflictAlert).toHaveText(conflictMessage);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE booked_by_user_id=$1",
          [other.id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect((await savedBooking(bookingId)).state).toBe("provisional");
  });

  await h.operate({
    action: "grant-confirmation",
    apply: true,
    bookingId,
    reviewerEmail: admin.email,
    validUntil: h.packet.screening.validUntil,
  });
  await admin.page.goto(`/admin/bookings/${bookingId}`);
  const confirmation = await submit<ChangeInput>(
    admin.page,
    `/api/bookings/${bookingId}/workflow/confirm`,
    admin.page.getByRole("button", {
      name: "Confirm booking prerequisites",
      exact: true,
    }),
  );
  expect(confirmation.receipt.state).toBe("confirmed");
  await retry(
    admin,
    `/api/bookings/${bookingId}/workflow/confirm`,
    confirmation.input,
    confirmation.receipt,
  );
  expect(await eventCount(bookingId, "workflow_confirmed")).toBe(1);

  await test.step("the same confirmed booking belongs to Student and assigned Tutor", async () => {
    for (const [actor, route, scope] of [
      [student, "/student", "student"],
      [tutor, "/tutor", "tutor"],
    ] as const) {
      await actor.page.goto(route);
      await expect(
        actor.page
          .locator(`a[href="/bookings/${bookingId}?scope=${scope}"]`)
          .first(),
      ).toBeVisible();
      await actor.page.goto(`/bookings/${bookingId}?scope=${scope}`);
      await expect(
        actor.page.getByRole("heading", { name: "Confirmed", exact: true }),
      ).toBeVisible();
      await expect(
        actor.page.getByText(
          "Fictional College learner A updated · College Support",
          { exact: true },
        ),
      ).toBeVisible();
    }
    await student.page.goto("/bookings?scope=student&filter=all");
    await expect(
      student.page.locator(`a[href="/bookings/${bookingId}?scope=student"]`),
    ).toBeVisible();
    await other.page.goto("/student");
    await expect(
      other.page.locator(`a[href="/bookings/${bookingId}?scope=student"]`),
    ).toHaveCount(0);
    const list = await other.context.request.get(
      "/api/bookings?scope=student&filter=all",
    );
    expect(list.status()).toBe(200);
    const value = (await list.json()) as BookingPage;
    expect(value.items).toEqual([]);
    expect(value.learners.map((entry) => entry.id)).toEqual([otherLearner.id]);
  });

  await saveMeeting(tutor, bookingId, meeting);
  await openMeeting(student, bookingId, meeting);
  await openMeeting(tutor, bookingId, meeting);

  await test.step("cross-account, wrong-role and logged-out requests disclose no private booking", async () => {
    const change: ChangeInput = {
      requestId: randomUUID(),
      expectedRevision: confirmation.receipt.workflowRevision,
      reasonCode: "synthetic_participant_change",
    };
    for (const endpoint of [
      `/api/learners/${learner.id}`,
      `/api/learner-admission/${learner.admissionId}`,
      `/api/bookings/${bookingId}?scope=student`,
      `/api/bookings/${bookingId}/meeting-link`,
    ])
      expect((await other.context.request.get(endpoint)).status()).toBe(404);
    for (const action of ["cancel", "reschedule"]) {
      const input =
        action === "reschedule"
          ? {
              ...change,
              startAtUtc: chosen!.startAtUtc,
              endAtUtc: chosen!.endAtUtc,
              displayTimezone: "Asia/Manila",
            }
          : change;
      expect(
        (
          await post(
            other,
            `/api/bookings/${bookingId}/workflow/${action}`,
            input,
          )
        ).status(),
      ).toBe(404);
    }
    expect(
      (
        await post(other, "/api/bookings/demo", {
          ...create.input,
          idempotencyKey: randomUUID(),
        })
      ).status(),
    ).toBe(404);
    for (const scope of ["guardian", "tutor"])
      expect(
        (
          await student.context.request.get(
            `/api/bookings/${bookingId}?scope=${scope}`,
          )
        ).status(),
      ).toBe(404);
    expect(
      (
        await student.context.request.get(
          "/api/bookings?scope=guardian&filter=all",
        )
      ).status(),
    ).toBe(404);
    expect(
      (await student.context.request.get("/api/tutor/availability")).status(),
    ).toBe(403);
    expect((await post(student, "/api/admin/subjects", {})).status()).toBe(403);
    expect(
      (
        await post(student, `/api/bookings/${bookingId}/workflow/confirm`, {
          ...change,
          reasonCode: "synthetic_prerequisite_review",
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await student.context.request.put(
          `/api/bookings/${bookingId}/meeting-link`,
          {
            headers: { origin: h.packet.origin },
            data: {
              requestId: randomUUID(),
              expectedRevision: 1,
              url: replacementMeeting,
            },
          },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await post(student, `/api/bookings/${bookingId}/workflow/complete`, {
          ...change,
          reasonCode: "synthetic_completed",
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await post(tutor, `/api/bookings/${bookingId}/workflow/complete`, {
          ...change,
          reasonCode: "synthetic_completed",
        })
      ).status(),
    ).toBe(409);
    const anonymous = await h.context(browser);
    for (const endpoint of [
      `/api/bookings/${bookingId}?scope=student`,
      `/api/bookings/${bookingId}/meeting-link`,
    ])
      expect((await anonymous.request.get(endpoint)).status()).toBe(401);
    const publicProfile = await anonymous.request.get(
      `/tutors/${profile.slug}`,
    );
    expect(publicProfile.status()).toBe(200);
    expect((await publicProfile.text()).includes(meeting)).toBe(false);
    expect((await savedBooking(bookingId)).state).toBe("confirmed");
    expect(await eventCount(bookingId, "workflow_completed")).toBe(0);
    expect(await eventCount(bookingId, "workflow_cancelled")).toBe(0);
    expect(await eventCount(bookingId, "workflow_rescheduled")).toBe(0);
  });

  await test.step("Student-only browser navigation cannot open Admin or Tutor workspaces", async () => {
    for (const route of ["/admin", "/tutor"]) {
      await student.page.goto(route);
      await expect(
        student.page.getByRole("heading", {
          name: "Workspace access unavailable",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        student.page.getByRole("heading", {
          name: "Admin workspace",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        student.page.getByRole("heading", {
          name: "Your bookings",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(student.page.locator('a[href^="/admin/"]')).toHaveCount(0);
      await expect(student.page.locator('a[href^="/tutor/"]')).toHaveCount(0);
      await expect(student.page.locator('a[href^="/bookings/"]')).toHaveCount(
        0,
      );
      expect((await student.page.content()).includes(meeting)).toBe(false);
    }
  });

  let replacementId = "";
  await test.step("Student reschedules the confirmed booking and refreshes its private link", async () => {
    await student.page.goto(`/bookings/${bookingId}?scope=student`);
    await student.page
      .getByRole("link", { name: "Reschedule booking", exact: true })
      .click();
    await expect(
      student.page.getByRole("heading", {
        name: "Reschedule booking",
        exact: true,
      }),
    ).toBeVisible();
    const start = await chooseFutureTime(
      student.page,
      'input[name="slot"]',
      Date.now() + 4 * 3600000,
      chosen!.startAtUtc,
    );
    const move = await submit<ChangeInput>(
      student.page,
      `/api/bookings/${bookingId}/workflow/reschedule`,
      student.page.getByRole("button", {
        name: "Reschedule booking",
        exact: true,
      }),
    );
    replacementId = move.receipt.id;
    expect(replacementId === bookingId).toBe(false);
    expect(move.receipt.state).toBe("confirmed");
    expect(move.receipt.logicalBookingId).toBe(create.receipt.logicalBookingId);
    await expect(student.page).toHaveURL(
      new RegExp(`/bookings/${replacementId}\\?scope=student$`),
    );
    await retry(
      student,
      `/api/bookings/${bookingId}/workflow/reschedule`,
      move.input,
      move.receipt,
    );
    const replacement = await savedBooking(replacementId);
    expect(replacement.state).toBe("confirmed");
    expect(replacement.logical_booking_id).toBe(initial.logical_booking_id);
    expect(replacement.replaces_booking_id).toBe(bookingId);
    expect(replacement.revision).toBe(initial.revision + 1);
    expect(replacement.start_at_utc.toISOString()).toBe(start);
    expect(replacement.expires_at.toISOString()).toBe(
      initial.expires_at.toISOString(),
    );
    expect(replacement.workflow_policy_id).toBe(initial.workflow_policy_id);
    expect(replacement.admission_policy_id).toBe(initial.admission_policy_id);
    expect((await savedBooking(bookingId)).state).toBe("replaced");
    expect(await eventCount(bookingId, "workflow_rescheduled")).toBe(1);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE logical_booking_id=$1",
          [initial.logical_booking_id],
        )
      ).rows[0].n,
    ).toBe(2);
    await noMeeting(student, bookingId, "expired");
    await noMeeting(student, replacementId, "missing");
    await saveMeeting(tutor, replacementId, replacementMeeting);
    await openMeeting(student, replacementId, replacementMeeting);
  });

  await test.step("Student cancellation is retry-safe and both audited versions remain history", async () => {
    await student.page.goto(`/bookings/${replacementId}?scope=student`);
    await student.page
      .locator("summary")
      .filter({ hasText: /^Cancel booking$/ })
      .click();
    const cancellation = await submit<ChangeInput>(
      student.page,
      `/api/bookings/${replacementId}/workflow/cancel`,
      student.page.getByRole("button", { name: "Cancel booking", exact: true }),
    );
    expect(cancellation.receipt.state).toBe("cancelled");
    await expect(
      student.page.getByRole("heading", { name: "Cancelled", exact: true }),
    ).toBeVisible();
    await retry(
      student,
      `/api/bookings/${replacementId}/workflow/cancel`,
      cancellation.input,
      cancellation.receipt,
    );
    expect(await eventCount(replacementId, "workflow_cancelled")).toBe(1);
    await noMeeting(student, replacementId, "expired");
    await student.page.goto("/bookings?scope=student&filter=history");
    for (const id of [bookingId, replacementId])
      await expect(
        student.page.locator(`a[href="/bookings/${id}?scope=student"]`),
      ).toBeVisible();
    const response = await student.context.request.get(
      "/api/bookings?scope=student&filter=history",
    );
    expect(response.status()).toBe(200);
    const history = (await response.json()) as BookingPage;
    expect(history.items.map((entry) => entry.id).sort()).toEqual(
      [bookingId, replacementId].sort(),
    );
    expect(
      history.items.every(
        (entry) => entry.logicalBookingId === initial.logical_booking_id,
      ),
    ).toBe(true);
    expect(history.items.map((entry) => entry.state).sort()).toEqual([
      "cancelled",
      "replaced",
    ]);
  });

  await test.step("separate historical fixture completes through assigned Tutor UI and Student history", async () => {
    // This separately inserted ended record is NOT the new booking above, a
    // shortened lesson, elapsed browser session or evidence of video attendance.
    const now = Date.now();
    const historical = await historicalWorkflowBooking(
      { owner: h.owner },
      {
        profile,
        learner,
        requester: student,
        booking: h.packet.booking,
        admission: h.packet.admission,
      },
      admin,
      {
        state: "confirmed",
        start: new Date(now - 2 * 3600000),
        end: new Date(now - 3600000),
        created: new Date(now - 86400000),
        expires: new Date(now - 86400000 + 600000),
        subjectSlug: "science",
      },
    );
    expect(historical.id === bookingId || historical.id === replacementId).toBe(
      false,
    );
    await student.page.goto(`/bookings/${historical.id}?scope=student`);
    await expect(
      student.page.getByRole("heading", { name: "Confirmed", exact: true }),
    ).toBeVisible();
    await expect(
      student.page.getByRole("button", {
        name: "Mark session completed",
        exact: true,
      }),
    ).toHaveCount(0);
    await tutor.page.goto(`/bookings/${historical.id}?scope=tutor`);
    expect((await savedBooking(historical.id)).state).toBe("confirmed");
    const completion = await submit<ChangeInput>(
      tutor.page,
      `/api/bookings/${historical.id}/workflow/complete`,
      tutor.page.getByRole("button", {
        name: "Mark session completed",
        exact: true,
      }),
    );
    expect(completion.receipt.state).toBe("completed");
    await expect(
      tutor.page.getByRole("heading", { name: "Completed", exact: true }),
    ).toBeVisible();
    await retry(
      tutor,
      `/api/bookings/${historical.id}/workflow/complete`,
      completion.input,
      completion.receipt,
    );
    const events = (
      await h.owner.pool.query<{
        actor_user_id: string;
        workflow_revision: number;
      }>(
        "SELECT actor_user_id,workflow_revision FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_completed'",
        [historical.id],
      )
    ).rows;
    expect(events).toEqual([{ actor_user_id: tutor.id, workflow_revision: 1 }]);
    await student.page.goto("/student");
    await expect(
      student.page
        .locator(`a[href="/bookings/${historical.id}?scope=student"]`)
        .first(),
    ).toBeVisible();
    await student.page.goto("/bookings?scope=student&filter=history");
    await expect(
      student.page.locator(
        `a[href="/bookings/${historical.id}?scope=student"]`,
      ),
    ).toBeVisible();
    await student.page.goto(`/bookings/${historical.id}?scope=student`);
    await expect(
      student.page.getByRole("heading", { name: "Completed", exact: true }),
    ).toBeVisible();
    await noMeeting(student, historical.id, "expired");
    expect(
      (
        await other.context.request.get(
          `/api/bookings/${historical.id}?scope=student`,
        )
      ).status(),
    ).toBe(404);
    const result = await student.context.request.get(
      "/api/bookings?scope=student&filter=history",
    );
    expect(result.status()).toBe(200);
    const history = (await result.json()) as BookingPage;
    expect(
      history.items.find((entry) => entry.id === historical.id)?.state,
    ).toBe("completed");
    expect((await savedBooking(bookingId)).state).toBe("replaced");
    expect((await savedBooking(replacementId)).state).toBe("cancelled");
    await student.page.goto("/bookings?scope=student&filter=history");
    await responsive(student.page);
  });

  await test.step("actual Sign out removes Student and own-booking page access", async () => {
    await student.page
      .getByRole("button", { name: "Account Fictional college-a", exact: true })
      .click();
    const signedOut = student.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/auth/sign-out",
    );
    await student.page
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    expect((await signedOut).status()).toBe(200);
    await expect(student.page).toHaveURL((url) => url.pathname === "/sign-in");
    for (const route of [
      "/student",
      `/bookings/${replacementId}?scope=student`,
    ]) {
      await student.page.goto(route);
      await expect(student.page).toHaveURL(
        (url) =>
          url.pathname === "/sign-in" && url.searchParams.get("next") === route,
      );
      await expect(
        student.page.getByRole("heading", { name: "Sign in", exact: true }),
      ).toBeVisible();
      await expect(
        student.page.getByRole("heading", {
          name: "Your bookings",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        student.page.getByText("Fictional College learner A updated", {
          exact: false,
        }),
      ).toHaveCount(0);
      await expect(student.page.locator('a[href^="/bookings/"]')).toHaveCount(
        0,
      );
      expect((await student.page.content()).includes(replacementMeeting)).toBe(
        false,
      );
    }
    expect(
      (
        await student.context.request.get(
          `/api/bookings/${replacementId}?scope=student`,
        )
      ).status(),
    ).toBe(401);
  });
});
