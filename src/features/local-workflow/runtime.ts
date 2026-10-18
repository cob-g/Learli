// Node-only runtime admission. Domain policy heads and staff grants remain SQL authority.
import { parseServerEnv } from "@/lib/env/schema";
import { localDatabaseConfig } from "@/lib/db/local-config";
import type { AuthRuntime } from "@/lib/auth-factory";

export class LocalWorkflowError extends Error {
  constructor() {
    super("Local workflow configuration is unavailable. Details omitted.");
  }
}

type PoolBinding = {
  options: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
  };
};
export type LocalWorkflow = Readonly<{
  source: "local_operation";
  environment: "development";
  origin: string;
  database: Readonly<{
    host: string;
    port: number;
    database: "learli_dev";
    runtimeRole: "learli_app";
  }>;
}>;
// The auth singleton can outlive an individual Next.js server bundle.
const shared = globalThis as typeof globalThis & {
  learliLocalWorkflowCapabilities?: WeakSet<object>;
};
const registered = (shared.learliLocalWorkflowCapabilities ??=
  new WeakSet<object>());

/** Pure validation: no connection, policy installation, role grant or file read. */
export function validateLocalWorkflowBinding(
  source: Record<string, string | undefined>,
  pool: PoolBinding,
): LocalWorkflow | null {
  const env = parseServerEnv(source);
  if (env.LOCAL_WORKFLOW_MODE !== "enabled") return null;
  try {
    const configured = localDatabaseConfig(env.DATABASE_URL);
    if (
      configured.database !== "learli_dev" ||
      configured.user !== "learli_app" ||
      pool.options.host !== configured.host ||
      pool.options.port !== configured.port ||
      pool.options.database !== configured.database ||
      pool.options.user !== configured.user
    )
      throw new Error();
    const capability: LocalWorkflow = Object.freeze({
      source: "local_operation",
      environment: "development",
      origin: env.APP_URL,
      database: Object.freeze({
        host: configured.host,
        port: configured.port,
        database: "learli_dev",
        runtimeRole: "learli_app",
      }),
    });
    registered.add(capability);
    return capability;
  } catch {
    throw new LocalWorkflowError();
  }
}

export function assertLocalWorkflowCapability(capability: LocalWorkflow): void {
  if (!registered.has(capability)) throw new LocalWorkflowError();
}

/** Rebind every use to current server selection and the actual runtime pool. */
export function getLocalWorkflow(
  runtime: AuthRuntime,
  source: Record<string, string | undefined> = process.env,
): LocalWorkflow | null {
  const capability = "localWorkflow" in runtime ? runtime.localWorkflow : null;
  if (!capability && source.LOCAL_WORKFLOW_MODE !== "enabled") return null;
  if (!capability || "hosted" in runtime || !("options" in runtime.pool))
    throw new LocalWorkflowError();
  assertLocalWorkflowCapability(capability);
  const current = validateLocalWorkflowBinding(source, runtime.pool);
  if (
    !current ||
    runtime.environment !== current.environment ||
    runtime.origin !== current.origin ||
    JSON.stringify(current) !== JSON.stringify(capability)
  )
    throw new LocalWorkflowError();
  return capability;
}
