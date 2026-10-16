import {
  privateAbort,
  privateBack,
  privateContinue,
  privateGet,
  privateGoto,
  privatePost,
  privatePut,
  privateReload,
  privateRouteFetch,
  privateText,
  protectedOperation,
} from "./cross-browser-privacy";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { bookingSelectionHref } from "../../src/features/bookings/selection";
import { publicProfileHref } from "../../src/features/public-availability/links";
import {
  test,
  expect,
  password,
  signIn,
  accessible,
  responsive,
  assertPrivateAbsent,
  type CrossBrowserWorld,
} from "./cross-browser-support";
import type { Page } from "@playwright/test";

async function preview(
  page: Page,
  slug: string,
  level: "elementary" | "college_support" = "elementary",
) {
  await privateGoto(
    page,
    publicProfileHref({
      tutorSlug: slug,
      subjectSlug: "math",
      level,
      displayTimezone: "America/New_York",
    }),
  );
  const radio = page.locator('input[name="time"]').first();
  await expect(radio).toBeVisible();
  const value = await radio.inputValue();
  const [startAtUtc, endAtUtc] = value.split("|");
  expect(new Date(endAtUtc).getTime() - new Date(startAtUtc).getTime()).toBe(
    3_600_000,
  );
  return {
    tutorSlug: slug,
    subjectSlug: "math",
    level,
    displayTimezone: "America/New_York",
    startAtUtc,
    endAtUtc,
  };
}

