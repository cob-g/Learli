// Node-only operator tooling. This does not broaden the local application adapter.
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";
import { z } from "zod";

export type StagingPurpose = "runtime" | "inspect" | "migrate";
export interface ApprovedStagingTarget {
  readonly version: 1;
  readonly provider: "neon";
  readonly environment: "staging";
  readonly projectId: string;
  readonly branchId: string;
  readonly endpointId: string;
  readonly hostname: string;
  readonly database: string;
  readonly runtimeRole: "learli_app";
  readonly migrationRole: string;
  readonly approvedPurposes: readonly StagingPurpose[];
  readonly operatorApproval: {
    readonly approvalId: string;
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly providerVerifiedAt: string;
    readonly isolation: "dedicated-synthetic-staging";
  };
}
export interface StagingDatabaseConfig {
  readonly target: ApprovedStagingTarget;
  readonly purpose: StagingPurpose;
  readonly role: string;
}
export type StagingErrorCode =
  | "config_invalid"
  | "connection_failed"
  | "identity_mismatch"
  | "runtime_privilege"
  | "cleanup_failed";

const messages: Record<StagingErrorCode, string> = {
  config_invalid: "Staging configuration refused. Connection values omitted.",
  connection_failed: "Staging connection failed. Driver details omitted.",
  identity_mismatch: "Staging connection identity refused. Details omitted.",
  runtime_privilege: "Staging runtime privileges refused. Details omitted.",
  cleanup_failed: "Staging connection cleanup failed. Details omitted.",
};
export class StagingDatabaseError extends Error {
  constructor(readonly code: StagingErrorCode) {
    super(messages[code]);
    this.name = "StagingDatabaseError";
  }
}

const resourceId = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sqlName = z
  .string()
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/);
const purposeSchema = z.enum(["runtime", "inspect", "migrate"]);
const targetSchema = z.strictObject({
  version: z.literal(1),
  provider: z.literal("neon"),
  environment: z.literal("staging"),
  projectId: resourceId,
  branchId: resourceId.refine((value) => value.startsWith("br-")),
  endpointId: resourceId.refine((value) => value.startsWith("ep-")),
  hostname: z.string().max(253),
  database: sqlName.refine(
    (value) =>
      ![
        "learli_dev",
        "learli_test",
        "postgres",
        "template0",
        "template1",
      ].includes(value) && !/(^|_)(prod|production)(_|$)/.test(value),
  ),
  runtimeRole: z.literal("learli_app"),
  migrationRole: sqlName.refine(
    (value) =>
      value !== "learli_app" &&
      !["postgres", "neon_superuser", "cloud_admin", "admin"].includes(value) &&
      !value.startsWith("pg_"),
  ),
  approvedPurposes: z
    .array(purposeSchema)
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length),
  operatorApproval: z.strictObject({
    approvalId: resourceId,
    approvedBy: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.@ -]*$/),
    approvedAt: z.iso.datetime(),
    providerVerifiedAt: z.iso.datetime(),
    isolation: z.literal("dedicated-synthetic-staging"),
  }),
});
const inputSchema = z.strictObject({
  appEnv: z.literal("staging"),
  url: z.string().min(1).max(4096),
  target: targetSchema,
  purpose: purposeSchema,
});
const settings = new WeakMap<StagingDatabaseConfig, PoolConfig>();

/** Reject process-wide TLS weakening before any driver can perform I/O. */
export function assertStagingTlsEnvironment() {
  if (
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
    process.env.NODE_EXTRA_CA_CERTS ||
    process.env.SSL_CERT_FILE ||
    process.env.SSL_CERT_DIR ||
    /--(?:use-openssl-ca|use-system-ca|tls-cipher-list|openssl-config)(?:=|\s|$)/.test(
      process.env.NODE_OPTIONS ?? "",
    )
  )
    throw new StagingDatabaseError("config_invalid");
}

/**
 * The record is an operator attestation from a private approved operation packet.
 * Parsing binds configuration to it; it cannot establish Neon resource ownership.
 * This parser neither loads dotenv nor performs network I/O.
 */
export function stagingDatabaseConfig(input: {
  appEnv: string | undefined;
  url: string | undefined;
  target: unknown;
  purpose: StagingPurpose;
}): StagingDatabaseConfig {
  try {
    const parsed = inputSchema.parse(input);
    const { target, purpose } = parsed;
    const suffix = target.hostname.slice(target.endpointId.length);
    if (
      !target.hostname.startsWith(`${target.endpointId}.`) ||
      !/^\.(?:[a-z0-9]+(?:-[a-z0-9]+)*\.){1,4}(?:aws|azure|gcp)\.neon\.tech$/.test(
        suffix,
      ) ||
      target.endpointId.includes("pooler") ||
      !target.approvedPurposes.includes(purpose) ||
      /\s|[\u0000-\u001f\u007f]/.test(parsed.url)
    )
      throw new Error();
    const url = new URL(parsed.url);
    const role =
      purpose === "runtime" ? target.runtimeRole : target.migrationRole;
    const password = decodeURIComponent(url.password);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== target.hostname ||
      (url.port && url.port !== "5432") ||
      url.username !== role ||
      url.pathname !== `/${target.database}` ||
      !password ||
      password.length > 1024 ||
      /[\u0000-\u001f\u007f]/.test(password) ||
      url.hash ||
      (url.search && url.search !== "?sslmode=verify-full")
    )
      throw new Error();
    // Freeze our parsed copy, never trust or freeze the caller's mutable object.
    Object.freeze(target.operatorApproval);
    Object.freeze(target.approvedPurposes);
    Object.freeze(target);
    const config = Object.freeze({ target, purpose, role });
    settings.set(config, {
      host: target.hostname,
      port: 5432,
      user: role,
      password,
      database: target.database,
      // Never pass a connectionString: pg SSL URL fields replace its SSL object.
      ssl: {
        rejectUnauthorized: true,
        servername: target.hostname,
        checkServerIdentity,
      },
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10_000,
      query_timeout: 10_000,
      statement_timeout: 10_000,
      // Explicit values prevent PGOPTIONS/PGSSLMODE and identity env fallback.
      options: "-c search_path=pg_catalog,public",
      application_name: "learli-staging-operator",
      sslnegotiation: "postgres",
      enableChannelBinding: true,
    });
    return config;
  } catch {
    throw new StagingDatabaseError("config_invalid");
  }
}

/** Internal driver lookup, not a parser/factory: forged config objects fail. */
export function stagingPoolConfig(config: StagingDatabaseConfig): PoolConfig {
  assertStagingTlsEnvironment();
  const stored = settings.get(config);
  if (!stored) throw new StagingDatabaseError("config_invalid");
  return {
    ...stored,
    ssl: typeof stored.ssl === "object" ? { ...stored.ssl } : stored.ssl,
  };
}
