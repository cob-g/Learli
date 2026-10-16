import {
  privateAbort,
  privateContinue,
  privateGet,
  privateJson,
  privatePost,
  protectedOperation,
} from "./cross-browser-privacy";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  test as base,
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
import { familyLearner, familyReservation } from "../support/family-fixtures";

export { expect };
export const password = "Synthetic-cross-browser-passphrase-123";
export type Actor = {
  id: string;
  email: string;
  context: BrowserContext;
  page: Page;
};
type Role = "parent" | "student" | "tutor";
type Tutor = { id: string; slug: string; name: string; actor: Actor };

export class CrossBrowserWorld {
  readonly owner;
  readonly baseURL = process.env.APP_URL ?? "";
  readonly contexts: BrowserContext[] = [];
  readonly users: string[] = [];
  readonly tutors: string[] = [];
  readonly externalRequests: string[] = [];

  constructor(readonly browser: Browser) {
    if (process.env.APP_ENV !== "test" || process.env.AUTH_MODE !== "local")
      throw new Error("Dedicated synthetic local test environment required.");
    this.owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  }

  async waitForAuthBudget() {
    // Respect real loopback rate limits, including inherited attempts. Do not
    // clear or rewrite counters belonging to earlier suites.
    const rows = await this.owner.pool.query<{
      count: number;
      last_request: string;
    }>(
      "SELECT count,last_request FROM rate_limit WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/sign-in/email%'",
    );
    const waitMs = Math.max(
      0,
      ...rows.rows
        .filter((row) => row.count >= 7)
        .map((row) => Number(row.last_request) + 60_100 - Date.now()),
    );
    if (waitMs > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(waitMs, 60_000)),
      );
  }

  async context(javaScriptEnabled = true, interceptRequests = true) {
    const context = await this.browser.newContext({
      baseURL: this.baseURL,
      javaScriptEnabled,
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });
    this.contexts.push(context);
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.origin !== this.baseURL
      )
        this.externalRequests.push(url.origin);
    });
    // Routing disables HTTP caching. Preserve natural browser cache behavior
    // for same-context Back/privacy cases, while observing zero external traffic.
    if (interceptRequests)
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          ["http:", "https:"].includes(url.protocol) &&
          url.origin !== this.baseURL
        ) {
          await privateAbort(route);
        } else await privateContinue(route);
      });
    return context;
  }

  async capturedVerification(email: string) {
    return protectedOperation(async () => {
      const directory = localMailbox("test");
      for (const file of (await readdir(directory))
        .filter((name) => name.endsWith(".json"))
        .sort()
        .reverse()) {
        const message = JSON.parse(
          await readFile(path.join(directory, file), "utf8"),
        ) as LocalMessage;
        if (message.to === email && message.kind === "verification") {
          const url = new URL(message.url);
          if (
            url.origin !== this.baseURL ||
            url.pathname !== "/api/auth/verify-email"
          )
            throw new Error(
              "Local verification capture has an unexpected destination.",
            );
          return message.url;
        }
      }
      throw new Error("Expected an owned private local verification capture.");
    });
  }

  async account(
    role?: Role,
    signIn = true,
    interceptRequests = true,
  ): Promise<Actor> {
    await this.waitForAuthBudget();
    const context = await this.context(true, interceptRequests);
    const email = `cross-browser-${randomUUID()}@learli.test`;
    const signup = await privatePost(
      context.request,
      "/api/auth/sign-up/email",
      {
        headers: { origin: this.baseURL },
        data: {
          email,
          password,
          name: "Synthetic cross-browser account",
          callbackURL: "/account",
        },
      },
    );
    expect(signup.status()).toBe(200);
    const id: string = (await privateJson(signup)).user.id;
    this.users.push(id);
    const verified = await privateGet(
      context.request,
      await this.capturedVerification(email),
      { maxRedirects: 0 },
    );
    expect(verified.status()).toBe(302);
    await this.owner.pool.query('UPDATE "user" SET timezone=$2 WHERE id=$1', [
      id,
      "America/New_York",
    ]);
    if (role)
      await this.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES ($1,$2)",
        [id, role],
      );
    if (signIn) {
      const response = await privatePost(
        context.request,
        "/api/auth/sign-in/email",
        {
          headers: { origin: this.baseURL },
          data: { email, password },
        },
      );
      expect(response.status()).toBe(200);
    }
    return { id, email, context, page: await context.newPage() };
  }

  async tutor(status: "approved" | "pending" = "approved"): Promise<Tutor> {
    const actor = await this.account("tutor");
    const slug = `cross-browser-${randomUUID()}`;
    const name = `Synthetic browser tutor ${randomUUID().slice(0, 8)}`;
    await this.owner.pool.query('UPDATE "user" SET name=$2 WHERE id=$1', [
      actor.id,
      name,
    ]);
    const row = await this.owner.pool.query<{ id: string }>(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic academic support','Synthetic local fixture only.','Synthetic local fixture only.','Asia/Manila',$3) RETURNING id",
      [actor.id, slug, status],
    );
    const id = row.rows[0].id;
    this.tutors.push(id);
    await this.owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['elementary','college_support'] FROM subjects WHERE slug='math' AND is_active",
      [id],
    );
    await this.owner.pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,n,480,1200 FROM generate_series(1,7) n",
      [id],
    );
    return { actor, id, slug, name };
  }

  async learner(actor: Actor, management: "guardian" | "self" = "guardian") {
    const name = `Private synthetic browser learner ${randomUUID().slice(0, 8)}`;
    const id = await familyLearner(this.owner.pool, actor.id, management, name);
    return { id, name };
  }

  async reservation(
    actor: Actor,
    learnerId: string,
    tutorId: string,
    expired = false,
  ) {
    return familyReservation(this.owner.pool, {
      actorId: actor.id,
      learnerId,
      tutorId,
      expired,
      // Place read-only history outside the 14-day live candidate horizon.
      startMinutes: expired ? 20 * 24 * 60 : 180,
    });
  }

  async cleanup() {
    try {
      if (this.tutors.length)
        await this.owner.pool.query(
          "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
          [this.tutors],
        );
      if (this.users.length)
        await this.owner.pool.query(
          "DELETE FROM session WHERE user_id=ANY($1::text[])",
          [this.users],
        );
      expect(
        this.externalRequests.length,
        "No off-origin browser requests permitted",
      ).toBe(0);
    } finally {
      await Promise.all(this.contexts.map((context) => context.close()));
      await this.owner.pool.end();
    }
  }
}

