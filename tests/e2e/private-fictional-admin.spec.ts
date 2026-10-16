import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { WorkflowReceipt } from "../../src/features/booking-workflows/model";
import {
  resetPrivateBrowserAuthAttempts,
  type CollegeActor,
} from "../support/private-student-browser";
import { historicalWorkflowBooking } from "../support/booking-workflows-fixtures";
import {
  PrivateAdminBrowser,
  keyboardReach,
  type AccessInput,
  type AccessReceipt,
  type AdminCreateInput,
  type AdminSubject,
  type AdminWorkflowInput,
} from "../support/private-admin-browser";

test.use({ trace: "off", screenshot: "off", video: "off" });
const h = new PrivateAdminBrowser();
const meeting = "https://meet.google.com/abc-defg-hij";
type StaffBooking = {
  id: string;
  logicalBookingId: string;
  state: string;
  start: string;
  end: string;
  subject: string;
  tutorName: string;
  learnerName: string;
  learnerLevel: string;
  requesterName: string;
  relationship: "guardian" | "self";
  actions: string[];
};
type StaffBookings = {
  items: StaffBooking[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};
type AccountTargets = {
  targets: { id: string; name: string; status: string; roles: string[] }[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

test.beforeAll(async () => {
  h.load();
  await resetPrivateBrowserAuthAttempts(h.owner);
});
test.afterAll(() => h.close());

async function readBookings(actor: CollegeActor, query = "") {
  const response = await actor.context.request.get(
    `/api/admin/bookings${query}`,
  );
  expect(response.status()).toBe(200);
  const value = (await response.json()) as StaffBookings;
  expect(JSON.stringify(value).includes(meeting)).toBe(false);
  for (const item of value.items) {
    expect(
      Object.keys(item).some((key) =>
        /email|contact|meeting|userId|accountId|url/i.test(key),
      ),
    ).toBe(false);
  }
  return value;
}

async function readAccounts(actor: CollegeActor, query = "") {
  const response = await actor.context.request.get(
    `/api/admin/accounts${query}`,
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as AccountTargets;
}

async function expectAdminLocation(
  page: Page,
  path: string,
  query: Record<string, string | null>,
) {
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === path &&
      Object.entries(query).every(
        ([key, value]) => url.searchParams.get(key) === value,
      ),
  );
}

async function subjectAudit(subjectId: string) {
  return (
    await h.owner.pool.query<{ action: string; actor_user_id: string }>(
      "SELECT action,actor_user_id FROM audit_events WHERE target_subject_id=$1 ORDER BY action,created_at,id",
      [subjectId],
    )
  ).rows;
}

function subjectEditor(page: Page, id: string) {
  return page
    .locator("details")
    .filter({ has: page.locator(`#subject-name-${id}`) });
}

async function accountSnapshot(targetId: string, tutorId: string) {
  return {
    roles: (
      await h.owner.pool.query(
        "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
        [targetId],
      )
    ).rows,
    sessions: (
      await h.owner.pool.query(
        "SELECT id FROM session WHERE user_id=$1 ORDER BY id",
        [targetId],
      )
    ).rows,
    bookings: (
      await h.owner.pool.query(
        "SELECT id,logical_booking_id,state,subject_id,start_at_utc,end_at_utc FROM bookings WHERE tutor_id=$1 ORDER BY id",
        [tutorId],
      )
    ).rows,
  };
}

async function retryAccess(
  admin: CollegeActor,
  targetId: string,
  input: AccessInput,
  receipt: AccessReceipt,
) {
  const response = await admin.context.request.patch(
    `/api/admin/accounts/${targetId}`,
    {
      headers: { origin: h.packet.origin },
      data: input,
    },
  );
  expect(response.status()).toBe(200);
  const repeated = (await response.json()) as AccessReceipt;
  expect(repeated.status).toBe(receipt.status);
  expect(repeated.revision).toBe(receipt.revision);
  expect(repeated.replayed).toBe(true);
  expect(
    (
      await h.owner.pool.query(
        "SELECT actor_user_id,target_user_id,expected_revision,revision,previous_status,next_status,reason FROM account_restriction_events WHERE actor_user_id=$1 AND request_key=$2",
        [admin.id, input.requestKey],
      )
    ).rows,
  ).toEqual([
    {
      actor_user_id: admin.id,
      target_user_id: targetId,
      expected_revision: input.revision,
      revision: receipt.revision,
      previous_status: input.status === "suspended" ? "active" : "suspended",
      next_status: input.status,
      reason: input.reason,
    },
  ]);
}

test("normal private build connects actual Admin reviews, scoped accounts, booking lookup and retained catalog history", async ({
  browser,
}) => {
  // This is the production app composition with finite fictional actors. Owner
  // access supplies Admin bootstrap/exact metadata; application UI supplies all
  // review decisions. One separately labelled ended booking is historical only.
  const admin = await h.register(browser, "ops-admin", "/admin");
  const other = await h.register(browser, "ops-other");

  await test.step("verified Admin entry requires actual MFA and survives document refresh", async () => {
    await h.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [admin.id],
    );
    await admin.page.goto("/admin");
    await expect(admin.page).toHaveURL(
      (url) => url.pathname === "/account/security",
    );
    expect(
      (await admin.context.request.get("/api/admin/bookings")).status(),
    ).toBe(403);
    await h.enrollAdmin(admin, { existingRole: true });
    await h.enrollAdmin(other, { prepare: false });
    await admin.page.goto("/admin");
    await expect(
      admin.page.getByRole("heading", { name: "Admin workspace", exact: true }),
    ).toBeVisible();
    await admin.page.reload();
    await expect(
      admin.page.getByRole("heading", { name: "Admin workspace", exact: true }),
    ).toBeVisible();
    await admin.page
      .getByRole("link", { name: "Subjects", exact: true })
      .click();
    await expect(
      admin.page.getByRole("heading", { name: "Subjects", exact: true }),
    ).toBeVisible();
    expect((await readAccounts(admin)).targets).toEqual([]);
    expect((await readBookings(admin)).items).toEqual([]);
    expect((await readAccounts(other)).targets).toEqual([]);
    expect((await readBookings(other)).items).toEqual([]);
  });

  const subject =
    await test.step("Admin adds a specialized subject without fabricating public coverage", async () => {
      const name = `Fictional Applied Science ${randomUUID().slice(0, 8)}`;
      await admin.page.getByLabel("Subject name", { exact: true }).fill(name);
      const created = await h.capture<
        { name: string },
        Omit<AdminSubject, "nameRevision">
      >(admin.page, "/api/admin/subjects", "POST", () =>
        admin.page
          .getByRole("button", { name: "Add subject", exact: true })
          .click(),
      );
      await expect(
        admin.page.getByRole("status").filter({ hasText: "Subject added." }),
      ).toBeVisible();
      expect(created.receipt.category).toBe("specialized");
      expect(created.receipt.isActive).toBe(true);
      const visitor = await h.context(browser);
      const page = await visitor.newPage();
      await page.goto(
        `/tutors?subject=${created.receipt.slug}&level=college_support`,
      );
      await expect(
        page.getByRole("link", { name: /View profile:/ }),
      ).toHaveCount(0);
      expect(await subjectAudit(created.receipt.id)).toEqual([
        { action: "subject.created", actor_user_id: admin.id },
      ]);
      return created.receipt;
    });

  const parent = await h.register(browser, "ops-parent", "/account", "parent");
  const student = await h.register(
    browser,
    "ops-student",
    "/account",
    "student",
  );
  const child = await h.requestGuardian(parent);
  const learner = await h.requestIndependent(
    student,
    "Fictional Admin journey College learner",
  );

  await test.step("pending learners and unassigned Admins have no admission authority", async () => {
    for (const admission of [child, learner]) {
      expect(
        (
          await other.context.request.get(
            `/api/admin/learner-admission/${admission.admissionId}`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await other.context.request.post(
            `/api/admin/learner-admission/${admission.admissionId}/decision`,
            {
              headers: { origin: h.packet.origin },
              data: {
                requestId: randomUUID(),
                revision: 0,
                action: "authorize",
              },
            },
          )
        ).status(),
      ).toBe(404);
    }
    expect(
      (
        await student.context.request.get(`/api/learners/${learner.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (await parent.context.request.get(`/api/learners/${child.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await parent.context.request.get(
          `/api/learner-admission/${learner.admissionId}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await student.context.request.get(
          `/api/learner-admission/${child.admissionId}`,
        )
      ).status(),
    ).toBe(404);
  });
  await h.authorizeGuardian(admin, parent, child);
  await h.authorizeIndependent(admin, student, learner);
  const tutor = await h.register(browser, "ops-tutor");
  const profile = await h.approveScienceTutor(admin, tutor, {
    offerings: [
      { subject: "Science", levels: ["High School", "College Support"] },
      { subject: subject.name, levels: ["College Support"] },
    ],
    headline: "Fictional Admin journey Science tutor",
    introduction:
      "Fictional Science and specialized tutoring for private Admin acceptance only.",
    background:
      "Fictional teaching background, not verified professional credentials.",
  });

  await test.step("current assigned screening is visible while legacy and foreign Admin mutations are denied", async () => {
    await admin.page.goto(`/admin/tutors/${profile.id}`);
    await expect(
      admin.page.getByRole("heading", {
        name: "Fictional ops-tutor",
        exact: true,
      }),
    ).toBeVisible();
    await expect(admin.page.getByText(/State: approved\./)).toBeVisible();
    const background =
      "Fictional teaching background, not verified professional credentials.";
    await expect(
      admin.page.getByText(background, { exact: true }),
    ).toBeVisible();
    await other.page.goto(`/admin/tutors/${profile.id}`);
    await expect(
      other.page.getByRole("heading", {
        name: "We can't find that application",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      other.page.getByRole("heading", {
        name: "Fictional ops-tutor",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(other.page.getByText(background, { exact: true })).toHaveCount(
      0,
    );
    const auditBefore = (
      await h.owner.pool.query(
        "SELECT id FROM audit_events WHERE target_user_id=$1 AND action LIKE 'tutor_review.%' ORDER BY id",
        [tutor.id],
      )
    ).rows;
    const before = (
      await h.owner.pool.query(
        "SELECT review_status FROM tutor_profiles WHERE id=$1",
        [profile.id],
      )
    ).rows;
    expect(
      (
        await admin.context.request.post(
          `/api/admin/tutor-applications/${profile.id}`,
          {
            headers: { origin: h.packet.origin },
            data: { action: "suspend" },
          },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await h.owner.pool.query(
          "SELECT review_status FROM tutor_profiles WHERE id=$1",
          [profile.id],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await h.owner.pool.query(
          "SELECT id FROM audit_events WHERE target_user_id=$1 AND action LIKE 'tutor_review.%' ORDER BY id",
          [tutor.id],
        )
      ).rows,
    ).toEqual(auditBefore);
    expect(
      (
        await h.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
          [student.id],
        )
      ).rows,
    ).toEqual([{ role: "student" }]);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM guardian_learner_links WHERE learner_id=$1",
          [learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });

  await h.prepareBooking(parent, child, profile.slug, "science", "high_school");
  const parentBooking = await h.createBooking(parent);
  await test.step("packet membership alone cannot open an unassigned booking", async () => {
    expect(
      (await readBookings(admin, `?q=${parentBooking.receipt.id}`)).items,
    ).toEqual([]);
    await admin.page.goto(`/admin/bookings/${parentBooking.receipt.id}`);
    await expect(
      admin.page.getByText(/This booking task is unavailable/),
    ).toBeVisible();
    await expect(
      admin.page.getByText(child.displayName, { exact: true }),
    ).toHaveCount(0);
  });
  await h.confirmBooking(admin, parentBooking.receipt.id);
  await h.prepareBooking(
    student,
    learner,
    profile.slug,
    subject.slug,
    "college_support",
  );
  const studentBooking = await h.createBooking(student);
  await h.confirmBooking(admin, studentBooking.receipt.id);
  await h.prepareBooking(
    student,
    learner,
    profile.slug,
    "science",
    "college_support",
  );
  const ungranted = await h.createBooking(student);

  const historical =
    await test.step("a separate historical record completes through actual Tutor controls", async () => {
      // This ended record was not requested in the browser. Its guarded insertion
      // is separate from both fresh bookings; no wait, lesson or attendance claim.
      const now = Date.now();
      const fixture = await historicalWorkflowBooking(
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
          subjectSlug: subject.slug,
        },
      );
      expect(
        [
          parentBooking.receipt.id,
          studentBooking.receipt.id,
          ungranted.receipt.id,
        ].includes(fixture.id),
      ).toBe(false);
      // Historical task metadata is provisioned explicitly with this fixture.
      // The live operator correctly accepts only unexpired provisional bookings.
      await h.owner.pool.query(
        "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'confirm',true,$3::timestamptz,$4)",
        [
          fixture.logicalBookingId,
          admin.id,
          h.packet.screening.validUntil,
          `synthetic:${randomUUID()}`,
        ],
      );
      await tutor.page.goto(`/bookings/${fixture.id}?scope=tutor`);
      const completed = await h.capture<AdminWorkflowInput, WorkflowReceipt>(
        tutor.page,
        `/api/bookings/${fixture.id}/workflow/complete`,
        "POST",
        () =>
          tutor.page
            .getByRole("button", {
              name: "Mark session completed",
              exact: true,
            })
            .click(),
      );
      expect(completed.receipt.state).toBe("completed");
      await expect(
        tutor.page.getByRole("heading", { name: "Completed", exact: true }),
      ).toBeVisible();
      const repeated = await tutor.context.request.post(
        `/api/bookings/${fixture.id}/workflow/complete`,
        {
          headers: { origin: h.packet.origin },
          data: completed.input,
        },
      );
      expect(repeated.status()).toBe(200);
      expect(((await repeated.json()) as WorkflowReceipt).eventId).toBe(
        completed.receipt.eventId,
      );
      expect(
        (
          await h.owner.pool.query(
            "SELECT actor_user_id FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_completed'",
            [fixture.id],
          )
        ).rows,
      ).toEqual([{ actor_user_id: tutor.id }]);
      await student.page.goto("/bookings?scope=student&filter=history");
      await expect(
        student.page.locator(`a[href="/bookings/${fixture.id}?scope=student"]`),
      ).toBeVisible();
      return fixture;
    });

  await test.step("assigned booking queue filters and pages retain exact participants and saved times", async () => {
    const expected = [
      parentBooking.receipt.id,
      studentBooking.receipt.id,
      historical.id,
    ].sort();
    const first = await readBookings(admin, "?state=all&pageSize=2");
    expect(first.page).toBe(1);
    expect(first.pageSize).toBe(2);
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await readBookings(admin, "?state=all&pageSize=2&page=2");
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(
      [...first.items, ...second.items].map((item) => item.id).sort(),
    ).toEqual(expected);
    const own = [...first.items, ...second.items].find(
      (item) => item.id === studentBooking.receipt.id,
    )!;
    expect(own.subject).toBe(subject.name);
    expect(own.tutorName).toBe("Fictional ops-tutor");
    expect(own.learnerName).toBe(learner.displayName);
    expect(own.requesterName).toBe("Fictional ops-student");
    expect(own.relationship).toBe("self");
    expect(own.learnerLevel).toBe("college_support");
    expect(new Date(own.start).toISOString()).toBe(
      studentBooking.input.startAtUtc,
    );
    expect(new Date(own.end).toISOString()).toBe(studentBooking.input.endAtUtc);
    const family = [...first.items, ...second.items].find(
      (item) => item.id === parentBooking.receipt.id,
    )!;
    expect(family.learnerName).toBe(child.displayName);
    expect(family.requesterName).toBe("Fictional ops-parent");
    expect(family.relationship).toBe("guardian");
    expect(family.learnerLevel).toBe("high_school");
    await admin.page.goto("/admin");
    await admin.page
      .getByRole("link", { name: "Assigned bookings", exact: true })
      .click();
    await expect(
      admin.page.getByRole("heading", {
        name: "Assigned bookings",
        exact: true,
      }),
    ).toBeVisible();
    await admin.page.goto("/admin/bookings?state=all&pageSize=2");
    await h.accessible(admin.page);
    await admin.page.reload();
    await keyboardReach(
      admin.page,
      admin.page.getByLabel("Booking ID", { exact: true }),
    );
    await admin.page
      .getByRole("link", { name: "Next bookings", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      page: "2",
      pageSize: "2",
      state: "all",
    });
    expect(new URL(admin.page.url()).searchParams.get("page")).toBe("2");
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("2");
    const last = admin.page.locator("li[data-booking-id]");
    await expect(last).toHaveCount(1);
    await last
      .getByRole("link", { name: "View booking details", exact: true })
      .click();
    await expectAdminLocation(admin.page, `/admin/bookings/${historical.id}`, {
      page: "2",
      pageSize: "2",
      state: "all",
    });
    await expect(
      admin.page.getByRole("heading", {
        name: "Booking participants",
        exact: true,
      }),
    ).toBeVisible();
    expect((await admin.page.content()).includes(meeting)).toBe(false);
    await admin.page
      .getByRole("main")
      .getByRole("link", { name: "Assigned bookings", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      page: "2",
      pageSize: "2",
      state: "all",
    });
    expect(new URL(admin.page.url()).searchParams.get("page")).toBe("2");
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("2");
    await admin.page
      .getByRole("link", { name: "Previous bookings", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      page: "1",
      pageSize: "2",
      state: "all",
    });
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("2");
    await admin.page
      .getByLabel("Status", { exact: true })
      .selectOption("completed");
    await admin.page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      state: "completed",
      pageSize: "2",
    });
    await expect(admin.page.locator("li[data-booking-id]")).toHaveCount(1);
    await expect(
      admin.page.locator(`li[data-booking-id="${historical.id}"]`),
    ).toContainText("Completed");
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("2");
    await admin.page
      .getByLabel("Status", { exact: true })
      .selectOption("confirmed");
    await admin.page
      .getByLabel("Booking ID", { exact: true })
      .fill(studentBooking.receipt.id);
    await admin.page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      q: studentBooking.receipt.id,
      state: "confirmed",
      pageSize: "2",
    });
    const selected = admin.page.locator(
      `li[data-booking-id="${studentBooking.receipt.id}"]`,
    );
    await expect(selected).toBeVisible();
    await expect(
      selected.locator(`time[datetime="${studentBooking.input.startAtUtc}"]`),
    ).toBeVisible();
    await selected
      .getByRole("link", { name: "View booking details", exact: true })
      .click();
    await expectAdminLocation(
      admin.page,
      `/admin/bookings/${studentBooking.receipt.id}`,
      { q: studentBooking.receipt.id, state: "confirmed", pageSize: "2" },
    );
    for (const name of [
      learner.displayName,
      "Fictional ops-tutor",
      "Fictional ops-student",
    ])
      await expect(admin.page.getByRole("main")).toContainText(name);
    await expect(
      admin.page.getByRole("button", {
        name: "Mark session completed",
        exact: true,
      }),
    ).toHaveCount(0);
    await admin.page
      .getByRole("main")
      .getByRole("link", { name: "Assigned bookings", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/bookings", {
      q: studentBooking.receipt.id,
      state: "confirmed",
      pageSize: "2",
    });
    const preserved = new URL(admin.page.url()).searchParams;
    expect(preserved.get("q")).toBe(studentBooking.receipt.id);
    expect(preserved.get("state")).toBe("confirmed");
    expect(preserved.get("pageSize")).toBe("2");
    expect(
      (await readBookings(admin, "?state=completed")).items.map(
        (item) => item.id,
      ),
    ).toEqual([historical.id]);
    expect((await readBookings(admin, "?state=provisional")).items).toEqual([]);
    expect((await readBookings(admin, `?q=${randomUUID()}`)).items).toEqual([]);
    expect(
      (
        await admin.context.request.get("/api/admin/bookings?state=paid")
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.context.request.get("/api/admin/bookings?pageSize=21")
      ).status(),
    ).toBe(400);
  });

  await test.step("catalog corrections retain current names on existing bookings and create one audit per change", async () => {
    await admin.page.goto("/admin/subjects");
    const editor = subjectEditor(admin.page, subject.id);
    await editor.locator("summary").click();
    const nameInput = editor.getByLabel("Display name", { exact: true });
    await nameInput.fill("<script>");
    await editor
      .getByRole("button", { name: "Save subject name", exact: true })
      .click();
    await expect(nameInput).toBeFocused();
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");
    await expect(editor.getByRole("alert")).toContainText("2 to 60 characters");
    await h.accessible(admin.page);
    const name = `Fictional Advanced Science ${randomUUID().slice(0, 8)}`;
    await nameInput.fill(name);
    await nameInput.press("Tab");
    const renamed = await h.capture<
      { name: string; expectedRevision: number },
      AdminSubject
    >(admin.page, `/api/admin/subjects/${subject.id}/name`, "PATCH", () =>
      admin.page.keyboard.press("Enter"),
    );
    await expect(editor.getByRole("status")).toHaveText("Subject name saved.");
    expect(renamed.receipt.name).toBe(name);
    expect(renamed.receipt.slug).toBe(subject.slug);
    expect(renamed.receipt.category).toBe("specialized");
    const repeated = await admin.context.request.patch(
      `/api/admin/subjects/${subject.id}/name`,
      {
        headers: { origin: h.packet.origin },
        data: renamed.input,
      },
    );
    expect(repeated.status()).toBe(200);
    expect(((await repeated.json()) as AdminSubject).nameRevision).toBe(
      renamed.receipt.nameRevision,
    );
    const stale = await admin.context.request.patch(
      `/api/admin/subjects/${subject.id}/name`,
      {
        headers: { origin: h.packet.origin },
        data: {
          name: `Stale ${name}`,
          expectedRevision: renamed.input.expectedRevision,
        },
      },
    );
    expect(stale.status()).toBe(409);
    const duplicate = await admin.context.request.post("/api/admin/subjects", {
      headers: { origin: h.packet.origin },
      data: { name },
    });
    expect(duplicate.status()).toBe(409);
    const core = (
      await h.owner.pool.query<{ id: string }>(
        "SELECT id FROM subjects WHERE slug='science'",
      )
    ).rows[0].id;
    expect(
      (
        await admin.context.request.patch(`/api/admin/subjects/${core}/name`, {
          headers: { origin: h.packet.origin },
          data: { name: "Fictional replaced core", expectedRevision: 0 },
        })
      ).status(),
    ).toBe(403);
    for (const [isActive, label] of [
      [false, "Deactivate"],
      [true, "Activate"],
    ] as const) {
      const changed = await h.capture<
        { isActive: boolean },
        Omit<AdminSubject, "nameRevision">
      >(admin.page, `/api/admin/subjects/${subject.id}`, "PATCH", () =>
        admin.page
          .getByRole("button", { name: `${label} ${name}`, exact: true })
          .click(),
      );
      expect(changed.receipt.isActive).toBe(isActive);
      expect(
        (
          await admin.context.request.patch(
            `/api/admin/subjects/${subject.id}`,
            { headers: { origin: h.packet.origin }, data: changed.input },
          )
        ).status(),
      ).toBe(200);
      await expect(
        admin.page.getByRole("button", {
          name: `${isActive ? "Deactivate" : "Activate"} ${name}`,
          exact: true,
        }),
      ).toBeVisible();
      expect(
        (
          await h.owner.pool.query(
            "SELECT subject_id FROM bookings WHERE id=ANY($1::uuid[]) ORDER BY id",
            [[studentBooking.receipt.id, historical.id]],
          )
        ).rows,
      ).toEqual([{ subject_id: subject.id }, { subject_id: subject.id }]);
      await student.page.goto(`/bookings/${historical.id}?scope=student`);
      await expect(student.page.getByRole("main")).toContainText(name);
      expect(
        (await readBookings(admin, `?q=${historical.id}`)).items[0].subject,
      ).toBe(name);
      await student.page.goto(`/tutors/${profile.slug}`);
      await expect(
        student.page
          .getByRole("region", { name: "Subjects and levels" })
          .getByText(name, { exact: true }),
      ).toHaveCount(isActive ? 1 : 0);
    }
    expect(await subjectAudit(subject.id)).toEqual([
      { action: "subject.activated", actor_user_id: admin.id },
      { action: "subject.created", actor_user_id: admin.id },
      { action: "subject.deactivated", actor_user_id: admin.id },
      { action: "subject.renamed", actor_user_id: admin.id },
    ]);
    await student.page.goto("/bookings?scope=student&filter=history");
    await expect(student.page.getByRole("main")).toContainText(name);
    const current = await readBookings(admin, `?q=${historical.id}`);
    expect(current.items[0].subject).toBe(name);
    expect(current.items[0].state).toBe("completed");
    await student.page.goto(`/tutors/${profile.slug}`);
    await expect(
      student.page
        .getByRole("region", { name: "Subjects and levels" })
        .getByText(name, { exact: true }),
    ).toBeVisible();
    const stored = (
      await h.owner.pool.query(
        "SELECT slug,category,is_active,name_revision FROM subjects WHERE id=$1",
        [subject.id],
      )
    ).rows[0];
    expect(stored).toEqual({
      slug: subject.slug,
      category: "specialized",
      is_active: true,
      name_revision: 1,
    });
  });

  await test.step("only exact account grants allow scoped search, roles and pagination", async () => {
    expect(
      (
        await admin.context.request.get(`/api/admin/accounts/${tutor.id}`)
      ).status(),
    ).toBe(404);
    for (const target of [student, tutor])
      await h.operate({
        action: "grant-account",
        apply: true,
        reviewerEmail: admin.email,
        targetId: target.id,
      });
    const first = await readAccounts(admin, "?status=active&pageSize=1");
    expect(first.targets).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    const second = await readAccounts(
      admin,
      "?status=active&pageSize=1&page=2",
    );
    expect(second.targets).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(
      [...first.targets, ...second.targets].map((target) => target.id).sort(),
    ).toEqual([student.id, tutor.id].sort());
    expect(
      [...first.targets, ...second.targets].find(
        (target) => target.id === student.id,
      )?.roles,
    ).toEqual(["student"]);
    expect(
      [...first.targets, ...second.targets].find(
        (target) => target.id === tutor.id,
      )?.roles,
    ).toEqual(["tutor"]);
    expect(
      (await readAccounts(admin, "?q=Fictional%20ops-parent")).targets,
    ).toEqual([]);
    expect((await readAccounts(admin, "?q=%25")).targets).toEqual([]);
    expect(
      (
        await admin.context.request.get(`/api/admin/accounts/${parent.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await admin.context.request.get(`/api/admin/accounts/${admin.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await admin.context.request.get(`/api/admin/accounts/${other.id}`)
      ).status(),
    ).toBe(404);
    await admin.page.goto("/admin");
    await admin.page
      .getByRole("link", { name: "Accounts", exact: true })
      .click();
    await expect(
      admin.page.getByRole("heading", {
        name: "Authorized fictional accounts",
        exact: true,
      }),
    ).toBeVisible();
    await admin.page.getByLabel("Accounts per page", { exact: true }).fill("1");
    await admin.page
      .getByLabel("Access status", { exact: true })
      .selectOption("active");
    await admin.page
      .getByRole("button", { name: "Filter accounts", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/accounts", {
      pageSize: "1",
      status: "active",
    });
    await h.accessible(admin.page);
    await admin.page
      .getByRole("link", { name: "More accounts", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/accounts", {
      page: "2",
      pageSize: "1",
      status: "active",
    });
    expect(new URL(admin.page.url()).searchParams.get("page")).toBe("2");
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("1");
    await admin.page
      .getByRole("link", { name: "Fictional ops-tutor", exact: true })
      .click();
    await expectAdminLocation(admin.page, `/admin/accounts/${tutor.id}`, {
      page: "2",
      pageSize: "1",
      status: "active",
    });
    await expect(
      admin.page.getByRole("heading", {
        name: "Account access for Fictional ops-tutor",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("heading", { name: "Assigned roles", exact: true }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("region", { name: "Assigned roles", exact: true }),
    ).toContainText("Tutor");
    await expect(
      admin.page
        .getByRole("region", { name: "Assigned roles", exact: true })
        .locator("input,select,button"),
    ).toHaveCount(0);
    await expect(
      admin.page.getByLabel("Assigned role", { exact: true }),
    ).toHaveCount(0);
    await admin.page
      .getByRole("link", { name: "Authorized accounts", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/accounts", {
      page: "2",
      pageSize: "1",
      status: "active",
    });
    expect(new URL(admin.page.url()).searchParams.get("page")).toBe("2");
    expect(new URL(admin.page.url()).searchParams.get("pageSize")).toBe("1");
    await admin.page
      .getByRole("link", { name: "Previous accounts", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/accounts", {
      page: null,
      pageSize: "1",
      status: "active",
    });
    await admin.page
      .getByLabel("Account name", { exact: true })
      .fill("Fictional ops-tutor");
    await admin.page
      .getByLabel("Assigned role", { exact: true })
      .selectOption("tutor");
    await admin.page
      .getByRole("button", { name: "Filter accounts", exact: true })
      .click();
    await expectAdminLocation(admin.page, "/admin/accounts", {
      q: "Fictional ops-tutor",
      role: "tutor",
      status: "active",
      pageSize: "1",
    });
    await expect(
      admin.page.getByRole("link", {
        name: "Fictional ops-tutor",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("link", {
        name: "Fictional ops-student",
        exact: true,
      }),
    ).toHaveCount(0);
    await admin.page
      .getByRole("link", { name: "Fictional ops-tutor", exact: true })
      .click();
    await expectAdminLocation(admin.page, `/admin/accounts/${tutor.id}`, {
      q: "Fictional ops-tutor",
      role: "tutor",
      status: "active",
      pageSize: "1",
    });
    const back = new URL(
      (await admin.page
        .getByRole("link", { name: "Authorized accounts", exact: true })
        .getAttribute("href"))!,
      h.packet.origin,
    );
    expect(back.searchParams.get("q")).toBe("Fictional ops-tutor");
    expect(back.searchParams.get("role")).toBe("tutor");
    expect(back.searchParams.get("status")).toBe("active");
    expect(
      (
        await admin.context.request.get("/api/admin/accounts?role=admin")
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.context.request.get("/api/admin/accounts?pageSize=0")
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.context.request.patch(`/api/admin/accounts/${tutor.id}`, {
          headers: { origin: h.packet.origin },
          data: {
            revision: 0,
            status: "suspended",
            reason: "local_access_test",
            requestKey: randomUUID(),
            roles: ["admin"],
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await h.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [tutor.id],
        )
      ).rows,
    ).toEqual([{ role: "tutor" }]);
    expect(
      (
        await h.owner.pool.query(
          "SELECT status FROM user_access WHERE user_id=$1",
          [tutor.id],
        )
      ).rows[0].status,
    ).toBe("active");
  });

  await test.step("Tutor suspension and replay retain roles, sessions, saved bookings and exact history", async () => {
    // Load a distinct genuinely open interval before suspension; overlap is not
    // a substitute for testing the Tutor's current eligibility on create.
    const choice = await h.prepareBooking(
      parent,
      child,
      profile.slug,
      "science",
      "high_school",
    );
    expect(choice.startAtUtc).not.toBe(parentBooking.input.startAtUtc);
    const before = await accountSnapshot(tutor.id, profile.id);
    expect(before.sessions.length).toBeGreaterThan(0);
    const stale = await admin.context.newPage();
    await stale.goto(`/admin/accounts/${tutor.id}`);
    await admin.page.reload();
    const trigger = admin.page.getByRole("button", {
      name: "Suspend fictional account",
      exact: true,
    });
    await trigger.click();
    const reason = admin.page.getByLabel("Fictional test reason", {
      exact: true,
    });
    await expect(reason).toBeFocused();
    await expect(reason).toHaveAttribute("aria-invalid", "true");
    await expect(admin.page.getByRole("dialog")).toHaveCount(0);
    await reason.selectOption("local_access_test");
    await reason.press("Tab");
    await expect(trigger).toBeFocused();
    await admin.page.keyboard.press("Enter");
    const dialog = admin.page.getByRole("dialog", {
      name: "Suspend Fictional ops-tutor?",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await h.accessible(admin.page);
    await admin.page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    const suspended = await h.capture<AccessInput, AccessReceipt>(
      admin.page,
      `/api/admin/accounts/${tutor.id}`,
      "PATCH",
      () =>
        dialog
          .getByRole("button", { name: "Suspend account access", exact: true })
          .click(),
    );
    expect(suspended.receipt.status).toBe("suspended");
    expect(suspended.receipt.replayed).toBe(false);
    await expect(
      admin.page
        .getByRole("status")
        .filter({ hasText: "Fictional action recorded." }),
    ).toBeVisible();
    await expect(
      admin.page.getByText("Suspended access", { exact: true }),
    ).toBeVisible();
    await retryAccess(admin, tutor.id, suspended.input, suspended.receipt);
    expect(await accountSnapshot(tutor.id, profile.id)).toEqual(before);
    expect(
      (await readAccounts(admin, "?role=tutor&status=suspended")).targets.map(
        (target) => target.id,
      ),
    ).toEqual([tutor.id]);
    expect(
      (await parent.context.request.get(`/tutors/${profile.slug}`)).status(),
    ).toBe(404);
    const denied = await h.capture<AdminCreateInput, { message: string }>(
      parent.page,
      "/api/bookings/demo",
      "POST",
      () =>
        parent.page
          .getByRole("button", { name: "Request booking", exact: true })
          .click(),
      404,
    );
    expect(denied.input.startAtUtc).toBe(choice.startAtUtc);
    expect(typeof denied.receipt.message).toBe("string");
    expect(denied.receipt.message.length).toBeGreaterThan(0);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM bookings WHERE booked_by_user_id=$1 AND idempotency_key=$2",
          [parent.id, denied.input.idempotencyKey],
        )
      ).rows[0].n,
    ).toBe(0);
    await expect(
      parent.page
        .getByRole("alert")
        .filter({ hasText: denied.receipt.message }),
    ).toBeVisible();
    await stale
      .getByLabel("Fictional test reason", { exact: true })
      .selectOption("local_access_test");
    await stale
      .getByRole("button", { name: "Suspend fictional account", exact: true })
      .click();
    await h.capture<AccessInput, { message: string }>(
      stale,
      `/api/admin/accounts/${tutor.id}`,
      "PATCH",
      () =>
        stale
          .getByRole("dialog")
          .getByRole("button", { name: "Suspend account access", exact: true })
          .click(),
      409,
    );
    await expect(
      stale
        .getByRole("alert")
        .filter({ hasText: "This account or request changed." }),
    ).toBeVisible();
    await stale.close();
    await admin.page
      .getByLabel("Fictional test reason", { exact: true })
      .selectOption("local_restore_test");
    await admin.page
      .getByRole("button", { name: "Restore fictional account", exact: true })
      .click();
    const restored = await h.capture<AccessInput, AccessReceipt>(
      admin.page,
      `/api/admin/accounts/${tutor.id}`,
      "PATCH",
      () =>
        admin.page
          .getByRole("dialog")
          .getByRole("button", { name: "Restore account access", exact: true })
          .click(),
    );
    expect(restored.receipt.status).toBe("active");
    expect(restored.receipt.replayed).toBe(false);
    await retryAccess(admin, tutor.id, restored.input, restored.receipt);
    await expect(
      admin.page.getByText("Active access", { exact: true }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("heading", {
        name: "Account access history",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      admin.page.getByText("Active to suspended access", { exact: false }),
    ).toBeVisible();
    await expect(
      admin.page.getByText("Suspended to active access", { exact: false }),
    ).toBeVisible();
    expect(await accountSnapshot(tutor.id, profile.id)).toEqual(before);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM account_restriction_events WHERE target_user_id=$1",
          [tutor.id],
        )
      ).rows[0].n,
    ).toBe(2);
    expect(
      (
        await tutor.context.request.get("/api/bookings?scope=tutor&filter=all")
      ).status(),
    ).toBe(200);
    expect(
      (await parent.context.request.get(`/tutors/${profile.slug}`)).status(),
    ).toBe(200);
    expect(
      (await readBookings(admin, `?q=${parentBooking.receipt.id}`)).items[0]
        .state,
    ).toBe("confirmed");
    expect(
      (await readBookings(admin, `?q=${studentBooking.receipt.id}`)).items[0]
        .state,
    ).toBe("confirmed");
  });

  await test.step("foreign Admin and participant roles cannot cross exact staff grants or see meeting credentials", async () => {
    await tutor.page.goto(`/bookings/${studentBooking.receipt.id}?scope=tutor`);
    await tutor.page
      .getByLabel("Zoom or Google Meet link", { exact: true })
      .fill(meeting);
    await tutor.page
      .getByRole("button", { name: "Save meeting link", exact: true })
      .click();
    await expect(
      tutor.page
        .getByRole("status")
        .filter({ hasText: "Private meeting link saved." }),
    ).toBeVisible();
    expect(
      (await readBookings(admin, `?q=${studentBooking.receipt.id}`)).items,
    ).toHaveLength(1);
    expect(
      (
        await admin.context.request.get(
          `/api/bookings/${studentBooking.receipt.id}/meeting-link`,
        )
      ).status(),
    ).toBe(404);
    for (const actor of [other, parent, student, tutor]) {
      const list = await actor.context.request.get("/api/admin/bookings");
      expect(list.status()).toBe(actor === other ? 200 : 403);
      if (actor === other)
        expect(((await list.json()) as StaffBookings).items).toEqual([]);
      expect(
        (
          await actor.context.request.get(`/api/admin/accounts/${tutor.id}`)
        ).status(),
      ).toBe(actor === other ? 404 : 403);
      expect(
        (
          await actor.context.request.patch(`/api/admin/accounts/${tutor.id}`, {
            headers: { origin: h.packet.origin },
            data: {
              revision: 2,
              status: "suspended",
              reason: "local_access_test",
              requestKey: randomUUID(),
            },
          })
        ).status(),
      ).toBe(actor === other ? 404 : 403);
      await actor.page.goto(`/admin/bookings/${studentBooking.receipt.id}`);
      await expect(
        actor.page.getByText(/This booking task is unavailable/),
      ).toBeVisible();
      await expect(
        actor.page.getByText(learner.displayName, { exact: true }),
      ).toHaveCount(0);
      expect((await actor.page.content()).includes(meeting)).toBe(false);
    }
    expect((await readBookings(other)).items).toEqual([]);
    expect((await readAccounts(other)).targets).toEqual([]);
    expect(
      (await readBookings(admin, `?q=${ungranted.receipt.id}`)).items,
    ).toEqual([]);
    await admin.page.goto(`/admin/bookings/${ungranted.receipt.id}`);
    await expect(
      admin.page.getByText(/This booking task is unavailable/),
    ).toBeVisible();
    await admin.page.goto(`/admin/bookings/${studentBooking.receipt.id}`);
    expect((await admin.page.content()).includes(meeting)).toBe(false);
    await expect(
      admin.page.getByRole("link", { name: /Open meeting/ }),
    ).toHaveCount(0);
    expect(
      (
        await h.owner.pool.query(
          "SELECT count(*)::int n FROM account_restriction_events WHERE target_user_id=$1",
          [tutor.id],
        )
      ).rows[0].n,
    ).toBe(2);
  });

  await test.step("actual Admin sign-out removes entry, queue and protected record access", async () => {
    await admin.page.goto("/admin");
    const signedOut = admin.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/auth/sign-out",
    );
    await admin.page
      .getByRole("main")
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    expect((await signedOut).status()).toBe(200);
    await expect(admin.page).toHaveURL((url) => url.pathname === "/sign-in");
    for (const [path, next] of [
      ["/admin", "/admin"],
      ["/admin/accounts", "/admin/accounts"],
      ["/admin/bookings", "/admin/bookings?state=all&page=1&pageSize=20"],
      [`/admin/accounts/${tutor.id}`, `/admin/accounts/${tutor.id}`],
      [
        `/admin/bookings/${studentBooking.receipt.id}`,
        `/admin/bookings/${studentBooking.receipt.id}`,
      ],
    ]) {
      await admin.page.goto(path);
      await expect(admin.page).toHaveURL(
        (url) =>
          url.pathname === "/sign-in" && url.searchParams.get("next") === next,
      );
      await expect(
        admin.page.getByRole("heading", { name: "Sign in", exact: true }),
      ).toBeVisible();
      await expect(
        admin.page.getByText(learner.displayName, { exact: true }),
      ).toHaveCount(0);
      expect((await admin.page.content()).includes(meeting)).toBe(false);
    }
    expect(
      (await admin.context.request.get("/api/admin/bookings")).status(),
    ).toBe(401);
    expect(
      (
        await admin.context.request.get(`/api/admin/accounts/${tutor.id}`)
      ).status(),
    ).toBe(401);
  });
});
