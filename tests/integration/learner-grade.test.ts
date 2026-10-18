import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createMyLearner,
  listMyLearners,
  readMyLearner,
  updateMyLearner,
} from "@/features/learners/service";
import {
  createAdmission,
  readMyAdmission,
  readAssignedAdmission,
  readAdmittedLearner,
  updateAdmittedLearner,
  mutateAdmissionReview,
  type AdmissionContext,
} from "@/features/learner-admission/service";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import {
  openWorld,
  closeWorld,
  createAccount,
  type TestAccount,
  type World,
} from "./support";

let world: World,
  context: AdmissionContext,
  parent: TestAccount,
  other: TestAccount,
  reviewer: TestAccount;
const fields = {
  displayName: "Fictional Grade Eight learner",
  level: "middle_school",
  timezone: "Asia/Manila",
};
const localInput = (extra = {}) => ({
  ...fields,
  management: "guardian",
  requestId: randomUUID(),
  ...extra,
});
const admissionInput = (extra = {}) => ({
  ...localInput(),
  policyVersion:
    context.admission.authority === "synthetic_test"
      ? context.admission.version
      : "",
  policyDigest:
    context.admission.authority === "synthetic_test"
      ? context.admission.contentDigest
      : "",
  ...extra,
});
async function sessionId(actor: TestAccount) {
  const session = await world.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!session) throw new Error("Expected the synthetic test session.");
  return session.session.id;
}
async function authorize(id: string) {
  await assignAdmissionReviewer(world.owner.pool, id, reviewer.id);
  for (const checkCode of ["guardian_authority", "guardian_notice"]) {
    const current = await readAssignedAdmission(context, reviewer.headers, id);
    await mutateAdmissionReview(context, reviewer.headers, id, "evidence", {
      requestId: randomUUID(),
      revision: current.revision,
      checkCode,
      reference: `synthetic:${randomUUID()}`,
    });
  }
  const current = await readAssignedAdmission(context, reviewer.headers, id);
  return mutateAdmissionReview(context, reviewer.headers, id, "decision", {
    requestId: randomUUID(),
    revision: current.revision,
    action: "authorize",
  });
}
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  reviewer = await createAccount(world, ["admin"]);
  context = {
    runtime: world.runtime,
    admission: await provisionAdmissionPolicy(world.owner.pool),
  };
}, 30000);
afterAll(() => closeWorld(world));

