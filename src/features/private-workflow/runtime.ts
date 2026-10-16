// Node-only composition. Read each packet afresh; database policy heads remain authoritative.
import type { AuthRuntime } from "@/lib/auth-factory";
import { parseServerEnv } from "@/lib/env/schema";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { assertHostedAuthConfig } from "@/features/hosted-auth/config";
import { readHostedAuthPacket } from "@/features/hosted-auth/config-file";
import { validateAdmissionCapability } from "@/features/learner-admission/policy";
import { validateScreeningCapability } from "@/features/tutor-screening/policy";
import { validateBookingCapability } from "@/features/booking-workflows/policy";
import {
  parsePrivateWorkflow,
  PrivateWorkflowError,
  type PrivateWorkflowBinding,
} from "./config";

export type { PrivateWorkflowPacket } from "./config";

function binding(runtime: AuthRuntime): PrivateWorkflowBinding {
  const env = parseServerEnv(process.env);
  if (runtime.environment !== env.APP_ENV || runtime.origin !== env.APP_URL)
    throw new PrivateWorkflowError();
  if ("hosted" in runtime) {
    if (env.APP_ENV !== "staging" || env.AUTH_MODE !== "hosted-synthetic")
      throw new PrivateWorkflowError();
    assertHostedAuthConfig(runtime.hosted);
    if (
      runtime.hosted.origin !== runtime.origin ||
      runtime.hosted.ingress.mode === "disabled"
    )
      throw new PrivateWorkflowError();
    const target = runtime.hosted.database.target;
    return {
      origin: runtime.origin,
      accountEmails: runtime.hosted.accountEmails,
      database: {
        mode: "hosted-staging",
        projectId: target.projectId,
        branchId: target.branchId,
        endpointId: target.endpointId,
        database: target.database,
      },
    };
  }
  if (
    runtime.environment !== "test" ||
    env.AUTH_MODE !== "local" ||
    env.DATABASE_MODE !== "local" ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new PrivateWorkflowError();
  const configured = localDatabaseConfig(env.DATABASE_URL, true);
  const options = runtime.pool.options;
  if (
    configured.user !== "learli_app" ||
    options.user !== configured.user ||
    options.host !== configured.host ||
    options.port !== configured.port ||
    options.database !== configured.database
  )
    throw new PrivateWorkflowError();
  return {
    origin: runtime.origin,
    database: {
      mode: "local-test",
      host: configured.host as "127.0.0.1" | "localhost" | "::1",
      port: configured.port,
      database: "learli_test",
      runtimeRole: "learli_app",
    },
  };
}

export function getPrivateWorkflow(runtime: AuthRuntime) {
  const file = process.env.PRIVATE_WORKFLOW_CONFIG_FILE;
  if (!file) return null;
  try {
    const expected = binding(runtime);
    return parsePrivateWorkflow(
      readHostedAuthPacket(process.cwd(), file),
      expected,
    );
  } catch {
    throw new PrivateWorkflowError();
  }
}

export function isPrivateWorkflow(runtime: AuthRuntime) {
  return getPrivateWorkflow(runtime) !== null;
}

/** Do not disclose or commit work using a packet replaced while a request waited. */
export function assertPrivateWorkflowUnchanged(
  runtime: AuthRuntime,
  captured: ReturnType<typeof getPrivateWorkflow> | undefined,
) {
  if (
    JSON.stringify(getPrivateWorkflow(runtime)) !==
    JSON.stringify(captured ?? null)
  )
    throw new PrivateWorkflowError();
}

export function privatePolicyEnvironment(
  runtime: AuthRuntime,
  kind: "admission" | "screening" | "booking",
  supplied: unknown,
) {
  const active = getPrivateWorkflow(runtime);
  if (active) {
    try {
      const normalized =
        kind === "admission"
          ? validateAdmissionCapability(supplied)
          : kind === "screening"
            ? validateScreeningCapability(supplied, "test")
            : validateBookingCapability(supplied, "test");
      if (JSON.stringify(normalized) === JSON.stringify(active[kind]))
        return "test";
    } catch {
      // A foreign or malformed capability never receives private validation authority.
    }
  }
  return runtime.environment;
}
