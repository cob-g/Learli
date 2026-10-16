import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type Browser,
  type Locator,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { WorkflowReceipt } from "../../src/features/booking-workflows/model";
import {
  PrivateStudentBrowser,
  type CollegeActor,
  type CollegeLearner,
} from "./private-student-browser";

export type AdminCreateInput = {
  learnerId: string;
  tutorSlug: string;
  subjectSlug: string;
  displayTimezone: string;
  startAtUtc: string;
  endAtUtc: string;
  idempotencyKey: string;
};
export type AdminWorkflowInput = {
  requestId: string;
  expectedRevision: number;
  reasonCode: string;
};
export type AccessInput = {
  revision: number;
  status: "active" | "suspended";
  reason: string;
  requestKey: string;
};
export type AccessReceipt = {
  status: "active" | "suspended";
  revision: number;
  replayed: boolean;
};
export type AdminSubject = {
  id: string;
  name: string;
  slug: string;
  category: string;
  isActive: boolean;
  nameRevision: number;
};

/** Real normal-build browser actions. Owner writes remain limited to explicit
 * metadata/bootstrap and the separately labelled historical booking fixture. */
export class PrivateAdminBrowser extends PrivateStudentBrowser {
  async context(browser: Browser) {
    const context = await super.context(browser);
    await context.route(
      /^https:\/\/(?:meet\.google\.com|(?:[a-z0-9-]+\.)?zoom\.us)\//,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<title>Intercepted fictional meeting destination</title>",
        }),
    );
    return context;
  }

  async capture<Input, Receipt>(
    page: Page,
    endpoint: string,
    method: "POST" | "PATCH",
    gesture: () => Promise<unknown>,
    expectedStatus = 200,
  ) {
    const url = new URL(endpoint, this.packet.origin).href;
    expect(new URL(page.url()).origin).toBe(this.packet.origin);
    let resolveCapture!: (value: { input: Input; receipt: Receipt }) => void;
    let rejectCapture!: (error: unknown) => void;
    const captured = new Promise<{ input: Input; receipt: Receipt }>(
      (resolve, reject) => {
        resolveCapture = resolve;
        rejectCapture = reject;
      },
    );
    let requests = 0;
    const count = (request: Request) => {
      if (request.url() === url && request.method() === method) requests++;
    };
    const passthrough = async (route: Route) => {
      try {
        expect(route.request().method()).toBe(method);
        const input = route.request().postDataJSON() as Input;
        // Buffer the unchanged real response before navigation can discard its
        // browser resource. Each intercepted mutation is forwarded exactly once.
        const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
        expect(response.status()).toBe(expectedStatus);
        const receipt = (await response.json()) as Receipt;
        await route.fulfill({ response });
        resolveCapture({ input, receipt });
      } catch (error) {
        rejectCapture(error);
        await route.abort().catch(() => {});
      }
    };
    page.on("request", count);
    try {
      await page.route(url, passthrough, { times: 1 });
      const [result] = await Promise.all([
        captured,
        page.waitForRequest(
          (request) => request.url() === url && request.method() === method,
          { timeout: 15_000 },
        ),
        gesture(),
      ]);
      expect(requests).toBe(1);
      return result;
    } finally {
      page.off("request", count);
      await page.unroute(url, passthrough);
    }
  }

  async requestGuardian(actor: CollegeActor): Promise<CollegeLearner> {
    await actor.page.goto("/learners");
    await actor.page
      .getByRole("link", { name: "Add a learner", exact: true })
      .click();
    const displayName = "Fictional Admin journey child";
    await actor.page
      .getByLabel("Learner display name", { exact: true })
      .fill(displayName);
    await actor.page
      .getByLabel("Learner level", { exact: true })
      .selectOption("high_school");
    await actor.page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await actor.page
      .getByRole("button", { name: "Request admission review", exact: true })
      .click();
    await expect(actor.page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
    const admissionId = new URL(actor.page.url()).pathname.split("/").at(-1)!;
    const row = (
      await this.owner.pool.query<{
        id: string;
        status: string;
        links: number;
      }>(
        "SELECT l.id,l.status,(SELECT count(*)::int FROM guardian_learner_links g WHERE g.learner_id=l.id) links FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1",
        [admissionId],
      )
    ).rows[0];
    expect(row.status).toBe("inactive");
    expect(row.links).toBe(0);
    await expect(
      actor.page.getByText(/Learner access is not authorized/),
    ).toBeVisible();
    return { id: row.id, admissionId, displayName };
  }

  async authorizeGuardian(
    admin: CollegeActor,
    parent: CollegeActor,
    learner: CollegeLearner,
  ) {
    await this.operate({
      action: "assign-admission",
      apply: true,
      reviewerEmail: admin.email,
      admissionId: learner.admissionId,
    });
    await admin.page.goto(`/admin/learner-admission/${learner.admissionId}`);
    await this.capture<unknown, { message: string }>(
      admin.page,
      `/api/admin/learner-admission/${learner.admissionId}/decision`,
      "POST",
      () =>
        admin.page
          .getByRole("button", { name: "Save admission decision", exact: true })
          .click(),
      404,
    );
    for (const check of ["guardian_authority", "guardian_notice"]) {
      await admin.page.getByLabel("Review check").selectOption(check);
      const reference = `admin-guardian:${randomUUID()}`;
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
    expect(
      (
        await this.owner.pool.query(
          "SELECT guardian_user_id,status FROM guardian_learner_links WHERE learner_id=$1",
          [learner.id],
        )
      ).rows,
    ).toEqual([{ guardian_user_id: parent.id, status: "authorized" }]);
    await parent.page.goto("/learners");
    await expect(
      parent.page.getByRole("heading", {
        name: learner.displayName,
        exact: true,
      }),
    ).toBeVisible();
  }

  async prepareBooking(
    actor: CollegeActor,
    learner: CollegeLearner,
    tutorSlug: string,
    subjectSlug: string,
    level: "high_school" | "college_support",
  ) {
    await actor.page.goto(`/tutors/${tutorSlug}`);
    await actor.page
      .getByLabel("Subject", { exact: true })
      .selectOption(subjectSlug);
    await actor.page.getByLabel("Level", { exact: true }).selectOption(level);
    await actor.page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await actor.page
      .getByRole("button", { name: "Load open times", exact: true })
      .click();
    const options = await actor.page
      .locator('input[name="time"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      );
    const interval = options.find(
      (value) => Date.parse(value.split("|")[0]) >= Date.now() + 4 * 3600000,
    );
    expect(Boolean(interval)).toBe(true);
    await actor.page.locator(`input[name="time"][value="${interval}"]`).check();
    const [startAtUtc, endAtUtc] = interval!.split("|");
    expect(Date.parse(endAtUtc) - Date.parse(startAtUtc)).toBe(3600000);
    await actor.page
      .getByRole("button", { name: "Review booking", exact: true })
      .click();
    await expect(actor.page).toHaveURL(
      (url) => url.pathname === "/bookings/new",
    );
    const native = new URL(actor.page.url()).searchParams;
    for (const [key, value] of Object.entries({
      tutorSlug,
      subjectSlug,
      level,
      displayTimezone: "Asia/Manila",
      time: interval!,
    }))
      expect(native.get(key)).toBe(value);
    await actor.page
      .getByLabel("Learner", { exact: true })
      .selectOption(learner.id);
    await actor.page
      .getByRole("button", { name: "Show available times", exact: true })
      .click();
    const selected = new URL(actor.page.url()).searchParams;
    expect(selected.get("startAtUtc")).toBe(startAtUtc);
    expect(selected.get("endAtUtc")).toBe(endAtUtc);
    await expect(
      actor.page.locator(`input[name="slot"][value="${startAtUtc}"]`),
    ).toBeChecked();
    return { startAtUtc, endAtUtc };
  }

  async createBooking(actor: CollegeActor) {
    const button = actor.page.getByRole("button", {
      name: "Request booking",
      exact: true,
    });
    await expect(button).toBeEnabled();
    const saved = await this.capture<AdminCreateInput, WorkflowReceipt>(
      actor.page,
      "/api/bookings/demo",
      "POST",
      () => button.dblclick(),
    );
    expect(saved.receipt.state).toBe("provisional");
    await expect(actor.page).toHaveURL(
      new RegExp(`/bookings/${saved.receipt.id}\\?scope=(guardian|student)$`),
    );
    const retry = await actor.context.request.post("/api/bookings/demo", {
      headers: { origin: this.packet.origin },
      data: saved.input,
    });
    expect(retry.status()).toBe(200);
    const receipt = (await retry.json()) as WorkflowReceipt;
    expect(receipt.id).toBe(saved.receipt.id);
    expect(receipt.eventId).toBe(saved.receipt.eventId);
    expect(
      (
        await this.owner.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM bookings WHERE booked_by_user_id=$1 AND idempotency_key=$2",
          [actor.id, saved.input.idempotencyKey],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await this.owner.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_provisional'",
          [saved.receipt.id],
        )
      ).rows[0].n,
    ).toBe(1);
    return saved;
  }

  async grantBooking(admin: CollegeActor, bookingId: string) {
    await this.operate({
      action: "grant-confirmation",
      apply: true,
      bookingId,
      reviewerEmail: admin.email,
      validUntil: this.packet.screening.validUntil,
    });
  }

  async confirmBooking(admin: CollegeActor, bookingId: string) {
    await this.grantBooking(admin, bookingId);
    await admin.page.goto(`/admin/bookings/${bookingId}`);
    const result = await this.capture<AdminWorkflowInput, WorkflowReceipt>(
      admin.page,
      `/api/bookings/${bookingId}/workflow/confirm`,
      "POST",
      () =>
        admin.page
          .getByRole("button", {
            name: "Confirm booking prerequisites",
            exact: true,
          })
          .click(),
    );
    expect(result.receipt.state).toBe("confirmed");
    const retry = await admin.context.request.post(
      `/api/bookings/${bookingId}/workflow/confirm`,
      {
        headers: { origin: this.packet.origin },
        data: result.input,
      },
    );
    expect(retry.status()).toBe(200);
    expect(((await retry.json()) as WorkflowReceipt).eventId).toBe(
      result.receipt.eventId,
    );
    expect(
      (
        await this.owner.pool.query(
          "SELECT actor_user_id FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_confirmed'",
          [bookingId],
        )
      ).rows,
    ).toEqual([{ actor_user_id: admin.id }]);
    return result;
  }

  async accessible(page: Page) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      // No private document text, evidence, factor secrets or links in failures.
      expect(results.violations.map(({ id }) => id)).toEqual([]);
    }
  }
}

export async function keyboardReach(page: Page, control: Locator) {
  for (let tabs = 0; tabs < 70; tabs++) {
    await page.keyboard.press("Tab");
    if (await control.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(control).toBeFocused();
}
