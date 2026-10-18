// Explicit isolated ordinary fixture only. Never imports the standard resetting test world.
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import path from "node:path";
import { createLocalAuth } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";

export function operationFixtureConfiguration() {
  const checkout = fileURLToPath(new URL("../../", import.meta.url));
  const fixture = path.join(
    checkout,
    ".local/local-operation-20261018/fixture",
  );
  if (
    process.env.LOCAL_OPERATION_FIXTURE_ROOT !== fixture ||
    realpathSync(fixture) !== fixture ||
    process.env.LOCAL_WORKFLOW_MODE !== "enabled" ||
    process.env.APP_ENV !== "development" ||
    process.env.APP_URL !== "http://127.0.0.1:3300"
  )
    throw new Error("Explicit separate ordinary operation fixture required.");
  const state = JSON.parse(
    readFileSync(path.join(fixture, ".local/database.json"), "utf8"),
  );
  const ownerFile = path.join(fixture, ".env.operation.owner.local");
  const stat = lstatSync(ownerFile);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o7777) !== 0o600 ||
    state.ports.database !== 55434
  )
    throw new Error("Owned separate fixture authority required.");
  const ownerEnv = parseEnv(readFileSync(ownerFile, "utf8"));
  const ownerUrl = ownerEnv.DATABASE_URL_DIRECT!;
  const selected = new URL(ownerUrl);
  const app = new URL(process.env.DATABASE_URL!);
  for (const url of [selected, app]) {
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "55434" ||
      url.pathname !== "/learli_dev" ||
      url.search ||
      url.hash
    )
      throw new Error("Fixture connection refused.");
  }
  if (
    selected.username !== "learli_owner" ||
    selected.password !== state.ownerPassword ||
    app.username !== "learli_app" ||
    app.password !== state.appPassword
  )
    throw new Error("Fixture role binding refused.");
  if (
    readFileSync(path.join(fixture, ".local/postgres/learli-owned"), "utf8") !==
    "Learli local development cluster\n"
  )
    throw new Error("Fixture cluster ownership refused.");
  return { checkout, fixture, ownerUrl };
}

export function openOperationFixture() {
  const config = operationFixtureConfiguration();
  const owner = createDatabase(config.ownerUrl);
  const runtime = createLocalAuth(process.env);
  if (getLocalWorkflow(runtime)?.database.port !== 55434)
    throw new Error("Operation runtime fixture binding refused.");
  return {
    ...config,
    owner,
    runtime,
    async close() {
      await runtime.pool.end();
      await owner.pool.end();
    },
  };
}
