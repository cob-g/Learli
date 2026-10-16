import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDatabase } from "../../src/lib/db/connection";
import { localDatabaseConfig } from "../../src/lib/db/local-config";
import { assertOwnedReadinessDatabase } from "./readiness-placement";
import { syntheticAdmissionPolicy } from "./learner-admission-fixtures";
import { bookingPolicyDigest } from "../../src/features/booking-workflows/policy";
import { parsePrivateWorkflow } from "../../src/features/private-workflow/config";

export default async function setup() {
  assertOwnedReadinessDatabase(process.cwd());
  const database = localDatabaseConfig(process.env.DATABASE_URL, true);
  const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  try {
    // The admission receipt is immutable and unique by this exact QA version.
    const existing = await owner.pool.query<{ id: string }>(
      "SELECT id FROM learner_admission_policies WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND version='synthetic-admission-v1'",
    );
    const admission = syntheticAdmissionPolicy(
      existing.rows[0]?.id ?? randomUUID(),
    );
    const terms = {
      authority: "synthetic_test",
      source: "synthetic_readiness",
      version: "synthetic-booking-v2",
      reference: "synthetic:booking:v2",
      admissionPolicyId: admission.policyId,
      durationMinutes: 60,
      stepMinutes: 30,
      noticeMinutes: 60,
      horizonDays: 14,
      provisionalMinutes: 10,
      cancelCutoffMinutes: 60,
      moveCutoffMinutes: 60,
      confirmationPrerequisite: "synthetic_prerequisite_review",
      confirmationActor: "assigned_mfa_admin",
      outcomeActor: "assigned_mfa_admin",
      disputePath: "/support",
      meetingAccess: "confirmed_until_end",
      completionActor: "assigned_tutor",
    } as const;
    const run = randomUUID();
    const target = {
      mode: "local-test",
      host: database.host as "127.0.0.1",
      port: database.port,
      database: "learli_test",
      runtimeRole: "learli_app",
    } as const;
    const packet = parsePrivateWorkflow(
      {
        version: 1,
        purpose: "private_fictional_workflow",
        audience: "fictional_only",
        realIntake: "disabled",
        payments: "disabled",
        origin: process.env.APP_URL,
        accountEmails: [
          "admin",
          "parent",
          "parent-other",
          "tutor",
          "tutor-other",
          "college-admin",
          "college-a",
          "college-b",
          "college-tutor",
          "ops-admin",
          "ops-other",
          "ops-parent",
          "ops-student",
          "ops-tutor",
          "security-a",
          "security-b",
        ].map((role) => `${role}-${run}@learli.test`),
        database: target,
        admission,
        screening: {
          mode: "synthetic_test",
          provenance: "synthetic_readiness",
          version: `private-${run}`,
          reference: `policy:${randomUUID()}`,
          authorityReference: `synthetic:${randomUUID()}`,
          validFrom: new Date(Date.now() - 60_000).toISOString(),
          validUntil: new Date(Date.now() + 86_400_000).toISOString(),
          requiredCheckCodes: ["fictional_identity", "fictional_safeguarding"],
          allowedActions: [
            "approve",
            "reject",
            "suspend",
            "reinstate",
            "reopen",
            "revoke",
          ],
          expiryRule: "all_checks_current",
        },
        booking: {
          ...terms,
          policyId: randomUUID(),
          contentDigest: bookingPolicyDigest(terms),
        },
      },
      { origin: process.env.APP_URL!, database: target },
    );
    const file = process.env.PRIVATE_WORKFLOW_CONFIG_FILE!;
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    if (existsSync(file)) renameSync(file, `${file}.${Date.now()}.previous`);
    writeFileSync(file, JSON.stringify(packet), { mode: 0o600, flag: "wx" });
  } finally {
    await owner.pool.end();
  }
}
