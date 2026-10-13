// Node-only, explicit production/development operations; staging stays separate.
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";
import { z } from "zod";
import {
  assertStagingTlsEnvironment,
  StagingDatabaseError,
} from "./staging-config";

const resource = z
  .string()
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sqlName = z
  .string()
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/);
const purpose = z.enum([
  "runtime",
  "inspect-runtime",
  "inspect",
  "migrate",
  "bootstrap",
]);
const targetSchema = z
  .strictObject({
    version: z.literal(1),
    provider: z.literal("neon"),
    environment: z.enum(["development", "production"]),
    projectId: resource,
    branchId: resource.refine((v) => v.startsWith("br-")),
    endpointId: resource.refine(
      (v) => v.startsWith("ep-") && !v.includes("pooler"),
    ),
    hostname: z.string().max(253),
    database: sqlName.refine(
      (v) =>
        ![
          "learli_dev",
          "learli_test",
          "postgres",
          "template0",
          "template1",
        ].includes(v),
    ),
    runtimeRole: z.literal("learli_app"),
    migrationRole: z.literal("learli_migrator"),
    bootstrapRole: z.literal("neondb_owner"),
    approvedPurposes: z
      .array(purpose)
      .min(1)
      .max(5)
      .refine((v) => new Set(v).size === v.length),
    operatorApproval: z.strictObject({
      approvalId: resource,
      approvedBy: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[A-Za-z0-9][A-Za-z0-9_.@ -]*$/),
      approvedAt: z.iso.datetime(),
      providerVerifiedAt: z.iso.datetime(),
      isolation: z.enum([
        "schema-only-development",
        "production-schema-operation",
      ]),
      sourceBranchId: resource.refine((v) => v.startsWith("br-")),
    }),
  })
  .superRefine((value, ctx) => {
    if (
      value.environment === "production" &&
      (value.approvedPurposes.includes("runtime") ||
        value.operatorApproval.isolation !== "production-schema-operation" ||
        value.operatorApproval.sourceBranchId !== value.branchId)
    )
      ctx.addIssue({ code: "custom", message: "Production operations only" });
    if (
      value.environment === "development" &&
      (value.operatorApproval.isolation !== "schema-only-development" ||
        value.operatorApproval.sourceBranchId === value.branchId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Isolated schema-only development required",
      });
  });
export type ApprovedNeonOperationTarget = z.infer<typeof targetSchema>;
export type NeonOperationPurpose = z.infer<typeof purpose>;
export interface NeonOperationConfig {
  readonly target: ApprovedNeonOperationTarget;
  readonly purpose: NeonOperationPurpose;
  readonly role: string;
}
const settings = new WeakMap<NeonOperationConfig, PoolConfig>();

/** Attestations bind an approved operation, never establish provider ownership. */
export function neonOperationConfig(input: {
  appEnv: string | undefined;
  url: string | undefined;
  target: unknown;
  purpose: NeonOperationPurpose;
}): NeonOperationConfig {
  try {
    const parsed = z
      .strictObject({
        appEnv: z.enum(["development", "production"]),
        url: z.string().min(1).max(4096),
        target: targetSchema,
        purpose,
      })
      .parse(input);
    const { target } = parsed;
    if (
      target.environment !== parsed.appEnv ||
      !target.approvedPurposes.includes(parsed.purpose) ||
      !target.hostname.startsWith(`${target.endpointId}.`) ||
      !/^\.(?:[a-z0-9]+(?:-[a-z0-9]+)*\.){1,4}(?:aws|azure|gcp)\.neon\.tech$/.test(
        target.hostname.slice(target.endpointId.length),
      ) ||
      /\s|[\u0000-\u001f\u007f]/.test(parsed.url)
    )
      throw new Error();
    if (parsed.purpose === "runtime" && parsed.appEnv !== "development")
      throw new Error();
    const role = ["runtime", "inspect-runtime"].includes(parsed.purpose)
      ? target.runtimeRole
      : parsed.purpose === "bootstrap"
        ? target.bootstrapRole
        : target.migrationRole;
    const url = new URL(parsed.url),
      password = decodeURIComponent(url.password);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== target.hostname ||
      (url.port && url.port !== "5432") ||
      url.username !== role ||
      url.pathname !== `/${target.database}` ||
      !password ||
      password.length > 1024 ||
      /[\u0000-\u001f\u007f]/.test(password) ||
      url.hash
    )
      throw new Error();
    const options = [...url.searchParams.entries()];
    if (
      new Set(options.map(([key]) => key)).size !== options.length ||
      options.some(
        ([key, value]) =>
          !(key === "sslmode" && value === "verify-full") &&
          !(key === "channel_binding" && value === "require"),
      ) ||
      (options.length && url.searchParams.get("sslmode") !== "verify-full")
    )
      throw new Error();
    Object.freeze(target.operatorApproval);
    Object.freeze(target.approvedPurposes);
    Object.freeze(target);
    const config = Object.freeze({ target, purpose: parsed.purpose, role });
    settings.set(config, {
      host: target.hostname,
      port: 5432,
      user: role,
      password,
      database: target.database,
      ssl: {
        rejectUnauthorized: true,
        servername: target.hostname,
        checkServerIdentity,
      },
      enableChannelBinding: true,
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
      options: "-c search_path=pg_catalog,public",
      sslnegotiation: "postgres",
      application_name: "learli-neon-operator",
    });
    return config;
  } catch {
    throw new StagingDatabaseError("config_invalid");
  }
}
export function isNeonOperationConfig(
  config: object,
): config is NeonOperationConfig {
  return settings.has(config as NeonOperationConfig);
}
export function neonOperationPoolConfig(
  config: NeonOperationConfig,
): PoolConfig {
  assertStagingTlsEnvironment();
  const stored = settings.get(config);
  if (!stored) throw new StagingDatabaseError("config_invalid");
  return {
    ...stored,
    ssl: typeof stored.ssl === "object" ? { ...stored.ssl } : stored.ssl,
  };
}
