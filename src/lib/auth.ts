import "server-only";
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
  shared.learliAuth ??= createLocalAuth(process.env);
  return shared.learliAuth;
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
