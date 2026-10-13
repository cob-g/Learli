import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { parseServerEnv } from "../src/lib/env/schema";
import { localDatabaseConfig } from "../src/lib/db/local-config";
import { isLoopbackOrigin } from "../src/lib/local-mode";

export type PreflightMode = "local" | "shell" | "hosted";
type Check = {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  message: string;
};
export type PreflightReport = {
  mode: PreflightMode;
  scope: "configuration and optional local liveness only";
  checks: Check[];
  exitCode: 0 | 1 | 2;
};
type Options = {
  mode: PreflightMode;
  health?: boolean;
  requireBuild?: boolean;
};
type Runtime = {
  node: string;
  npm: string;
  pinnedNode: string;
  pinnedNpm: string;
  buildPresent: boolean;
};

export function parsePreflightArgs(args: string[]) {
  let mode: PreflightMode | undefined;
  let envFile: string | undefined;
  let health = false;
  let requireBuild = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (seen.has(arg)) throw new Error("Invalid preflight arguments.");
    seen.add(arg);
    if (arg === "--mode") {
      const value = args[++index];
      if (!["local", "shell", "hosted"].includes(value))
        throw new Error("Explicit local, shell or hosted mode required.");
      mode = value as PreflightMode;
    } else if (arg === "--config") {
      envFile = args[++index];
      if (!envFile || envFile.startsWith("--"))
        throw new Error("Explicit environment file required.");
    } else if (arg === "--health") health = true;
    else if (arg === "--require-build") requireBuild = true;
    else throw new Error("Invalid preflight arguments.");
  }
  if (!mode) throw new Error("Explicit local, shell or hosted mode required.");
  return { mode, envFile, health, requireBuild };
}