describe("school grade on owned local fictional learners", () => {
  it("persists Grade 8 independently of level and supports edit, omission and clear", async () => {
    const profile = await createMyLearner(
      world.runtime,
      parent.headers,
      localInput({ grade: 8, level: "elementary" }),
    );
    expect(profile).toMatchObject({ grade: 8, level: "elementary" });
    expect(
      (await listMyLearners(world.runtime, parent.headers)).find(
        (p) => p.id === profile.id,
      )?.grade,
    ).toBe(8);
    await updateMyLearner(world.runtime, parent.headers, profile.id, {
      ...fields,
      grade: 9,
    });
    await updateMyLearner(world.runtime, parent.headers, profile.id, {
      ...fields,
      displayName: "Fictional renamed child",
    });
    expect(
      (await readMyLearner(world.runtime, parent.headers, profile.id)).grade,
    ).toBe(9);
    await expect(
      updateMyLearner(world.runtime, parent.headers, profile.id, {
        ...fields,
        level: "college_support",
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(
      (await readMyLearner(world.runtime, parent.headers, profile.id)).grade,
    ).toBe(9);
    await updateMyLearner(world.runtime, parent.headers, profile.id, {
      ...fields,
      grade: null,
    });
    expect(
      (await readMyLearner(world.runtime, parent.headers, profile.id)).grade,
    ).toBeNull();
    expect(
      (
        await world.owner.pool.query(
          "SELECT grade FROM learner_profiles WHERE id=$1",
          [profile.id],
        )
      ).rows,
    ).toEqual([{ grade: null }]);
  });
  it.each([1, 12])(
    "stores boundary grade %i without broad-level inference",
    async (grade) => {
      const profile = await createMyLearner(
        world.runtime,
        parent.headers,
        localInput({ grade, level: "high_school" }),
      );
      expect(profile).toMatchObject({ grade, level: "high_school" });
    },
  );
  it("rejects invalid input and College/self grades before partial creation", async () => {
    const actor = await createAccount(world, ["parent", "student"]);
    for (const extra of [
      { grade: 0 },
      { grade: 13 },
      { grade: 8.5 },
      { grade: "8" },
      { grade: 8, level: "college_support" },
      { grade: 8, management: "self", level: "college_support" },
    ])
      await expect(
        createMyLearner(world.runtime, actor.headers, localInput(extra)),
      ).rejects.toMatchObject({ name: "ZodError" });
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM learner_creation_events WHERE actor_user_id=$1",
          [actor.id],
        )
      ).rows[0].n,
    ).toBe(0);
    const independent = await createMyLearner(
      world.runtime,
      actor.headers,
      localInput({ management: "self", level: "college_support", grade: null }),
    );
    expect(independent.grade).toBeNull();
  });
  it("replays concurrent Grade 8 requests once, conflicts on changed grade and permits distinct siblings", async () => {
    const input = localInput({ grade: 8 });
    const profiles = await Promise.all(
      Array.from({ length: 3 }, () =>
        createMyLearner(world.runtime, parent.headers, input),
      ),
    );
    expect(new Set(profiles.map((p) => p.id)).size).toBe(1);
    expect(profiles.every((p) => p.grade === 8)).toBe(true);
    await expect(
      createMyLearner(world.runtime, parent.headers, { ...input, grade: 9 }),
    ).rejects.toMatchObject({ status: 409 });
    const sibling = await createMyLearner(world.runtime, parent.headers, {
      ...input,
      requestId: randomUUID(),
    });
    expect(sibling.id).not.toBe(profiles[0].id);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM learner_creation_events WHERE actor_user_id=$1 AND request_id=$2",
          [parent.id, input.requestId],
        )
      ).rows[0].n,
    ).toBe(1);
    await updateMyLearner(world.runtime, parent.headers, profiles[0].id, {
      ...fields,
      grade: 9,
    });
    expect(
      (await createMyLearner(world.runtime, parent.headers, input)).grade,
    ).toBe(9);
  });
  it("preserves legacy null-grade receipt fingerprints in both directions", async () => {
    const actorSession = await sessionId(parent);
    for (const oldFirst of [true, false]) {
      const input = localInput();
      const old = () =>
        world.runtime.pool.query(
          "SELECT * FROM public.create_local_learner($1,$2,$3,$4,$5,$6,$7)",
          [
            parent.id,
            actorSession,
            input.requestId,
            input.management,
            input.displayName,
            input.level,
            input.timezone,
          ],
        );
      if (oldFirst) expect((await old()).rows[0].outcome).toBe("created");
      const profile = await createMyLearner(
        world.runtime,
        parent.headers,
        input,
      );
      expect(profile.grade).toBeNull();
      const replay = (await old()).rows[0];
      expect(replay).toMatchObject({
        outcome: "replayed",
        learner_id: profile.id,
      });
    }
  });
  it("denies foreign/revoked grade edits and rejects invalid direct grade writes", async () => {
    const profile = await createMyLearner(
      world.runtime,
      parent.headers,
      localInput({ grade: 8 }),
    );
    await expect(
      updateMyLearner(world.runtime, other.headers, profile.id, {
        ...fields,
        grade: 9,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
      [profile.id],
    );
    await expect(
      updateMyLearner(world.runtime, parent.headers, profile.id, {
        ...fields,
        grade: 9,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT grade FROM learner_profiles WHERE id=$1",
          [profile.id],
        )
      ).rows[0].grade,
    ).toBe(8);
    for (const grade of [0, 13])
      await expect(
        world.owner.pool.query(
          "UPDATE learner_profiles SET grade=$2 WHERE id=$1",
          [profile.id, grade],
        ),
      ).rejects.toMatchObject({ code: "23514" });
  });
});

