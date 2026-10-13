// Node-only local synthetic composition. Never selected by staging/production/tests.
import { createHash } from "node:crypto";
import { z } from "zod";
import { readHostedAuthPacket } from "@/features/hosted-auth/config-file";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import { captureLocalMail } from "@/lib/email/local-mail";
import { syntheticEmail } from "@/lib/local-mode";
import { parseServerEnv } from "@/lib/env/schema";
import { neonOperationConfig } from "./neon-operation-config";
import { createNeonDevelopmentDatabase } from "./hosted-runtime";
import { StagingDatabaseError } from "./staging-config";

const registered = new WeakSet<object>();
const packetSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("local-neon-development"),
  realWorkflows: z.literal("disabled"),
  databaseUrl: z.string().min(1).max(4096),
  target: z.unknown(),
});
export function loadNeonDevelopmentConfig(
  source: Record<string, string | undefined>,
  root = process.cwd(),
) {
  const env = parseServerEnv(source);
  if (
    env.DATABASE_MODE !== "neon-development" ||
    env.APP_ENV !== "development" ||
    env.AUTH_MODE !== "local" ||
    !env.NEON_DEVELOPMENT_CONFIG_FILE ||
    !env.BETTER_AUTH_SECRET
  )
    throw new StagingDatabaseError("config_invalid");
  try {
    const packet = packetSchema.parse(
      readHostedAuthPacket(root, env.NEON_DEVELOPMENT_CONFIG_FILE),
    );
    const database = neonOperationConfig({
      appEnv: "development",
      url: packet.databaseUrl,
      target: packet.target,
      purpose: "runtime",
    });
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          env.APP_ENV,
          env.AUTH_MODE,
          env.DATABASE_MODE,
          env.NEON_DEVELOPMENT_CONFIG_FILE,
          env.APP_URL,
          env.BETTER_AUTH_URL,
          env.BETTER_AUTH_SECRET,
          packet,
        ]),
      )
      .digest("hex");
    const config = Object.freeze({
      database,
      fingerprint,
      origin: env.APP_URL,
      secret: env.BETTER_AUTH_SECRET,
    });
    registered.add(config);
    return config;
  } catch {
    throw new StagingDatabaseError("config_invalid");
  }
}
export function createNeonDevelopmentAuth(
  config: ReturnType<typeof loadNeonDevelopmentConfig>,
) {
  if (!registered.has(config)) throw new StagingDatabaseError("config_invalid");
  const database = createNeonDevelopmentDatabase(config.database);
  try {
    const composition = composeAccountAuth(database.db, {
      origin: config.origin,
      secret: config.secret,
      hosted: false,
      permitsEmail: syntheticEmail,
      sendMail: (mail) => captureLocalMail("development", mail),
    });
    return Object.freeze({
      ...composition,
      ...database,
      origin: config.origin,
      environment: "development" as const,
    });
  } catch {
    void database.close().catch(() => undefined);
    throw new StagingDatabaseError("config_invalid");
  }
}
export type NeonDevelopmentAuthRuntime = ReturnType<
  typeof createNeonDevelopmentAuth
>;
