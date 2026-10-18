import { mkdirSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import {
  applyPlan,
  inspectTarget,
  planHash,
} from "../../scripts/staging-migrations/runner";
import {
  createNeonDevelopmentAuth,
  loadNeonDevelopmentConfig,
} from "@/lib/db/neon-development";
import { handleAuthRequest } from "@/lib/auth-handler";
import { requireIdentity } from "@/lib/permissions/access";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";
import { createMyLearner, readMyLearner } from "@/features/learners/service";
import { loadDemoBookingOptions } from "@/features/bookings/service";
import type { AuthRuntime } from "@/lib/auth-factory";
import { readPublicCatalog } from "@/features/tutors/public";
import { Client, type PoolConfig } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyNativeTls } from "@/lib/db/native-tls";
import {
  neonOperationConfig,
  type NeonOperationConfig,
} from "@/lib/db/neon-operation-config";
import { openVerifiedOperationConnection } from "@/lib/db/staging-connection";
import {
  createNeonDevelopmentDatabase,
  createHostedRuntimeDatabase,
} from "@/lib/db/hosted-runtime";
import {
  createStagingTlsHarness,
  type StagingTlsHarness,
} from "../support/staging-tls";
import { createPostgresTlsProxy } from "../support/postgres-tls-proxy";
import { operationTarget } from "../support/neon-operation-target";

