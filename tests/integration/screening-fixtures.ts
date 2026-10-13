import { randomUUID } from "node:crypto";
import {
  saveOwnTutorProfile,
  readOwnTutorProfile,
} from "@/features/tutors/service";
import {
  validateScreeningCapability,
  screeningActions,
} from "@/features/tutor-screening/policy";
import {
  provisionScreeningPolicy,
  selectScreeningPolicy,
  provisionScreeningAssignment,
} from "@/features/tutor-screening/fixture-tooling";
import {
  requestScreening,
  type ScreeningContext,
} from "@/features/tutor-screening/service";
import {
  validateSafeguardingCapability,
  responseActions,
} from "@/features/safeguarding/policy";
import {
  provisionResponseStaff,
  provisionResponsePolicy,
} from "@/features/safeguarding/fixture-tooling";
import type { SafeguardingContext } from "@/features/safeguarding/service";
import { createAccount, type World, type TestAccount } from "./support";
export async function screeningFixture(
  world: World,
  reviewer: TestAccount,
  enrolled = true,
) {
  const suffix = randomUUID(),
    now = Date.now(),
    policy = validateScreeningCapability(
      {
        mode: "synthetic_test",
        provenance: "synthetic_readiness",
        version: "synthetic-" + suffix,
        reference: `policy:${randomUUID()}`,
        authorityReference: `synthetic:${randomUUID()}`,
        validFrom: new Date(now - 60000).toISOString(),
        validUntil: new Date(now + 7200000).toISOString(),
        requiredCheckCodes: ["synthetic_check_a", "synthetic_check_b"],
        allowedActions: [...screeningActions],
        expiryRule: "all_checks_current",
      },
      "test",
    );
  const context: ScreeningContext = {
    runtime: world.runtime,
    screening: policy,
  };
  await provisionScreeningPolicy(world.owner, policy);
  if (policy.mode === "disabled") throw new Error();
  await selectScreeningPolicy(world.owner, policy.version);
  const tutor = await createAccount(
    world,
    ["tutor"],
    "Fictional screening tutor",
  );
  const subject = (
    await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  await saveOwnTutorProfile(world.runtime, tutor.headers, {
    headline: "Fictional math tutor",
    bio: "Fictional software acceptance introduction.",
    teachingBackground: "Fictional software acceptance background.",
    timezone: "Asia/Manila",
    offerings: [
      { subjectId: subject, levels: ["college_support", "high_school"] },
    ],
  });
  const profile = await readOwnTutorProfile(world.runtime, tutor.headers);
  if (!profile) throw new Error();
  if (enrolled)
    await requestScreening(context, tutor.headers, profile.id, {
      requestKey: randomUUID(),
    });
  if (enrolled)
    await provisionScreeningAssignment(
      world.owner,
      profile.id,
      reviewer.id,
      "synthetic_readiness",
      new Date(now + 7200000),
    );
  return { context, tutor, profile, policy };
}
export async function responseFixture(
  world: World,
  reviewer: TestAccount,
  escalation: TestAccount,
) {
  const now = Date.now(),
    expiry = new Date(now + 7200000);
  for (const staff of [reviewer, escalation])
    await provisionResponseStaff(world.owner, staff.id, expiry);
  const policy = validateSafeguardingCapability(
    {
      mode: "synthetic_test",
      provenance: "synthetic_readiness",
      version: "synthetic-" + randomUUID(),
      reference: `policy:${randomUUID()}`,
      validFrom: new Date(now - 60000).toISOString(),
      validUntil: expiry.toISOString(),
      responsibleOwnerId: reviewer.id,
      escalationOwnerId: escalation.id,
      reportingGuidanceReference: `synthetic:${randomUUID()}`,
      meetingGuidanceReference: `synthetic:${randomUUID()}`,
      allowedActions: [...responseActions],
      reasonCodes: ["synthetic_safety_restrict", "synthetic_safety_restore"],
    },
    "test",
  );
  await provisionResponsePolicy(world.owner, policy);
  const context: SafeguardingContext = {
    runtime: world.runtime,
    safeguarding: policy,
  };
  return { context, policy, expiry };
}
export async function observedLock(world: World, fragment: string) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const r = await world.owner.pool.query(
      "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE $1",
      ["%" + fragment + "%"],
    );
    if (r.rows[0].n > 0) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error("Required actual database lock wait was not observed.");
}
