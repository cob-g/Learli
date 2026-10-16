import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "../../src/features/private-workflow/config";
import { runPrivateWorkflowOperation } from "../../src/features/private-workflow/operator";
import { totpCode } from "./admin-mfa";
import { assertOwnedReadinessDatabase } from "./readiness-placement";

export type CollegeActor = {
  context: BrowserContext;
  page: Page;
  email: string;
  id: string;
};
export type CollegeLearner = {
  id: string;
  admissionId: string;
  displayName: string;
};
type CollegeAccount =
  | "college-admin"
  | "college-a"
  | "college-b"
  | "college-tutor"
  | "ops-admin"
  | "ops-other"
  | "ops-parent"
  | "ops-student"
  | "ops-tutor";
type AccountIntent = "student" | "parent";
type TutorOptions = {
  offerings?: { subject: string; levels: string[] }[];
  headline?: string;
  introduction?: string;
  background?: string;
};
const password = "Fictional-student-browser-passphrase-123";

/** Isolate serial browser cases from earlier auth attempts on this owned test
 * database. Application throttles remain enabled throughout each actual case. */
export async function resetPrivateBrowserAuthAttempts(
  owner: ReturnType<typeof createDatabase>,
) {
  assertOwnedReadinessDatabase(process.cwd());
  const identity = (
    await owner.pool.query<{ database: string; actor: string }>(
      "SELECT current_database() AS database,current_user AS actor",
    )
  ).rows[0];
  if (identity?.database !== "learli_test" || identity.actor !== "learli_owner")
    throw new Error(
      "Private browser setup requires the owned test database owner.",
    );
  await owner.pool.query(
    "UPDATE rate_limit SET count=0 WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/sign-in/email%' OR key LIKE '%/two-factor/%' OR key LIKE '%verify-email%' OR key LIKE '%/get-session%'",
  );
}

/** Normal-build browser actors only. The owner connection prepares metadata and
 * inspects persisted records; it never grants Student eligibility or tutor approval. */
export class PrivateStudentBrowser {
  readonly owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  private readonly contexts: BrowserContext[] = [];
  packet!: PrivateWorkflowPacket;
  private binding!: PrivateWorkflowBinding;

  load() {
    assertOwnedReadinessDatabase(process.cwd());
    const raw = JSON.parse(
      readFileSync(process.env.PRIVATE_WORKFLOW_CONFIG_FILE!, "utf8"),
    );
    this.binding = { origin: process.env.APP_URL!, database: raw.database };
    this.packet = parsePrivateWorkflow(raw, this.binding);
  }

  async close() {
    await Promise.all(this.contexts.map((context) => context.close()));
    await this.owner.pool.end();
  }

  async context(browser: Browser) {
    const context = await browser.newContext({ baseURL: this.packet.origin });
    this.contexts.push(context);
    return context;
  }

  async operate(command: Parameters<typeof runPrivateWorkflowOperation>[3]) {
    const client = await this.owner.pool.connect();
    try {
      return await runPrivateWorkflowOperation(
        client,
        this.packet,
        this.binding,
        command,
      );
    } finally {
      client.release();
    }
  }