/** Read-only: never imports the database connection, auth runtime or mail adapter. */
export async function deploymentPreflight(
  source: Record<string, string | undefined>,
  options: Options,
  runtime: Runtime,
  request: typeof fetch = fetch,
): Promise<PreflightReport> {
  const checks: Check[] = [];
  const check = (name: string, passed: boolean, message: string) =>
    checks.push({ name, status: passed ? "PASS" : "FAIL", message });
  check(
    "runtime",
    runtime.node === runtime.pinnedNode && runtime.npm === runtime.pinnedNpm,
    "Node and npm must match the repository pins.",
  );
  if (options.requireBuild)
    check(
      "build",
      runtime.buildPresent,
      "A completed build marker is required.",
    );

  if (options.mode === "hosted") {
    checks.push({
      name: "hosted-readiness",
      status: "BLOCKED",
      message:
        "Hosted release requires provider acceptance, approved operating policies and explicit deployment approval. Local software checks do not establish hosted readiness. No network check performed.",
    });
    return {
      mode: options.mode,
      scope: "configuration and optional local liveness only",
      checks,
      exitCode: 2,
    };
  }

  let env: ReturnType<typeof parseServerEnv> | undefined;
  try {
    env = parseServerEnv(source);
    check("environment", true, "Server configuration parses; values omitted.");
  } catch {
    check(
      "environment",
      false,
      "Invalid server configuration; values omitted.",
    );
  }
  const portText = source.PORT ?? "3000";
  const port = Number(portText);
  const portValid =
    String(port) === portText &&
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535;
  check("port", portValid, "PORT must be an unprivileged integer TCP port.");

  if (env) {
    if (options.mode === "local") {
      check(
        "local-mode",
        ["development", "test"].includes(env.APP_ENV) &&
          env.AUTH_MODE === "local",
        "Local mode requires development/test and local synthetic auth.",
      );
      try {
        const testing = env.APP_ENV === "test";
        const app = localDatabaseConfig(env.DATABASE_URL, testing);
        const owner = localDatabaseConfig(env.DATABASE_URL_DIRECT, testing);
        check(
          "database-separation",
          app.user === "learli_app" &&
            owner.user === "learli_owner" &&
            app.host === owner.host &&
            app.port === owner.port &&
            app.database === owner.database &&
            app.database === (testing ? "learli_test" : "learli_dev"),
          "Runtime/owner roles must target the same dedicated local environment. Database not contacted.",
        );
      } catch {
        check(
          "database-separation",
          false,
          "Dedicated local runtime/owner database configuration required; values omitted.",
        );
      }
      check(
        "local-origin",
        isLoopbackOrigin(env.APP_URL) &&
          Number(new URL(env.APP_URL).port || 80) === port,
        "The local app origin must match the process PORT.",
      );
    } else {
      const origin = new URL(env.APP_URL);
      check(
        "shell-mode",
        env.AUTH_MODE === "disabled" &&
          !env.DATABASE_URL &&
          !env.DATABASE_URL_DIRECT &&
          !env.BETTER_AUTH_SECRET &&
          !env.BETTER_AUTH_URL,
        "Shell mode requires disabled auth and no auth/database configuration.",
      );
      check(
        "shell-origin",
        !origin.username &&
          !origin.password &&
          !origin.search &&
          !origin.hash &&
          origin.pathname === "/" &&
          (origin.protocol === "https:" || isLoopbackOrigin(env.APP_URL)),
        "Shell APP_URL must be a plain HTTPS origin or loopback HTTP origin.",
      );
    }
    check(
      "email-disabled",
      !env.RESEND_API_KEY && !env.EMAIL_FROM,
      "Local and shell checks require no external email configuration.",
    );
  }

  if (options.health) {
    // Refuse all I/O after invalid configuration. Never accept a caller URL/path.
    if (checks.some((item) => item.status !== "PASS")) {
      check(
        "liveness",
        false,
        "Not requested because configuration checks failed.",
      );
    } else if (!env || !isLoopbackOrigin(env.APP_URL)) {
      check(
        "liveness",
        false,
        "Health checks accept loopback HTTP origins only.",
      );
    } else if (Number(new URL(env.APP_URL).port || 80) !== port) {
      check("liveness", false, "Health origin must match the process PORT.");
    } else {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 3000);
      let passed = false;
      try {
        const response = await request(new URL("/api/health", env.APP_URL), {
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        if (
          response.status !== 200 ||
          response.headers.get("cache-control") !== "no-store"
        ) {
          await response.body?.cancel();
          throw new Error();
        }
        // The health body is tiny. Bound streamed reads, including missing lengths.
        const reader = response.body?.getReader();
        if (!reader) throw new Error();
        let text = "";
        let size = 0;
        const decoder = new TextDecoder();
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 256) throw new Error();
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          await reader.cancel();
        }
        const body = JSON.parse(text) as unknown;
        passed =
          typeof body === "object" &&
          body !== null &&
          Object.keys(body).length === 1 &&
          "status" in body &&
          body.status === "ok";
      } catch {
        // URL, body, provider exceptions and configuration values never escape.
      } finally {
        clearTimeout(deadline);
      }
      check(
        "liveness",
        passed,
        "Local process must return only minimal uncached health. This does not prove database/auth/email readiness.",
      );
    }
  }
  return {
    mode: options.mode,
    scope: "configuration and optional local liveness only",
    checks,
    exitCode: checks.some((item) => item.status === "FAIL") ? 1 : 0,
  };
}

async function main() {
  try {
    const options = parsePreflightArgs(process.argv.slice(2));
    const source = options.envFile
      ? { ...process.env, ...parseEnv(readFileSync(options.envFile, "utf8")) }
      : process.env;
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      packageManager: string;
    };
    const npm = spawnSync("npm", ["--version"], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024,
    });
    let buildPresent = false;
    if (options.requireBuild) {
      try {
        buildPresent = Boolean(readFileSync(".next/BUILD_ID", "utf8").trim());
      } catch {
        // Missing/inaccessible build output is a failed check, not a raw error.
      }
    }
    const report = await deploymentPreflight(source, options, {
      node: process.versions.node,
      npm: npm.status === 0 ? npm.stdout.trim() : "",
      pinnedNode: readFileSync(".nvmrc", "utf8").trim(),
      pinnedNpm: pkg.packageManager.replace(/^npm@/, ""),
      buildPresent,
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
  } catch {
    console.error(
      "Preflight could not run. Check explicit mode/file arguments and repository runtime pins; values omitted.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  void main();