async function privateFixture(wave: CrossBrowserWorld) {
  const parent = await wave.account("parent", true, false);
  const other = await wave.account("parent");
  const tutor = await wave.tutor();
  const learner = await wave.learner(parent);
  const bookingId = await wave.reservation(parent, learner.id, tutor.id);
  // Deliberately synthetic private joining value. Never navigate to the provider.
  const marker = `private${randomUUID().replaceAll("-", "")}`;
  const meetingURL = `https://zoom.us/j/12345678901?pwd=${marker}`;
  const api = `/api/bookings/${bookingId}/meeting-link`;
  const saved = await privatePut(tutor.actor.context.request, api, {
    headers: { origin: wave.baseURL },
    data: { url: meetingURL, expectedRevision: 0, requestId: randomUUID() },
  });
  expect(saved.status()).toBe(200);
  const privatePath = `/bookings/${bookingId}?scope=guardian`;
  await privateGoto(parent.page, privatePath);
  await expect(
    parent.page.getByRole("link", {
      name: "Open test link on Zoom (new tab)",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await parent.page.content()).includes(meetingURL),
    "Private positive-control payload exists only for participant",
  ).toBe(true);
  const ttl = await wave.owner.pool.query<{ live: boolean }>(
    "SELECT expires_at > clock_timestamp() AS live FROM bookings WHERE id=$1",
    [bookingId],
  );
  expect(ttl.rows[0].live).toBe(true);
  return {
    parent,
    other,
    tutor,
    learner,
    bookingId,
    api,
    privatePath,
    meetingURL,
    values: [meetingURL, marker, learner.name],
  };
}

test("branded navigation supports enlarged text and keeps the small-screen dock in view", async ({
  page,
}) => {
  await privateGoto(page, "/sign-in");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Navigation fits at ${width}px with 200% text`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveCount(0);
  // At this text size the dock shows icons only; every tab keeps its name.
  const dock = page.getByRole("navigation", { name: "Main navigation" });
  await expect(dock).toBeVisible();
  const box = await dock.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  const find = dock.getByRole("link", { name: "Find a tutor", exact: true });
  await find.focus();
  await expect(find).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tutors$/);
});

test("public discovery, real matching, denied tutors and responsive keyboard controls", async ({
  wave,
}, info) => {
  const tutor = await wave.tutor();
  const pending = await wave.tutor("pending");
  const context = await wave.context();
  const page = await context.newPage();
  await privateGoto(page, "/tutors?subject=math&level=elementary");
  await expect(
    page.getByRole("link", {
      name: `View profile: ${tutor.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `View profile: ${pending.name}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Level", { exact: true }).selectOption("high_school");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "No tutors match these filters",
      exact: true,
    }),
  ).toBeVisible();
  await preview(page, tutor.slug);
  await expect(page.getByText(/Times shown in.*GMT/).first()).toBeVisible();
  await page.locator('input[name="time"]').first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator('input[name="time"]:checked')).toHaveCount(1);
  await responsive(page);
  const levelControl = page.getByLabel("Level", { exact: true });
  await levelControl.focus();
  await expect(levelControl).toBeFocused();
  expect(
    await levelControl.evaluate((element) =>
      parseFloat(getComputedStyle(element).outlineWidth),
    ),
    "Native select visible keyboard focus",
  ).toBeGreaterThanOrEqual(2);
  // Record numeric geometry only, without names, values or private URLs.
  const measurements = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = await page
      .locator("select.field")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          tag: element.tagName.toLowerCase(),
          height: element.getBoundingClientRect().height,
          minHeight: getComputedStyle(element).minHeight,
          appearance: getComputedStyle(element).appearance,
          indicator: getComputedStyle(element).backgroundImage !== "none",
          paddingInlineEnd: parseFloat(
            getComputedStyle(element).paddingInlineEnd,
          ),
        })),
      );
    measurements.push({ width, controls });
  }
  await writeFile(
    info.outputPath("public-control-geometry.json"),
    JSON.stringify(measurements, null, 2) + "\n",
    { mode: 0o600 },
  );
  for (const measurement of measurements) {
    expect(measurement.controls.length).toBe(3);
    for (const control of measurement.controls) {
      expect(
        control.height,
        "Public select target height",
      ).toBeGreaterThanOrEqual(44);
      expect(
        control.indicator,
        "Single select has a visible dropdown marker",
      ).toBe(true);
      expect(
        control.paddingInlineEnd,
        "Selection text reserves marker space",
      ).toBeGreaterThanOrEqual(32);
    }
  }
  // Public-only captures: no credential controls or private booking payload.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.screenshot({
      path: info.outputPath(`public-profile-${width}.png`),
      fullPage: true,
    });
  }
  // Disabled native semantics and muted affordance, with only public data captured.
  const subjectControl = page.getByLabel("Subject", { exact: true });
  await subjectControl.evaluate((element) => {
    (element as HTMLSelectElement).disabled = true;
  });
  await expect(subjectControl).toBeDisabled();
  expect(
    await subjectControl.evaluate(
      (element) => getComputedStyle(element).cursor,
    ),
  ).toBe("not-allowed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("public-disabled-select-phone.png"),
    fullPage: true,
  });
  await subjectControl.evaluate((element) => {
    (element as HTMLSelectElement).disabled = false;
  });
  // CSS-only fixtures prove a listbox/multi-select never receives a popup chevron.
  const listboxIndicators = await page.evaluate(() => {
    const host = document.createElement("div");
    const multi = document.createElement("select");
    const listbox = document.createElement("select");
    multi.className = listbox.className = "field";
    multi.multiple = true;
    listbox.size = 4;
    host.append(multi, listbox);
    document.body.append(host);
    const result = [multi, listbox].map(
      (element) => getComputedStyle(element).backgroundImage !== "none",
    );
    host.remove();
    return result;
  });
  expect(listboxIndicators).toEqual([false, false]);
  if (info.project.name === "firefox") {
    // Stable OS modes use separate documents; live mode-switch transitions are
    // recorded independently, without suppressing either mode's axe assertions.
    const forcedContext = await wave.context();
    const forcedPage = await forcedContext.newPage();
    await forcedPage.emulateMedia({ forcedColors: "active" });
    await forcedPage.setViewportSize({ width: 390, height: 844 });
    await preview(forcedPage, tutor.slug);
    await forcedPage.locator('input[name="time"]').first().check();
    const forcedSubject = forcedPage.getByLabel("Subject", { exact: true });
    expect(
      await forcedSubject.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
    ).toBe("none");
    expect(
      await forcedSubject.evaluate(
        (element) => getComputedStyle(element).appearance,
      ),
    ).toBe("auto");
    expect(
      await forcedSubject.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(44);
    await accessible(forcedPage);
    await forcedPage.screenshot({
      path: info.outputPath("public-forced-colors-phone.png"),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 400 });
  await accessible(page);
  await privateGoto(
    page,
    "/get-matched?level=elementary&subject=math&timezone=America%2FNew_York&when=any",
  );
  await expect(
    page.getByRole("link", {
      name: `View profile: ${tutor.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await accessible(page);
  await wave.owner.pool.query(
    "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
    [tutor.id],
  );
  const denied = await privateGoto(page, `/tutors/${tutor.slug}`);
  expect(denied?.status()).toBe(404);
  await privateGoto(page, "/tutors?subject=math&level=elementary");
  await expect(
    page.getByRole("link", {
      name: `View profile: ${tutor.name}`,
      exact: true,
    }),
  ).toHaveCount(0);
});

test("native public GET and time selection preserve a safe auth return without JavaScript", async ({
  wave,
}) => {
  const tutor = await wave.tutor();
  const context = await wave.context(false);
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await privateGoto(page, "/tutors");
  await page.getByLabel("Subject", { exact: true }).selectOption("math");
  await page
    .getByLabel("Level", { exact: true })
    .selectOption("college_support");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/subject=math/);
  await expect(
    page.getByRole("link", {
      name: `View profile: ${tutor.name}`,
      exact: true,
    }),
  ).toBeVisible();
  const selection = await preview(page, tutor.slug, "college_support");
  await page.locator('input[name="time"]').first().check();
  await page
    .getByRole("button", { name: "Review simulated booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your simulated booking choice",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    new URL(page.url()).searchParams.get("next") ===
      bookingSelectionHref(selection),
  ).toBe(true);
  expect(new URL(page.url()).searchParams.has("learnerId")).toBe(false);
  expect(
    (
      await wave.owner.pool.query(
        "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
        [tutor.id],
      )
    ).rows[0].count,
  ).toBe(0);
});

test("real browser signup, captured verification, sign-in, settings and sign-out", async ({
  wave,
}) => {
  await wave.waitForAuthBudget();
  const context = await wave.context(true, false);
  const page = await context.newPage();
  const email = `cross-browser-ui-${randomUUID()}@learli.test`;
  const forged = await privatePost(context.request, "/api/auth/sign-up/email", {
    headers: { origin: wave.baseURL },
    data: { email, password, name: "Synthetic role attack", role: "admin" },
  });
  expect(forged.status()).toBe(400);
  expect(
    (
      await wave.owner.pool.query(
        'SELECT count(*)::int AS count FROM "user" WHERE email=$1',
        [email],
      )
    ).rows[0].count,
  ).toBe(0);
  await privateGoto(page, "/sign-up?next=%2Faccount");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic browser account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("verification message");
  const user = await wave.owner.pool.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email=$1',
    [email],
  );
  expect(user.rowCount).toBe(1);
  const id = user.rows[0].id;
  wave.users.push(id);
  expect(
    (
      await wave.owner.pool.query(
        "SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1",
        [id],
      )
    ).rows[0].count,
  ).toBe(0);
  const verification = await wave.capturedVerification(email);
  // Suppress a private proof-bearing URL from navigation failure diagnostics.
  try {
    await privateGoto(page, verification);
  } catch {
    throw new Error(
      "Owned local verification navigation failed; private URL omitted.",
    );
  }
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/account$/);
  const response = await privateReload(page);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Manila");
  // Saving refreshes this server page. Finish that response before starting
  // a document reload, or Firefox can interrupt the competing navigation.
  const settingsRefresh = protectedOperation(async () => {
    const response = await page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === wave.baseURL &&
        url.pathname === "/account" &&
        response.request().headers().rsc === "1"
      );
    });
    await response.finished();
  });
  // Observe teardown rejection even if Save or its status assertion fails first.
  void settingsRefresh.catch(() => undefined);
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Account settings saved.");
  await settingsRefresh;
  await privateReload(page);
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "Asia/Manila",
  );
  await responsive(page);
  // Establish a genuine private entry before document-replacing logout.
  await privateGoto(page, "/account/sessions");
  await expect(
    page.getByRole("heading", { name: "Account sessions", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await privateBack(page);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fsessions$/);
  await assertPrivateAbsent(page, [email, "Synthetic browser account"]);
  expect(
    (await privateGet(context.request, `/api/account/${id}`)).status(),
  ).toBe(401);
});

