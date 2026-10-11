import "server-only";
import { createLocalAuth, type AuthRuntime } from "./auth-factory";
import { getServerEnv } from "./env/server";

const shared = globalThis as typeof globalThis & { learliAuth?: AuthRuntime };
export function getAuthRuntime() {
  if (getServerEnv().AUTH_MODE !== "local") return null;
  shared.learliAuth ??= createLocalAuth(process.env);
  return shared.learliAuth;
}
