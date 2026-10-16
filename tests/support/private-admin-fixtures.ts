import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { parsePrivateWorkflow } from "@/features/private-workflow/config";
import { workflowFixture } from "./booking-workflows-fixtures";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
} from "../integration/support";

type Heads = {
  admission: { current_policy_id: string; enabled: boolean } | null;
  booking: { policy_id: string; enabled: boolean } | null;
  screening: { version: string; status: string } | null;
};

/** Actual reviewed fictional records; retain every row and restore only owned heads. */
export async function privateAdminFixture() {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  const world = openWorld();
  const previous = (
    await world.owner.pool.query<Heads>(`SELECT
    (SELECT jsonb_build_object('current_policy_id',current_policy_id,'enabled',enabled) FROM learner_admission_policy_state WHERE source='synthetic_readiness' AND market_code='synthetic_test') admission,
    (SELECT jsonb_build_object('policy_id',policy_id,'enabled',enabled) FROM booking_workflow_policy_head WHERE source='synthetic_readiness') booking,
    (SELECT jsonb_build_object('version',version,'status',status) FROM tutor_screening_policy_heads WHERE provenance='synthetic_readiness') screening`)
  ).rows[0];
  const reviewer = await createAccount(
    world,
    ["admin"],
    "Fictional assigned staff",
  );
  const unassigned = await createAccount(
    world,
    ["admin"],
    "Fictional unassigned staff",
  );
  const fixture = await workflowFixture(world, reviewer, "guardian", "tutor");
  const configured = localDatabaseConfig(process.env.DATABASE_URL, true);
  if (configured.host !== "127.0.0.1")
    throw new Error("Use the owned loopback test database.");
  const database = {
    mode: "local-test",
    host: configured.host,
    port: configured.port,
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
      origin: world.runtime.origin,
      database,
      accountEmails: [
        reviewer,
        unassigned,
        fixture.requester,
        fixture.tutor,
      ].map((actor) => actor.email),
      admission: fixture.admission,
      screening: fixture.policy,
      booking: fixture.booking,
    },
    { origin: world.runtime.origin, database },
  );
  mkdirSync(path.join(process.cwd(), ".local"), {
    recursive: true,
    mode: 0o700,
  });
  const directory = mkdtempSync(
    path.join(process.cwd(), ".local/private-admin-read-"),
  );
  const file = path.join(directory, `${randomUUID()}.json`);
  function activate(accounts: readonly TestAccount[] = []) {
    writeFileSync(
      file,
      JSON.stringify({
        ...packet,
        accountEmails: [
          ...new Set([
            ...packet.accountEmails,
            ...accounts.map((actor) => actor.email),
          ]),
        ],
      }),
      { mode: 0o600 },
    );
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
  }
  const disable = () => vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  async function close() {
    disable();
    try {
      await world.owner.pool.query(
        "UPDATE booking_workflow_policy_head SET policy_id=$1,enabled=$2 WHERE source='synthetic_readiness' AND policy_id=$3",
        [
          previous.booking?.policy_id ?? fixture.booking.policyId,
          previous.booking?.enabled ?? false,
          fixture.booking.policyId,
        ],
      );
      await world.owner.pool.query(
        "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness' AND version=$3",
        [
          previous.screening?.version ?? fixture.policy.version,
          previous.screening?.status ?? "revoked",
          fixture.policy.version,
        ],
      );
      await world.owner.pool.query(
        "UPDATE learner_admission_policy_state SET current_policy_id=$1,enabled=$2,revision=revision+1,updated_at=clock_timestamp() WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND current_policy_id=$3",
        [
          previous.admission?.current_policy_id ?? fixture.admission.policyId,
          previous.admission?.enabled ?? false,
          fixture.admission.policyId,
        ],
      );
    } finally {
      await closeWorld(world);
      rmSync(directory, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  }
  return {
    world,
    reviewer,
    unassigned,
    fixture,
    packet,
    file,
    activate,
    disable,
    close,
  };
}