test("parent discovery to explicit reservation, lost-response retry and native private history", async ({
  wave,
}) => {
  const tutor = await wave.tutor();
  const parent = await wave.account("parent", false);
  const learner = await wave.learner(parent);
  const page = parent.page;
  const selection = await preview(page, tutor.slug);
  await page.locator('input[name="time"]').first().focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Review simulated booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect(page.url().includes(learner.id)).toBe(false);
  await signIn(page, parent.email);
  await expect(page).toHaveURL(/\/bookings\/demo\?/);
  await expect(page.locator('input[name="time"]:checked')).toHaveValue(
    selection.startAtUtc,
  );
  expect(
    (
      await wave.owner.pool.query(
        "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
        [tutor.id],
      )
    ).rows[0].count,
  ).toBe(0);
  let requestKey = "";
  let dropped = false;
  await page.route("**/api/bookings/demo", async (route) => {
    const key = route.request().postDataJSON().idempotencyKey as string;
    if (!dropped) {
      dropped = true;
      requestKey = key;
      const response = await privateRouteFetch(route);
      expect(response.status()).toBe(200);
      await privateAbort(route);
    } else {
      expect(key === requestKey).toBe(true);
      await privateContinue(route);
    }
  });
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "request result is unknown" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Simulated reservation saved",
      exact: true,
    }),
  ).toBeFocused();
  const saved = await wave.owner.pool.query<{
    id: string;
    learner_id: string;
    state: string;
    source: string;
    start_at_utc: Date;
  }>(
    "SELECT id,learner_id,state,source,start_at_utc FROM bookings WHERE tutor_id=$1",
    [tutor.id],
  );
  expect(saved.rowCount).toBe(1);
  expect(saved.rows[0].learner_id === learner.id).toBe(true);
  expect(saved.rows[0].state).toBe("demo_reserved");
  expect(saved.rows[0].source).toBe("local_simulation");
  expect(saved.rows[0].start_at_utc.toISOString()).toBe(selection.startAtUtc);
  await privateGoto(page, `/bookings/${saved.rows[0].id}?scope=guardian`);
  await expect(
    page.locator("dd").filter({ hasText: learner.name }),
  ).toBeVisible();
  await responsive(page);
  const elapsedId = await wave.reservation(parent, learner.id, tutor.id, true);
  const native = await wave.context(false);
  await native.addCookies(await parent.context.cookies());
  const nativePage = await native.newPage();
  await nativePage.setViewportSize({ width: 390, height: 844 });
  const historyResponse = await privateGoto(
    nativePage,
    "/bookings?scope=guardian",
  );
  expect(historyResponse?.headers()["cache-control"]).toContain("no-store");
  await nativePage
    .getByLabel("Booking view", { exact: true })
    .selectOption("history");
  await nativePage
    .getByRole("button", { name: "Apply booking view", exact: true })
    .click();
  await expect(
    nativePage.getByText("Simulation expired", { exact: true }),
  ).toBeVisible();
  await nativePage.getByRole("link", { name: /^View booking for/ }).click();
  await expect(nativePage).toHaveURL(new RegExp(`/bookings/${elapsedId}`));
  await expect(
    nativePage.locator("dd").filter({ hasText: learner.name }),
  ).toBeVisible();
  expect(
    (await nativePage.locator("head").innerHTML()).includes(learner.name),
  ).toBe(false);
  expect(
    await nativePage.locator('meta[name="robots"]').getAttribute("content"),
  ).toContain("noindex");
});

