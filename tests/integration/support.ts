// Helpers for real-PostgreSQL tests. Synthetic accounts on learli_test only.
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createLocalAuth, type AuthRuntime } from "@/lib/auth-factory";
import { handleAuthRequest } from "@/lib/auth-handler";
import { createDatabase } from "@/lib/db/connection";
import { userRoles, type Role } from "@/lib/db/schema";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";

export const password = "Synthetic-only-passphrase-123";
export type World = {
  runtime: AuthRuntime;
  owner: ReturnType<typeof createDatabase>;
};

export function openWorld(): World {
  if (process.env.APP_ENV !== "test")
    throw new Error("Integration tests require the isolated test environment.");
  return {
    owner: createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true),
    runtime: createLocalAuth(process.env),
  };
}

export async function closeWorld(world: World | undefined) {
  await world?.runtime.pool.end();
  await world?.owner.pool.end();
}

/** A JSON request shaped like the browser's, for calling a handler directly. */
export function jsonRequest(
  world: World,
  route: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string;
  } = {},
) {
  const {
    method = "POST",
    body,
    cookie,
    origin = world.runtime.origin,
  } = options;
  return new Request(`${world.runtime.origin}${route}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function verificationUrl(email: string) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (message.to === email && message.kind === "verification")
      return message.url;
  }
  throw new Error("Expected a private local capture.");
}

/** Registers, verifies and signs in through the real auth flow, then grants roles. */
export async function createAccount(
  world: World,
  roles: Role[] = [],
  name = "Synthetic person",
) {
  // Trusted synthetic provisioning must not inherit another suite's auth
  // attempts. Feature throttle assertions use real requests after provisioning.
  await world.owner.pool.query(
    "UPDATE rate_limit SET count = 0 WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/sign-in/email%'",
  );
  const email = `test-${randomUUID()}@learli.test`;
  const signUp = await handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-up/email", {
      body: { email, name, password, callbackURL: "/account" },
    }),
  );
  if (signUp.status !== 200)
    throw new Error(`Synthetic registration failed (HTTP ${signUp.status}).`);
  const id = ((await signUp.json()) as { user: { id: string } }).user.id;
  await handleAuthRequest(
    world.runtime,
    new Request(await verificationUrl(email)),
  );
  // Trusted test setup; the application has no role-grant endpoint.
  if (roles.length)
    await world.owner.db
      .insert(userRoles)
      .values(roles.map((role) => ({ userId: id, role })));
  const signIn = await handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-in/email", {
      body: { email, password },
    }),
  );
  if (signIn.status !== 200) throw new Error("Synthetic sign-in failed.");
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { id, email, name, cookie, headers: new Headers({ cookie }) };
}
export type TestAccount = Awaited<ReturnType<typeof createAccount>>;
