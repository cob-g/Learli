import { randomUUID, randomBytes } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  settings: undefined as
    ((role: "learli_app" | "learli_migrator") => PoolConfig) | undefined,
}));
// Accepted test-only TLS placement boundary; both production parsers still run.
vi.mock("@/lib/db/staging-config", async (original) => {
  const real = await original<typeof import("@/lib/db/staging-config")>();
  return {
    ...real,
    stagingPoolConfig: (
      config: import("@/lib/db/staging-config").StagingDatabaseConfig,
    ) => {
      real.stagingPoolConfig(config);
      if (!fixture.settings) throw new Error("Own TLS settings unavailable.");
      return fixture.settings("learli_app");
    },
  };
});
import { createDatabase } from "@/lib/db/connection";
import { createLocalAuth } from "@/lib/auth-factory";
import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import { drainHostedTransactionalDelivery } from "@/features/transactional-delivery/operator";
import {
  createPolicyReservation,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import { createStagingTlsHarness } from "../support/staging-tls";
import {
  hostedTestPacket,
  hostedTestSource,
} from "../support/hosted-auth-packet";
import { workflowFixture } from "../support/booking-workflows-fixtures";
import { createAccount, closeWorld, type World } from "./support";
let harness: Awaited<ReturnType<typeof createStagingTlsHarness>>;
let owner: Pool;
let world: World | undefined;
const ownerSecret = randomBytes(32).toString("hex");
beforeAll(async () => {
  harness = await createStagingTlsHarness();
  fixture.settings = harness.settings;
  // Existing owner-only fixture guards require exactly learli_owner/learli_test.
  // Provision that exact fresh local identity; do not substitute or weaken them.
  await harness.asAdmin(async (admin) => {
    await admin.query(
      `CREATE ROLE learli_owner LOGIN PASSWORD '${ownerSecret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await admin.query("CREATE DATABASE learli_test OWNER learli_owner");
  });
  const url = (role: "learli_app" | "learli_owner") =>
    `postgresql://${role}:${role === "learli_owner" ? ownerSecret : harness.settings("learli_app").password}@127.0.0.1:${harness.port}/learli_test`;
  const database = createDatabase(url("learli_owner"), true);
  await migrate(database.db, { migrationsFolder: "drizzle" });
  await database.pool.query(runtimeGrantsSql);
  const inspector = await database.pool.connect();
  try {
    await verifyRuntimeGrants(inspector);
  } finally {
    inspector.release();
  }
  world = {
    owner: database,
    runtime: createLocalAuth({
      APP_ENV: "test",
      AUTH_MODE: "local",
      APP_URL: "http://127.0.0.1:3194",
      BETTER_AUTH_URL: "http://127.0.0.1:3194",
      BETTER_AUTH_SECRET: randomUUID().repeat(2),
      DATABASE_URL: url("learli_app"),
    }),
  };
}, 90000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await closeWorld(world);
  await owner?.end();
  harness?.stop();
});
it("enabled independent operator drains a real committed event through guarded TLS Database leases and actual SDK after commit", async () => {
  if (!world) throw new Error("Own fixture unavailable.");
  const reviewer = await createAccount(world, ["admin"]),
    f = await workflowFixture(world, reviewer);
  const slots = await readWorkflowCandidates(
      f.context,
      f.requester.headers,
      f.choice,
    ),
    slot = slots[6];
  expect(slot).toBeDefined();
  const saved = await createPolicyReservation(f.context, f.requester.headers, {
    ...f.choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  });
  await closeWorld(world);
  world = undefined;
  // Close all local fixture sessions before one test-only database rename. The
  // initially empty staging database is preserved, not dropped or overwritten.
  // Guarded runtime then validates the actual renamed database and real TLS.
  await harness.asAdmin(async (admin) => {
    await admin.query(
      "ALTER DATABASE learli_staging RENAME TO w4_empty_reserved",
    );
    await admin.query("ALTER DATABASE learli_test RENAME TO learli_staging");
    await admin.query(
      "REVOKE ALL ON DATABASE learli_staging FROM PUBLIC; GRANT CONNECT ON DATABASE learli_staging TO learli_app",
    );
  });
  owner = new Pool({
    ...harness.settings("learli_migrator"),
    user: "learli_owner",
    password: ownerSecret,
  });
  const accountEmails = [f.requester.email, f.tutor.email],
    packet = hostedTestPacket();
  if (packet.mail.mode !== "resend-single-attempt")
    throw new Error("Owned enabled mail packet required.");
  const config = parseHostedAuthConfig(hostedTestSource(), {
    ...packet,
    accountEmails,
    mail: {
      ...packet.mail,
      transport: { ...packet.mail.transport, allowedRecipients: accountEmails },
    },
  });
  const requests: { key: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, options: RequestInit) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      expect(options.method).toBe("POST");
      expect(typeof options.body).toBe("string");
      const key = new Headers(options.headers).get("Idempotency-Key");
      expect(key).toMatch(/^learli\/[a-f0-9]{64}$/);
      const body = String(options.body);
      expect(body).not.toContain(f.learner.displayName);
      expect(body).not.toMatch(/zoom\.us|meet\.google/);
      const observer = await owner.connect();
      try {
        await observer.query("BEGIN");
        const claim = await observer.query(
          "SELECT state,first_attempt_at,attempts FROM transactional_deliveries WHERE event_id=$1 AND idempotency_key=$2 FOR UPDATE NOWAIT",
          [saved.eventId, key],
        );
        expect(claim.rows).toHaveLength(1);
        expect(claim.rows[0]).toMatchObject({ state: "claimed", attempts: 1 });
        expect(claim.rows[0].first_attempt_at).toBeTruthy();
      } finally {
        await observer.query("ROLLBACK");
        observer.release();
      }
      requests.push({ key: key!, body });
      return Response.json({ id: randomUUID() });
    },
  );
  const result = await drainHostedTransactionalDelivery(config, {
    eventId: saved.eventId,
  });
  expect(result.status).toBe("completed");
  if (result.status !== "completed")
    throw new Error("Enabled operator refused.");
  expect(result.counts.providerAccepted).toBe(2);
  expect(result.counts.unavailable).toBe(0);
  expect(requests).toHaveLength(2);
  expect(
    (await owner.query("SELECT state FROM bookings WHERE id=$1", [saved.id]))
      .rows[0].state,
  ).toBe("provisional");
  const again = await drainHostedTransactionalDelivery(config, {
    eventId: saved.eventId,
  });
  expect(again.status === "completed" && again.counts.providerAccepted).toBe(0);
  expect(requests).toHaveLength(2);
}, 60000);