describe("grade metadata preserves reviewed guardian admission authority", () => {
  it("saves a private pending Grade 8 request without granting learner access", async () => {
    const request = await createAdmission(
      context,
      parent.headers,
      admissionInput({ grade: 8 }),
    );
    expect(request).toMatchObject({
      state: "pending",
      currentAccess: false,
      learner: { grade: 8, level: "middle_school" },
    });
    expect(
      (await readMyAdmission(context, parent.headers, request.id)).learner
        .grade,
    ).toBe(8);
    await expect(
      readMyAdmission(context, other.headers, request.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readAdmittedLearner(context, parent.headers, request.learner.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM guardian_learner_links WHERE learner_id=$1",
          [request.learner.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("allows authorized grade edits, preserves legacy updates and rejects level/raw/foreign/revoked edits", async () => {
    const request = await createAdmission(
      context,
      parent.headers,
      admissionInput({ grade: 8 }),
    );
    await authorize(request.id);
    const edit = { displayName: fields.displayName, timezone: "UTC" };
    expect(
      (await readAssignedAdmission(context, reviewer.headers, request.id))
        .learner.grade,
    ).toBe(8);
    await expect(
      updateAdmittedLearner(context, other.headers, request.learner.id, {
        ...edit,
        grade: 9,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await updateAdmittedLearner(context, parent.headers, request.learner.id, {
      ...edit,
      grade: 9,
    });
    await updateAdmittedLearner(
      context,
      parent.headers,
      request.learner.id,
      edit,
    );
    expect(
      (await readAdmittedLearner(context, parent.headers, request.learner.id))
        .grade,
    ).toBe(9);
    await expect(
      updateAdmittedLearner(context, parent.headers, request.learner.id, {
        ...edit,
        grade: 9,
        level: "high_school",
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      world.runtime.pool.query(
        "UPDATE learner_profiles SET grade=10 WHERE id=$1",
        [request.learner.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await updateAdmittedLearner(context, parent.headers, request.learner.id, {
      ...edit,
      grade: null,
    });
    expect(
      (await readAdmittedLearner(context, parent.headers, request.learner.id))
        .grade,
    ).toBeNull();
    const current = await readAssignedAdmission(
      context,
      reviewer.headers,
      request.id,
    );
    await mutateAdmissionReview(
      context,
      reviewer.headers,
      request.id,
      "decision",
      { requestId: randomUUID(), revision: current.revision, action: "revoke" },
    );
    await expect(
      updateAdmittedLearner(context, parent.headers, request.learner.id, {
        ...edit,
        grade: 8,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT grade FROM learner_profiles WHERE id=$1",
          [request.learner.id],
        )
      ).rows[0].grade,
    ).toBeNull();
  });
  it("replays concurrent grade requests once and conflicts when grade changes", async () => {
    const input = admissionInput({ grade: 8 });
    const requests = await Promise.all(
      Array.from({ length: 3 }, () =>
        createAdmission(context, parent.headers, input),
      ),
    );
    expect(new Set(requests.map((r) => r.id)).size).toBe(1);
    await expect(
      createAdmission(context, parent.headers, { ...input, grade: 9 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM learner_admissions WHERE requester_user_id=$1 AND request_id=$2",
          [parent.id, input.requestId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("preserves old null-grade admission request hashes in both directions", async () => {
    if (context.admission.authority !== "synthetic_test")
      throw new Error("Synthetic policy required.");
    const actorSession = await sessionId(parent);
    for (const oldFirst of [true, false]) {
      const input = admissionInput();
      const old = () =>
        world.runtime.pool.query(
          "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            parent.id,
            actorSession,
            input.requestId,
            context.admission.authority === "synthetic_test"
              ? context.admission.policyId
              : "",
            input.management,
            input.displayName,
            input.level,
            input.timezone,
            null,
          ],
        );
      if (oldFirst) expect((await old()).rows[0].outcome).toBe("created");
      const request = await createAdmission(context, parent.headers, input);
      expect(request.learner.grade).toBeNull();
      expect((await old()).rows[0]).toMatchObject({
        outcome: "replayed",
        admission_id: request.id,
      });
    }
  });
  it("retains SECURITY DEFINER, fixed search_path, restricted owner and non-PUBLIC execution for all entry points", async () => {
    const names = [
      "create_local_learner",
      "create_local_learner_with_grade",
      "create_learner_admission",
      "create_learner_admission_with_grade",
      "update_admitted_learner",
      "update_admitted_learner_with_grade",
    ];
    const functions = (
      await world.owner.pool.query(
        "SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) AS owner,has_function_privilege('learli_app',oid,'EXECUTE') AS app,coalesce(array_to_string(proacl,','),'') AS acl FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[])",
        [names],
      )
    ).rows;
    expect(functions).toHaveLength(names.length);
    for (const fn of functions) {
      expect(fn).toMatchObject({
        prosecdef: true,
        proconfig: ["search_path=pg_catalog"],
        app: true,
      });
      expect(fn.owner).not.toBe("learli_app");
      expect(fn.acl).not.toMatch(/(^|,)=X/);
    }
  });
});