vi.mock("server-only", () => ({}));
const selected = vi.hoisted(() => ({
  runtime: undefined as AuthRuntime | undefined,
}));
vi.mock("@/lib/auth", () => ({
  getAuthRuntime: () => selected.runtime ?? null,
  getDomainAuthRuntime: async () => selected.runtime ?? null,
}));
const injected = vi.hoisted(() => ({
  settings: undefined as
    ((config: NeonOperationConfig) => PoolConfig) | undefined,
}));
vi.mock("@/lib/db/neon-operation-config", async (original) => {
  const actual =
    await original<typeof import("@/lib/db/neon-operation-config")>();
  return {
    ...actual,
    neonOperationPoolConfig: (config: NeonOperationConfig) => {
      actual.neonOperationPoolConfig(config);
      if (!injected.settings) throw new Error("Owned fixture unavailable");
      return injected.settings(config);
    },
  };
});
let harness: StagingTlsHarness;
let proxy: Awaited<ReturnType<typeof createPostgresTlsProxy>>;
const config = (
  environment: "development" | "production" = "development",
  purpose: "runtime" | "inspect-runtime" | "inspect" = "runtime",
) => {
  const role = purpose === "inspect" ? "learli_migrator" : "learli_app";
  return neonOperationConfig({
    appEnv: environment,
    purpose,
    target: { ...operationTarget(environment), database: "learli_staging" },
    url: `postgresql://${role}:fictional-placeholder@ep-fictional.ap-southeast-1.aws.neon.tech/learli_staging?sslmode=verify-full`,
  });
};
function developmentConfiguration() {
  const directory = path.join(
    process.cwd(),
    ".local",
    "neon-activation",
    "tls-dev-runtime",
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "runtime.json");
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      purpose: "local-neon-development",
      realWorkflows: "disabled",
      databaseUrl:
        "postgresql://learli_app:fictional-placeholder@ep-fictional.ap-southeast-1.aws.neon.tech/learli_staging?sslmode=verify-full",
      target: { ...operationTarget(), database: "learli_staging" },
    }),
    { mode: 0o600 },
  );
  return loadNeonDevelopmentConfig({
    APP_ENV: "development",
    AUTH_MODE: "local",
    DATABASE_MODE: "neon-development",
    APP_URL: "http://127.0.0.1:3039",
    BETTER_AUTH_URL: "http://127.0.0.1:3039",
    BETTER_AUTH_SECRET: "fictional-development-secret-longer-than-32",
    NEON_DEVELOPMENT_CONFIG_FILE: file,
  });
}
beforeAll(async () => {
  harness = await createStagingTlsHarness();
  proxy = await createPostgresTlsProxy(harness);
  injected.settings = (value) => ({
    ...harness.settings(
      value.role === "learli_app" ? "learli_app" : "learli_migrator",
    ),
    port: proxy.port,
  });
  const owner = await openVerifiedOperationConnection(
    config("development", "inspect"),
  );
  const runtime = await openVerifiedOperationConnection(config());
  const candidate = loadCandidate(process.cwd());
  const identity = {
    database: "learli_staging",
    migrationRole: "learli_migrator",
    targetHash: "a".repeat(64),
    environment: "development" as const,
  };
  const plan = await inspectTarget(owner, candidate, identity);
  const receipt = await applyPlan({
    owner,
    runtime,
    candidate,
    identity,
    plan,
    expectedPlanHash: planHash(plan),
    recheckCandidate: () => loadCandidate(process.cwd()),
  });
  mkdirSync(path.join(process.cwd(), ".local/neon-activation"), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(
    path.join(process.cwd(), ".local/neon-activation/proxy-apply-receipt.json"),
    JSON.stringify(receipt),
    { mode: 0o600 },
  );
  expect(receipt.status, JSON.stringify(receipt)).toBe("PASS");
}, 120000);
afterAll(async () => {
  await proxy?.close();
  harness?.stop();
});

describe("genuine native TLS across a Neon-shaped proxy", () => {
  it("admits encrypted authorized client while actual backend reports ssl=false", async () => {
    const connection = await openVerifiedOperationConnection(
      config("production", "inspect-runtime"),
    );
    try {
      await connection.withClient(async (client) => {
        const row = (
          await client.query(
            "SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
          )
        ).rows[0];
        expect(row.ssl).toBe(false);
        verifyNativeTls(client, {
          ...harness.settings("learli_app"),
          port: proxy.port,
        });
      });
    } finally {
      await connection.close();
    }
  });
  it("rechecks reused actual dev leases and denies changed current role before SQL", async () => {
    const runtime = createNeonDevelopmentDatabase(config());
    try {
      const first = await runtime.pool.connect();
      const pid = (
        await first.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0].pid;
      first.release();
      await expect.poll(() => runtime.pool.idleCount).toBe(1);
      const second = await runtime.pool.connect();
      expect(
        (await second.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid,
      ).toBe(pid);
      second.release();
      await expect.poll(() => runtime.pool.idleCount).toBe(1);
      await harness.asAdmin((pool) =>
        pool.query("ALTER ROLE learli_app CREATEDB"),
      );
      await expect(
        runtime.pool.query("SELECT 'must_not_run' AS sentinel"),
      ).rejects.toMatchObject({ code: "runtime_privilege" });
      await harness.asAdmin((pool) =>
        pool.query("ALTER ROLE learli_app NOCREATEDB"),
      );
    } finally {
      await runtime.close();
    }
  });
  it("rejects actual plaintext client even if application claimed ssl=true", async () => {
    const settings = { ...harness.settings("learli_app"), ssl: false };
    const plain = new Client(settings);
    await plain.connect();
    try {
      expect(() =>
        verifyNativeTls(plain, harness.settings("learli_app")),
      ).toThrow(/omitted/);
    } finally {
      await plain.end();
    }
    expect(() =>
      verifyNativeTls(
        { query: vi.fn(), ssl: true } as unknown as Client,
        harness.settings("learli_app"),
      ),
    ).toThrow(/omitted/);
  });
  it("rejects wrong hostname on a genuinely authorized socket", async () => {
    const client = new Client({
      ...harness.settings("learli_app"),
      port: proxy.port,
    });
    await client.connect();
    try {
      expect(() =>
        verifyNativeTls(client, {
          ...harness.settings("learli_app"),
          host: "wrong.learli.test",
        }),
      ).toThrow(/omitted/);
    } finally {
      await client.end();
    }
  });
  it("wrong CA fails before operator callback; failure never leaks driver values", async () => {
    const original = injected.settings;
    injected.settings = () => ({
      ...harness.settings("learli_app", harness.untrustedCa),
      port: proxy.port,
    });
    try {
      await expect(
        openVerifiedOperationConnection(
          config("production", "inspect-runtime"),
        ),
      ).rejects.toMatchObject({ code: "connection_failed" });
    } finally {
      injected.settings = original;
    }
  });
  it("production inspection config cannot activate either application factory", async () => {
    const production = config("production", "inspect-runtime");
    expect(() => createNeonDevelopmentDatabase(production)).toThrow(/omitted/);
    await expect(createHostedRuntimeDatabase(production)).rejects.toMatchObject(
      { code: "config_invalid" },
    );
  });
  it("preserves real synthetic registration, captured verification, sign-in, learner and booking preview over guarded dev TLS", async () => {
    const runtime = createNeonDevelopmentAuth(developmentConfiguration());
    const email = `neon-dev-${randomUUID()}@learli.test`,
      password = "Synthetic-dev-only-password-123";
    const request = (route: string, body?: unknown, cookie?: string) =>
      handleAuthRequest(
        runtime,
        new Request(`${runtime.origin}/api/auth/${route}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            origin: runtime.origin,
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    try {
      selected.runtime = runtime;
      const catalogue = await readPublicCatalog();
      expect(catalogue?.tutors).toEqual([]);
      expect(catalogue?.subjects).toHaveLength(8);
      const signedUp = await request("sign-up/email", {
        email,
        name: "Synthetic development learner",
        password,
        callbackURL: "/account",
      });
      expect(signedUp.status).toBe(200);
      const { user } = (await signedUp.json()) as { user: { id: string } };
      const captures = await readdir(localMailbox("development"));
      let message: LocalMessage | undefined;
      for (const name of captures.filter((value) => value.endsWith(".json"))) {
        const found = JSON.parse(
          await readFile(path.join(localMailbox("development"), name), "utf8"),
        ) as LocalMessage;
        if (found.to === email && found.kind === "verification")
          message = found;
      }
      expect(message).toBeDefined();
      expect(new URL(message!.url).origin).toBe(runtime.origin);
      const verified = await handleAuthRequest(
        runtime,
        new Request(message!.url),
      );
      expect([200, 302]).toContain(verified.status);
      const signedIn = await request("sign-in/email", { email, password });
      expect(signedIn.status).toBe(200);
      const cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const headers = new Headers({ cookie });
      const owner = await openVerifiedOperationConnection(
        config("development", "inspect"),
      );
      try {
        await owner.withClient((client) =>
          client.query(
            "INSERT INTO user_roles(user_id,role) VALUES($1,'student')",
            [user.id],
          ),
        );
      } finally {
        await owner.close();
      }
      expect((await requireIdentity(runtime, headers)).roles).toContain(
        "student",
      );
      const learner = await createMyLearner(runtime, headers, {
        requestId: randomUUID(),
        management: "self",
        displayName: "Synthetic learner",
        level: "college_support",
        timezone: "Asia/Manila",
      });
      expect(learner).toBeDefined();
      const preview = await loadDemoBookingOptions(runtime, headers);
      expect(preview.learners).toHaveLength(1);
      expect(preview.learners[0].level).toBe("college_support");
      expect(preview.tutors).toEqual([]);
      await expect(
        readMyLearner(runtime, new Headers(), preview.learners[0].id),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        request("sign-up/email", {
          email: "not-synthetic@example.com",
          name: "Rejected",
          password,
        }),
      ).resolves.toMatchObject({ status: 400 });
    } finally {
      selected.runtime = undefined;
      await runtime.close();
    }
  }, 60000);
  it("reports invalid TLS as catalogue unavailable, never empty or fallback", async () => {
    const original = injected.settings;
    injected.settings = () => ({
      ...harness.settings("learli_app", harness.untrustedCa),
      port: proxy.port,
    });
    const runtime = createNeonDevelopmentAuth(developmentConfiguration());
    selected.runtime = runtime;
    try {
      expect(await readPublicCatalog()).toBeNull();
    } finally {
      selected.runtime = undefined;
      injected.settings = original;
      await runtime.close();
    }
  });
});