test("independent college learner recovers candidate failure and rejects a stale time", async ({
  wave,
}) => {
  const tutor = await wave.tutor();
  const student = await wave.account("student");
  await wave.learner(student, "self");
  const page = student.page;
  await privateGoto(page, "/bookings/demo");
  await expect(page.getByText(/Booking for you/)).toBeVisible();
  await page.getByLabel("Tutor", { exact: true }).selectOption(tutor.slug);
  await page.getByLabel("Subject", { exact: true }).selectOption("math");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page.route(
    "**/api/bookings/demo/candidates?**",
    (route) => privateAbort(route),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded" }),
  ).toBeFocused();
  await accessible(page);
  await page
    .getByRole("button", { name: "Load open times", exact: true })
    .click();
  await expect(page.locator('input[name="time"]').first()).toBeVisible();
  await page.locator('input[name="time"]').first().check();
  const start = await page.locator('input[name="time"]:checked').inputValue();
  await wave.owner.pool.query(
    "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES ($1,$2,$3)",
    [tutor.id, start, new Date(new Date(start).getTime() + 3_600_000)],
  );
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "no longer available" }),
  ).toBeFocused();
  expect(
    (
      await wave.owner.pool.query(
        "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
        [tutor.id],
      )
    ).rows[0].count,
  ).toBe(0);
  await page.locator('input[name="time"]').first().check();
  await page
    .getByRole("button", { name: "Create simulated reservation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Simulated reservation saved",
      exact: true,
    }),
  ).toBeVisible();
  await privateGoto(page, "/student");
  await expect(
    page.getByRole("heading", { name: "Your bookings", exact: true }),
  ).toBeVisible();
  await responsive(page);
});

