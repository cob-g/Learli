import type { PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";
import { runtimeGrantsSql } from "../runtime-grants";
import { verifyProtections } from "./protections";
import {
  type Candidate,
  type History,
  digest,
  historySchema,
  MigrationFault,
  validateHistory,
} from "./journal";
import {
  migrationPrerequisites,
  probeRuntime,
  verifyRuntimeGrants,
} from "./privileges";

export interface Connection {
  withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export type Identity = {
  database: string;
  migrationRole: string;
  targetHash: string;
};
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const planSchema = z
  .object({
    version: z.literal(1),
    targetHash: hashSchema,
    candidateHash: hashSchema,
    history: historySchema,
    schemaHash: hashSchema,
    state: z.enum(["empty", "populated"]),
    pending: z.array(hashSchema).max(100),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const planHash = (plan: Plan) =>
  digest(JSON.stringify(planSchema.parse(plan)));
export const recoverySchema = z
  .object({
    version: z.literal(1),
    targetHash: hashSchema,
    planHash: hashSchema,
    restorePointReference: z.string().min(1).max(200),
    verifiedRecoveryReference: z.string().min(1).max(200),
    operatorApproval: z.string().min(1).max(200),
  })
  .strict();
export type Recovery = z.infer<typeof recoverySchema>;
export function validateApplyInputs(
  candidate: Candidate,
  identity: Identity,
  value: unknown,
  expectedHash: string,
  recoveryValue?: unknown,
) {
  const parsed = planSchema.safeParse(value);
  if (!parsed.success) throw new MigrationFault("plan_invalid");
  const plan = parsed.data,
    hash = planHash(plan);
  if (
    hash !== expectedHash ||
    plan.candidateHash !== candidate.hash ||
    plan.targetHash !== identity.targetHash
  )
    throw new MigrationFault("plan_mismatch");
  if (plan.state === "populated" && plan.pending.length) {
    const recovery = recoverySchema.safeParse(recoveryValue);
    if (
      !recovery.success ||
      recovery.data.planHash !== hash ||
      recovery.data.targetHash !== identity.targetHash
    )
      throw new MigrationFault("recovery_required");
  }
  return plan;
}

async function inspectOnClient(
  client: PoolClient,
  candidate: Candidate,
  identity: Identity,
): Promise<Plan> {
  const actual = (
    await client.query<{ database: string; role: string; session: string }>(
      "SELECT current_database() AS database,current_user AS role,session_user AS session",
    )
  ).rows[0];
  if (
    actual.database !== identity.database ||
    actual.role !== identity.migrationRole ||
    actual.session !== identity.migrationRole
  )
    throw new MigrationFault("identity_mismatch");
  await migrationPrerequisites(client);
  const meta = (
    await client.query<{ exists: boolean }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists",
    )
  ).rows[0].exists;
  const history: History = meta
    ? validateHistory(
        candidate,
        (
          await client.query<{ hash: string; created_at: string }>(
            "SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 101",
          )
        ).rows.map((row) => ({ hash: row.hash, when: Number(row.created_at) })),
      )
    : [];
  const tables = (
    await client.query<{ name: string }>(`
    SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)
  ).rows.map((row) => row.name);
  const expected = candidate.entries
    .slice(0, history.length)
    .flatMap((entry) =>
      [
        ...entry.statements.join("\n").matchAll(/CREATE TABLE "([a-z_]+)"/g),
      ].map((match) => match[1]),
    )
    .sort();
  if (JSON.stringify(tables) !== JSON.stringify(expected))
    throw new MigrationFault("schema_unrecognized");
  const extra = await client.query<{ count: string }>(`
    SELECT count(*)::text AS count FROM pg_namespace WHERE nspname NOT IN ('public','drizzle','information_schema')
      AND nspname NOT LIKE 'pg_%'`);
  if (Number(extra.rows[0].count) > 0)
    throw new MigrationFault("schema_unrecognized");
  if (!history.length) {
    const objects = await client.query<{ count: string }>(`
      SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
        +(SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
          AND t.typtype='e') AS count`);
    if (Number(objects.rows[0].count) > 0)
      throw new MigrationFault("schema_unrecognized");
  }
  await verifyProtections(client, candidate, history.length);
  // Bind current schema definitions/ACLs without selecting private application rows.
  const catalog = await client.query<{ kind: string; value: unknown }>(`
    SELECT * FROM (SELECT 'column' AS kind,jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid)) AS value
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p')
    UNION ALL SELECT 'constraint',jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'trigger',jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT 'function',jsonb_build_array(p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    UNION ALL SELECT 'table',jsonb_build_array(c.relname,c.relacl) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p')
    ) inventory ORDER BY kind,value::text`);
  return planSchema.parse({
    version: 1,
    targetHash: identity.targetHash,
    candidateHash: candidate.hash,
    history,
    schemaHash: digest(JSON.stringify(catalog.rows)),
    state: history.length ? "populated" : "empty",
    pending: candidate.entries.slice(history.length).map((entry) => entry.hash),
  });
}
export async function inspectTarget(
  connection: Connection,
  candidate: Candidate,
  identity: Identity,
) {
  return connection.withClient(async (client) => {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      return await inspectOnClient(client, candidate, identity);
    } finally {
      await client.query("ROLLBACK");
    }
  });
}

export type Receipt = {
  version: 1;
  status: "PASS" | "FAIL";
  category: string;
  stage:
    | "preflight"
    | "lock"
    | "migrate"
    | "grants"
    | "runtime"
    | "cleanup"
    | "complete";
  candidateHash: string;
  targetHash: string;
  planHash: string;
  pending: number;
  migrations: "not_started" | "unchanged" | "committed" | "unknown";
  grants: "not_started" | "committed" | "rolled_back" | "unknown";
  runtime: "not_run" | "pass";
  cleanup: "pass" | "failed";
};
export async function applyPlan(options: {
  owner: Connection;
  runtime: Connection;
  candidate: Candidate;
  identity: Identity;
  plan: unknown;
  expectedPlanHash: string;
  recovery?: unknown;
  recheckCandidate: () => Candidate;
}): Promise<Receipt> {
  const { owner, runtime, candidate, identity } = options;
  const receipt: Receipt = {
    version: 1,
    status: "FAIL",
    category: "apply_failed",
    stage: "preflight",
    candidateHash: candidate.hash,
    targetHash: identity.targetHash,
    planHash: "",
    pending: 0,
    migrations: "not_started",
    grants: "not_started",
    runtime: "not_run",
    cleanup: "pass",
  };
  try {
    const plan = validateApplyInputs(
      candidate,
      identity,
      options.plan,
      options.expectedPlanHash,
      options.recovery,
    );
    receipt.planHash = planHash(plan);
    receipt.pending = plan.pending.length;
    await owner.withClient(async (client) => {
      receipt.stage = "lock";
      const lock = (
        await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_lock(1835344,804) AS locked",
        )
      ).rows[0].locked;
      if (!lock) throw new MigrationFault("runner_busy");
      try {
        if (options.recheckCandidate().hash !== candidate.hash)
          throw new MigrationFault("candidate_changed");
        const current = await inspectOnClient(client, candidate, identity);
        if (planHash(current) !== receipt.planHash)
          throw new MigrationFault("plan_stale");
        receipt.stage = "migrate";
        receipt.migrations = "unknown";
        // Use the installed migrator's exact transaction/journal behavior with
        // captured statements. No second filesystem read can swap approved SQL.
        await new PgDialect().migrate(
          candidate.entries.map((entry) => ({
            sql: [...entry.statements],
            bps: true,
            folderMillis: entry.when,
            hash: entry.hash,
          })),
          drizzle(client, { schema: {} })._.session,
          { migrationsFolder: "drizzle" },
        );
        receipt.migrations = plan.pending.length ? "committed" : "unchanged";
        const post = await inspectOnClient(client, candidate, identity);
        if (post.history.length !== candidate.entries.length)
          throw new MigrationFault("history_divergent");
        receipt.stage = "grants";
        await client.query("BEGIN");
        receipt.grants = "unknown";
        let commitAttempted = false;
        try {
          await client.query(runtimeGrantsSql);
          await verifyRuntimeGrants(client);
          commitAttempted = true;
          await client.query("COMMIT");
          receipt.grants = "committed";
        } catch (error) {
          await client.query("ROLLBACK");
          receipt.grants = commitAttempted ? "unknown" : "rolled_back";
          throw error;
        }
        receipt.stage = "runtime";
        await runtime.withClient(probeRuntime);
        receipt.runtime = "pass";
      } finally {
        try {
          const unlocked = (
            await client.query<{ unlocked: boolean }>(
              "SELECT pg_advisory_unlock(1835344,804) AS unlocked",
            )
          ).rows[0]?.unlocked;
          if (!unlocked) throw new Error();
        } catch {
          throw new MigrationFault("cleanup_failed");
        }
      }
    });
    receipt.status = "PASS";
    receipt.stage = "complete";
    receipt.category = "complete";
  } catch (error) {
    receipt.category =
      error instanceof MigrationFault ? error.category : "apply_failed";
    if (receipt.category === "cleanup_failed") {
      receipt.cleanup = "failed";
      receipt.stage = "cleanup";
    }
  } finally {
    const closed = await Promise.allSettled([owner.close(), runtime.close()]);
    if (closed.some((result) => result.status === "rejected")) {
      receipt.status = "FAIL";
      receipt.cleanup = "failed";
      receipt.category = "cleanup_failed";
      receipt.stage = "cleanup";
    }
  }
  return receipt;
}
