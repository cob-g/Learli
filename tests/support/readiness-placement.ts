// Test-owned placement only; no application factory consumes these settings.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { localDatabaseConfig } from "../../src/lib/db/local-config";
import { stagingTlsTestPort } from "./staging-tls";

export const admissionMirrorPort = stagingTlsTestPort(
  process.env.LEARLI_ADMISSION_MIRROR_PORT ?? "3095",
);
export const screeningMirrorPort = stagingTlsTestPort(
  process.env.LEARLI_SCREENING_MIRROR_PORT ?? "3098",
);
export const screeningMirrorOrigin = `http://127.0.0.1:${screeningMirrorPort}`;

const ownedState = z.object({
  ports: z.object({ database: z.number().int().min(1024).max(65535) }),
  ownerPassword: z.string().min(1),
  appPassword: z.string().min(1),
});
/** Refuse a peer checkout's DB even when its URL is also a local test URL. */
export function assertOwnedReadinessDatabase(
  root: string,
  env: Record<string, string | undefined> = process.env,
) {
  try {
    if (env.APP_ENV !== "test" || env.AUTH_MODE !== "local") throw new Error();
    const owner = localDatabaseConfig(env.DATABASE_URL_DIRECT, true);
    const runtime = localDatabaseConfig(env.DATABASE_URL, true);
    const ci = env.CI === "true";
    const state = ownedState.parse(
      JSON.parse(
        readFileSync(
          path.join(
            root,
            ci ? ".local/ci-database.json" : ".local/database.json",
          ),
          "utf8",
        ),
      ),
    );
    if (ci) {
      const receipt = z
        .object({
          kind: z.literal("learli-disposable-ci-service"),
          sourceRoot: z.string(),
        })
        .parse(
          JSON.parse(
            readFileSync(path.join(root, ".local/ci-database.json"), "utf8"),
          ),
        );
      if (receipt.sourceRoot !== realpathSync(root)) throw new Error();
    } else {
      const marker = readFileSync(
        path.join(root, ".local/postgres/learli-owned"),
        "utf8",
      );
      if (marker !== "Learli local development cluster\n") throw new Error();
    }
    if (
      owner.host !== "127.0.0.1" ||
      runtime.host !== owner.host ||
      owner.port !== state.ports.database ||
      runtime.port !== owner.port ||
      owner.user !== "learli_owner" ||
      runtime.user !== "learli_app" ||
      owner.password !== state.ownerPassword ||
      runtime.password !== state.appPassword
    )
      throw new Error();
  } catch {
    throw new Error(
      "Readiness mirror requires this checkout's owned local test database. Values omitted.",
    );
  }
}