test("private ownership and meeting opening stay participant-only and public payloads stay clean", async ({
  wave,
}) => {
  const f = await privateFixture(wave);
  const opening = await privateGet(
    f.parent.context.request,
    `${f.api}?open=1`,
    {
      maxRedirects: 0,
    },
  );
  expect(opening.status()).toBe(303);
  expect(opening.headers().location === f.meetingURL).toBe(true);
  expect(opening.headers()["cache-control"]).toContain("no-store");
  const foreign = await privateGet(f.other.context.request, f.api);
  expect(foreign.status()).toBe(404);
  expect((await privateText(foreign)).includes(f.meetingURL)).toBe(false);
  const forged = await privateGet(
    f.other.context.request,
    `/api/bookings/demo/candidates?${new URLSearchParams({ learnerId: f.learner.id, tutorSlug: f.tutor.slug, subjectSlug: "math", displayTimezone: "UTC" })}`,
  );
  expect(forged.status()).toBe(404);
  const foreignDetail = await privateGoto(f.other.page, f.privatePath);
  expect(foreignDetail?.status()).toBe(200);
  await expect(
    f.other.page.getByRole("heading", {
      name: "We can't find that booking on this account",
      exact: true,
    }),
  ).toBeVisible();
  await assertPrivateAbsent(f.other.page, f.values);
  const visitor = await wave.context();
  expect((await privateGet(visitor.request, f.api)).status()).toBe(401);
  for (const route of [
    "/",
    "/tutors",
    "/subjects",
    `/tutors/${f.tutor.slug}`,
  ]) {
    const html = await privateText(await privateGet(visitor.request, route));
    expect(
      [...f.values, f.learner.id, f.parent.email].some((value) =>
        html.includes(value),
      ),
      "Public response excludes private fixture values",
    ).toBe(false);
  }
  await wave.owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [f.parent.id, f.learner.id],
  );
  expect((await privateGet(f.parent.context.request, f.api)).status()).toBe(
    404,
  );
  await privateReload(f.parent.page);
  await assertPrivateAbsent(f.parent.page, f.values);
});

test("same browser logout, other actor sign-in and Back clear old private payload", async ({
  wave,
}) => {
  const f = await privateFixture(wave);
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
  await assertPrivateAbsent(f.parent.page, f.values);
  expect((await privateGet(f.parent.context.request, f.api)).status()).toBe(
    401,
  );
  await signIn(f.parent.page, f.other.email);
  await expect(f.parent.page).toHaveURL(/\/account$/);
  await expect(
    f.parent.page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await assertPrivateAbsent(f.parent.page, f.values);
  expect((await privateGet(f.parent.context.request, f.api)).status()).toBe(
    404,
  );
  await privateBack(f.parent.page);
  await expect(f.parent.page).toHaveURL(new RegExp(`/bookings/${f.bookingId}`));
  await assertPrivateAbsent(f.parent.page, f.values);
});

for (const sessionLoss of ["revoked", "expired"] as const) {
  test(`${sessionLoss} session, failed reauthentication and Back never restore private data`, async ({
    wave,
  }) => {
    const f = await privateFixture(wave);
    if (sessionLoss === "revoked")
      await wave.owner.pool.query("DELETE FROM session WHERE user_id=$1", [
        f.parent.id,
      ]);
    else
      await wave.owner.pool.query(
        "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
        [f.parent.id],
      );
    expect((await privateGet(f.parent.context.request, f.api)).status()).toBe(
      401,
    );
    await f.parent.page
      .getByRole("link", { name: "Change account time zone", exact: true })
      .click();
    await expect(
      f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await assertPrivateAbsent(f.parent.page, f.values);
    await f.parent.page
      .getByLabel("Email", { exact: true })
      .fill(f.parent.email);
    await f.parent.page
      .getByLabel("Password", { exact: true })
      .fill("Wrong-synthetic-passphrase-123");
    await f.parent.page
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      f.parent.page.getByRole("main").getByRole("alert"),
    ).toContainText("Sign-in could not be completed");
    await assertPrivateAbsent(f.parent.page, f.values);
    await privateBack(f.parent.page);
    await expect(
      f.parent.page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(f.parent.page).toHaveURL(
      new RegExp(`/sign-in\\?next=${encodeURIComponent(f.privatePath)}`),
    );
    await assertPrivateAbsent(f.parent.page, f.values);
    expect((await privateGet(f.parent.context.request, f.api)).status()).toBe(
      401,
    );
  });
}