export const test = base.extend<{ wave: CrossBrowserWorld }>({
  wave: async ({ browser }, runFixture) => {
    const wave = new CrossBrowserWorld(browser);
    await mkdir(".local/readiness-wave", { recursive: true, mode: 0o700 });
    await writeFile(
      `.local/readiness-wave/engine-${browser.browserType().name()}.json`,
      JSON.stringify({
        engine: browser.browserType().name(),
        version: browser.version(),
      }) + "\n",
      { mode: 0o600 },
    );
    try {
      await runFixture(wave);
    } finally {
      await wave.cleanup();
    }
  },
});

export async function signIn(page: Page, email: string) {
  await page.getByLabel("Test email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  if (result.violations.length) {
    const safeMetric = (data: unknown, key: string) => {
      if (typeof data !== "object" || data === null) return undefined;
      const value: unknown = Reflect.get(data, key);
      return typeof value === "number" ||
        (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value))
        ? value
        : undefined;
    };
    const sanitized = result.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        targetHash: createHash("sha256")
          .update(JSON.stringify(node.target))
          .digest("hex"),
        checks: node.any.map((check) => ({
          id: check.id,
          fgColor: safeMetric(check.data, "fgColor"),
          bgColor: safeMetric(check.data, "bgColor"),
          contrastRatio: safeMetric(check.data, "contrastRatio"),
        })),
      })),
    }));
    await writeFile(
      `.local/readiness-wave/axe-${page.context().browser()?.browserType().name() ?? "unknown"}-${randomUUID()}.json`,
      JSON.stringify(sanitized, null, 2) + "\n",
      { mode: 0o600 },
    );
  }
  expect(
    result.violations.length,
    "Axe WCAG violations (private payload omitted)",
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal overflow",
  ).toBe(true);
}

export async function responsive(page: Page) {
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await accessible(page);
  }
}

export async function assertPrivateAbsent(page: Page, values: string[]) {
  // Capture one complete root across legitimate document replacement. Privacy
  // comparisons run once below, outside Playwright's context-aware acquisition.
  const snapshot = await page.waitForFunction(() => {
    if (document.readyState !== "complete") return "";
    return document.documentElement.outerHTML;
  });
  const html = await snapshot.jsonValue();
  await snapshot.dispose();
  expect(
    values.some(
      (value) =>
        html.includes(value) || html.includes(encodeURIComponent(value)),
    ),
    "Prior private document payload must be absent",
  ).toBe(false);
  expect(
    values.some(
      (value) =>
        page.url().includes(value) ||
        page.url().includes(encodeURIComponent(value)),
    ),
    "Private payload must be absent from URL",
  ).toBe(false);
}