  async register(
    browser: Browser,
    account: CollegeAccount,
    next = "/account",
    intent?: AccountIntent,
  ) {
    const context = await this.context(browser);
    const page = await context.newPage();
    const email = this.packet.accountEmails.find((value) =>
      value.startsWith(`${account}-`),
    );
    expect(Boolean(email)).toBe(true);
    const college =
      intent === "student" ||
      (!intent && (account === "college-a" || account === "college-b"));
    await page.goto(`/sign-up?${new URLSearchParams({ next })}`);
    await expect(
      page.getByRole("complementary", { name: "Private staging" }),
    ).toBeVisible();
    await page
      .getByLabel("Display name", { exact: true })
      .fill(`Fictional ${account}`);
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password);
    if (college) {
      await page.getByLabel("Account type").selectOption("student");
      await expect(
        page.getByRole("option", { name: "College Student", exact: true }),
      ).toBeAttached();
    } else if (intent === "parent")
      await page.getByLabel("Account type").selectOption("parent");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByText(/a verification message is available/),
    ).toBeVisible();
    const captured = readdirSync(path.join(process.cwd(), ".local/mail/test"))
      .filter((file) => file.endsWith(".json"))
      .map(
        (file) =>
          JSON.parse(
            readFileSync(
              path.join(process.cwd(), ".local/mail/test", file),
              "utf8",
            ),
          ) as { to: string; kind: string; url: string },
      );
    const notice = captured.findLast(
      (message) => message.to === email && message.kind === "verification",
    );
    expect(Boolean(notice)).toBe(true);
    await page.goto(notice!.url);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    if (college) {
      const callback = new URL(page.url()).searchParams.get("next");
      expect(Boolean(callback)).toBe(true);
      const destination = new URL(callback!, this.packet.origin);
      expect(destination.pathname).toBe("/student/onboarding");
      expect(destination.searchParams.get("next")).toBe(
        next === "/account" ? null : next,
      );
    }
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/sign-in/);
    const id = (
      await this.owner.pool.query<{ id: string }>(
        'SELECT id FROM public."user" WHERE email=$1 AND email_verified',
        [email],
      )
    ).rows[0]?.id;
    expect(Boolean(id)).toBe(true);
    if (college) {
      await expect(page).toHaveURL(
        (url) => url.pathname === "/student/onboarding",
      );
      expect(new URL(page.url()).searchParams.get("next")).toBe(
        next === "/account" ? null : next,
      );
      await expect(
        page.getByRole("heading", {
          name: "Set up College Student",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        (
          await this.owner.pool.query(
            "SELECT role FROM user_roles WHERE user_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        page.getByRole("link", { name: "Student workspace", exact: true }),
      ).toHaveCount(0);
    } else if (intent === "parent") {
      await page
        .getByRole("button", { name: "Continue as parent", exact: true })
        .click();
      await expect(page).toHaveURL((url) => url.pathname === "/parent");
    }
    return { context, page, email: email!, id: id! } satisfies CollegeActor;
  }

  async enrollAdmin(
    actor: CollegeActor,
    options: { existingRole?: boolean; prepare?: boolean } = {},
  ) {
    // Explicit owner bootstrap is limited to this fictional administrator.
    if (!options.existingRole)
      await this.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
        [actor.id],
      );
    await actor.page.goto("/account/security");
    await actor.page
      .getByLabel("Current password", { exact: true })
      .fill(password);
    await actor.page
      .getByRole("button", { name: "Set up authenticator", exact: true })
      .click();
    const key = actor.page.locator("[data-mfa-secret]").first();
    await expect(key).toBeVisible();
    await actor.page
      .getByLabel("Authenticator code", { exact: true })
      .fill(totpCode((await key.textContent())!));
    await actor.page
      .getByRole("button", { name: "Verify administrator access", exact: true })
      .click();
    await expect(
      actor.page.getByText("Administrator verification is current.", {
        exact: false,
      }),
    ).toBeVisible();
    if (options.prepare !== false)
      await this.operate({
        action: "prepare",
        apply: true,
        reviewerEmail: actor.email,
      });
  }

  async requestIndependent(
    actor: CollegeActor,
    displayName: string,
  ): Promise<CollegeLearner> {
    const setup = new URL(actor.page.url());
    const setupPath = `${setup.pathname}${setup.search}`;
    await actor.page
      .getByRole("link", { name: "Request independent admission", exact: true })
      .click();
    await expect(
      actor.page.getByLabel("Request type", { exact: true }),
    ).toHaveValue("self");
    await expect(
      actor.page.getByLabel("Learner level", { exact: true }),
    ).toHaveCount(0);
    await actor.page
      .getByLabel("Learner display name", { exact: true })
      .fill(displayName);
    await actor.page
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Manila");
    await actor.page
      .getByRole("button", { name: "Request admission review", exact: true })
      .click();
    await expect(actor.page).toHaveURL(/\/learner-admission\/[a-f0-9-]+$/);
    const admissionId = new URL(actor.page.url()).pathname.split("/").at(-1)!;
    await expect(
      actor.page.getByText(/Learner access is not authorized/),
    ).toBeVisible();
    await expect(
      actor.page.getByRole("link", { name: "Student workspace", exact: true }),
    ).toHaveCount(0);
    const row = (
      await this.owner.pool.query<{
        id: string;
        status: string;
        management: string;
        user_id: string;
        level: string;
        links: number;
      }>(
        "SELECT l.id,l.status,l.management,l.user_id,l.level,(SELECT count(*)::int FROM guardian_learner_links g WHERE g.learner_id=l.id) links FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1",
        [admissionId],
      )
    ).rows[0];
    expect(row).toMatchObject({
      status: "inactive",
      management: "self",
      user_id: actor.id,
      level: "college_support",
      links: 0,
    });
    expect(
      (
        await this.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [actor.id],
        )
      ).rows,
    ).toEqual([]);
    await actor.page.goto(setupPath);
    await expect(actor.page).toHaveURL(
      new RegExp(`/learner-admission/${admissionId}(?:\\?|$)`),
    );
    return { id: row.id, admissionId, displayName };
  }

  async authorizeIndependent(
    admin: CollegeActor,
    actor: CollegeActor,
    learner: CollegeLearner,
  ) {
    await this.operate({
      action: "assign-admission",
      apply: true,
      admissionId: learner.admissionId,
      reviewerEmail: admin.email,
    });
    await admin.page.goto(`/admin/learner-admission/${learner.admissionId}`);
    expect(
      await admin.page
        .getByLabel("Review check")
        .locator("option")
        .allTextContents(),
    ).toEqual(["Independent eligibility"]);
    const blocked = admin.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/admin/learner-admission/${learner.admissionId}/decision` &&
        response.request().method() === "POST",
    );
    await admin.page
      .getByRole("button", { name: "Save admission decision", exact: true })
      .click();
    expect((await blocked).status()).toBe(404);
    expect(
      (
        await this.owner.pool.query(
          "SELECT state FROM learner_admissions WHERE id=$1",
          [learner.admissionId],
        )
      ).rows[0].state,
    ).toBe("pending");
    await admin.page
      .getByLabel("Review check")
      .selectOption("independent_eligibility");
    const reference = `college:${randomUUID()}`;
    await admin.page.getByLabel("Opaque test reference").fill(reference);
    await admin.page
      .getByRole("button", { name: "Record evidence", exact: true })
      .click();
    await expect(
      admin.page.getByText(reference, { exact: false }),
    ).toBeVisible();
    await admin.page
      .getByRole("button", { name: "Save admission decision", exact: true })
      .click();
    await expect(admin.page.getByText(/Status: authorized\./)).toBeVisible();
    expect(
      (
        await this.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [actor.id],
        )
      ).rows,
    ).toEqual([{ role: "student" }]);
    expect(
      (
        await this.owner.pool.query(
          "SELECT count(*)::int n FROM guardian_learner_links WHERE learner_id=$1",
          [learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
    await actor.page.reload();
    await actor.page
      .getByRole("link", { name: "Student workspace", exact: true })
      .click();
    await expect(actor.page).toHaveURL(/\/student$/);
  }

  async approveScienceTutor(
    admin: CollegeActor,
    tutor: CollegeActor,
    options: TutorOptions = {},
  ) {
    await tutor.page.goto("/become-a-tutor");
    await tutor.page
      .getByRole("button", { name: "Start tutor application", exact: true })
      .click();
    await expect(tutor.page).toHaveURL(/\/tutor\/profile$/);
    await tutor.page
      .getByLabel("Headline")
      .fill(options.headline ?? "Fictional College Science tutoring");
    await tutor.page
      .getByLabel("Introduction")
      .fill(
        options.introduction ??
          "A fictional Science tutor for independent College workflow acceptance.",
      );
    await tutor.page
      .getByLabel("Teaching background")
      .fill(
        options.background ??
          "Fictional education and teaching experience for College QA only.",
      );
    await tutor.page.getByLabel("Time zone").selectOption("Asia/Manila");
    for (const offering of options.offerings ?? [
      { subject: "Science", levels: ["College Support"] },
    ])
      for (const level of offering.levels)
        await tutor.page
          .getByRole("group", { name: offering.subject, exact: true })
          .getByLabel(level, { exact: true })
          .check();
    await tutor.page
      .getByRole("button", { name: "Submit application", exact: true })
      .click();
    await expect(tutor.page.getByRole("status")).toHaveText(
      "Application submitted.",
    );
    const profile = (
      await this.owner.pool.query<{ id: string; slug: string }>(
        "SELECT id,slug FROM tutor_profiles WHERE user_id=$1",
        [tutor.id],
      )
    ).rows[0];
    await tutor.page.goto("/tutor/screening");
    await tutor.page
      .getByRole("button", { name: "Request synthetic screening", exact: true })
      .click();
    await expect(
      tutor.page.getByText(/Screening status: pending/),
    ).toBeVisible();
    await this.operate({
      action: "assign-screening",
      apply: true,
      tutorId: profile.id,
      reviewerEmail: admin.email,
      validUntil: this.packet.screening.validUntil,
    });
    await admin.page.goto(`/admin/tutors/${profile.id}`);
    for (const code of this.packet.screening.requiredCheckCodes) {
      await admin.page.getByLabel("Required check").selectOption(code);
      await admin.page
        .getByLabel("Evidence reference")
        .fill(`screening:${randomUUID()}`);
      await admin.page
        .getByLabel("Checked at (UTC ISO date)")
        .fill(new Date(Date.now() - 60_000).toISOString());
      await admin.page
        .getByLabel("Expires at (UTC ISO date)")
        .fill(this.packet.screening.validUntil);
      await admin.page
        .getByRole("button", { name: "Record check", exact: true })
        .click();
      await expect(
        admin.page.getByText(`${code}: Current passed evidence`, {
          exact: true,
        }),
      ).toBeVisible();
    }
    await admin.page
      .getByRole("button", { name: "Approve synthetic screening", exact: true })
      .click();
    await admin.page
      .getByRole("button", { name: "Confirm screening decision", exact: true })
      .click();
    await expect(admin.page.getByText(/State: approved\./)).toBeVisible();
    // Initial schedule setup uses the real authenticated endpoint; this case does
    // not claim every availability-editor control was exercised through UI.
    expect(
      (
        await tutor.context.request.put("/api/tutor/availability", {
          headers: { origin: this.packet.origin },
          data: {
            version: 0,
            timezone: "Asia/Manila",
            windows: Array.from({ length: 7 }, (_, index) => ({
              isoWeekday: index + 1,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
        })
      ).status(),
    ).toBe(200);
    return profile;
  }
}
