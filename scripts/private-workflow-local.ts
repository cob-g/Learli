// Shared owned-loopback admission only. No dotenv loading or target fallback.
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { localDatabaseConfig } from "../src/lib/db/local-config";
import { parsePrivateWorkflow } from "../src/features/private-workflow/config";
import { readPrivateJson } from "./staging-database";

const ownedState = z.object({
  ports: z.object({ database: z.number().int() }),
  ownerPassword: z.string().min(1),
  appPassword: z.string().min(1),
});

export function assertPrivateDirectory(root: string, directory: string) {
  root = path.resolve(root);
  const resolved = path.resolve(directory);
  if (
    !resolved.startsWith(`${root}/.local` + path.sep) &&
    resolved !== path.join(root, ".local")
  )
    throw new Error();
  for (
    let current = resolved;
    current !== root;
    current = path.dirname(current)
  ) {
    const stat = lstatSync(current);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077
    )
      throw new Error();
  }
}

export function loadOwnedPrivateWorkflow(
  root: string,
  file: string,
  environment: Record<string, string | undefined> = process.env,
) {
  // Copy the admitted source so later process-env changes cannot redirect a batch.
  const env = { ...environment };
  if (
    env.APP_ENV !== "test" ||
    env.AUTH_MODE !== "local" ||
    (env.DATABASE_MODE && env.DATABASE_MODE !== "local")
  )
    throw new Error();
  const owner = localDatabaseConfig(env.DATABASE_URL_DIRECT, true);
  const runtime = localDatabaseConfig(env.DATABASE_URL, true);
  const state = ownedState.parse(readPrivateJson(root, ".local/database.json"));
  const directory = path.join(root, ".local/postgres");
  assertPrivateDirectory(root, directory);
  const markerPath = path.join(directory, "learli-owned");
  const marker = lstatSync(markerPath);
  if (
    owner.user !== "learli_owner" ||
    owner.host !== "127.0.0.1" ||
    owner.port !== state.ports.database ||
    owner.password !== state.ownerPassword ||
    runtime.user !== "learli_app" ||
    runtime.host !== owner.host ||
    runtime.port !== owner.port ||
    runtime.password !== state.appPassword ||
    !marker.isFile() ||
    marker.isSymbolicLink() ||
    marker.uid !== process.getuid?.() ||
    readFileSync(markerPath, "utf8") !== "Learli local development cluster\n"
  )
    throw new Error();
  const expected = {
    origin: env.APP_URL ?? "",
    database: {
      mode: "local-test" as const,
      host: "127.0.0.1" as const,
      port: owner.port,
      database: "learli_test" as const,
      runtimeRole: "learli_app" as const,
    },
  };
  const packet = parsePrivateWorkflow(readPrivateJson(root, file), expected);
  const packetPath = path.resolve(root, file);
  const fingerprint = (target: string) => {
    const stat = lstatSync(target);
    return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(
      ":",
    );
  };
  const originalFile = fingerprint(packetPath);
  const originalPacket = JSON.stringify(packet);
  const originalState = JSON.stringify(state);
  const originalMarker = fingerprint(markerPath);
  return {
    packet,
    expected,
    ownerUrl: env.DATABASE_URL_DIRECT!,
    assertCurrent() {
      if (
        fingerprint(packetPath) !== originalFile ||
        fingerprint(markerPath) !== originalMarker ||
        JSON.stringify(
          ownedState.parse(readPrivateJson(root, ".local/database.json")),
        ) !== originalState ||
        JSON.stringify(
          parsePrivateWorkflow(readPrivateJson(root, file), expected),
        ) !== originalPacket
      )
        throw new Error();
      assertPrivateDirectory(root, directory);
    },
  };
}
