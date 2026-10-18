import "server-only";
import { createHash } from "node:crypto";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import {
  createLocalAuth,
  type LocalAuthRuntime,
  type AuthRuntime,
} from "./auth-factory";
import { getServerEnv } from "./env/server";
import {
  createHostedAuth,
  type HostedAuthRuntime,
} from "@/features/hosted-auth/factory";
import { loadHostedAuthConfig } from "@/features/hosted-auth/config-file";
import {
  selectHostedSingleton,
  closeHostedSingleton,
  type SingletonState,
} from "@/features/hosted-auth/singleton";
import {
  createNeonDevelopmentAuth,
  loadNeonDevelopmentConfig,
  type NeonDevelopmentAuthRuntime,
} from "./db/neon-development";
import { HostedAuthError } from "@/features/hosted-auth/config";

const shared = globalThis as typeof globalThis & {
  learliAuth?: LocalAuthRuntime;
  learliLocalAuthFingerprint?: string;
  learliNeonDevelopmentAuth?: NeonDevelopmentAuthRuntime;
  learliDevelopmentFingerprint?: string;
  learliDatabaseMode?: string;
  learliHostedAuth?: SingletonState<HostedAuthRuntime>;
  learliAccountMode?: string;
  learliCloseAccountAuth?: () => Promise<void>;
};
export function getAuthRuntime() {
  const env = getServerEnv();
  if (env.AUTH_MODE !== "local") return null;
  if (
    shared.learliDatabaseMode &&
    shared.learliDatabaseMode !== env.DATABASE_MODE
  )
    throw new HostedAuthError("configuration");
  shared.learliDatabaseMode = env.DATABASE_MODE;
  if (env.DATABASE_MODE === "neon-development") {
    const config = loadNeonDevelopmentConfig(process.env);
    if (
      shared.learliDevelopmentFingerprint &&
      shared.learliDevelopmentFingerprint !== config.fingerprint
    )
      throw new HostedAuthError("configuration");
    shared.learliDevelopmentFingerprint = config.fingerprint;
    shared.learliNeonDevelopmentAuth ??= createNeonDevelopmentAuth(config);
    shared.learliCloseAccountAuth = shared.learliNeonDevelopmentAuth.close;
    return shared.learliNeonDevelopmentAuth;
  }
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        env.APP_ENV,
        env.APP_URL,
        env.BETTER_AUTH_URL,
        env.BETTER_AUTH_SECRET,
        env.DATABASE_URL,
        env.LOCAL_WORKFLOW_MODE,
      ]),
    )
    .digest("hex");
  if (
    shared.learliLocalAuthFingerprint &&
    shared.learliLocalAuthFingerprint !== fingerprint
  )
    throw new HostedAuthError("configuration");
  shared.learliLocalAuthFingerprint = fingerprint;
  shared.learliAuth ??= createLocalAuth(process.env);
  return shared.learliAuth;
}

/** Only safe presentation flags leave the validated server/runtime boundary. */
export function getAuthPresentation() {
  const env = getServerEnv();
  const runtime =
    env.LOCAL_WORKFLOW_MODE === "enabled" ? getAuthRuntime() : null;
  return {
    hosted: env.AUTH_MODE === "hosted-synthetic",
    localWorkflow: !!runtime && !!getLocalWorkflow(runtime),
  };
}
export async function getAccountAuthRuntime(): Promise<AuthRuntime | null> {
  const mode = getServerEnv().AUTH_MODE;
  if (shared.learliAccountMode && shared.learliAccountMode !== mode)
    throw new HostedAuthError("configuration");
  if (mode === "disabled") return null;
  shared.learliAccountMode = mode;
  if (mode === "local") return getAuthRuntime();
  const { config, fingerprint } = loadHostedAuthConfig(process.env);
  const state = (shared.learliHostedAuth ??= {});
  shared.learliCloseAccountAuth = () => closeHostedSingleton(state);
  return selectHostedSingleton(state, fingerprint, () =>
    createHostedAuth(config),
  );
}

/** Domain access is separately opt-in for fictional staging; account auth alone
 * grants no learner, tutor, booking or policy authority. */
export async function getDomainAuthRuntime(): Promise<AuthRuntime | null> {
  const env = getServerEnv();
  if (env.AUTH_MODE === "local") {
    const runtime = getAuthRuntime();
    if (runtime && process.env.PRIVATE_WORKFLOW_CONFIG_FILE)
      getPrivateWorkflow(runtime);
    return runtime;
  }
  if (
    env.AUTH_MODE !== "hosted-synthetic" ||
    !process.env.PRIVATE_WORKFLOW_CONFIG_FILE
  )
    return null;
  const runtime = await getAccountAuthRuntime();
  return runtime && getPrivateWorkflow(runtime) ? runtime : null;
}
