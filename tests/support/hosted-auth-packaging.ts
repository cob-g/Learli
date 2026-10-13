import { hostedBackendPort } from "./hosted-auth-placement";
// Explicit owned production-only install/start rehearsal. No provider connection.
import { randomBytes, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { request } from "node:http";
import path from "node:path";
import { hostedTestOrigin, hostedTestPacket } from "./hosted-auth-packet";

const root = process.cwd();
function proof(file: string, value: unknown) {
  writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
}
function free() {
  return new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error("Assigned packaging port occupied.")),
    );
    server.listen(hostedBackendPort, "127.0.0.1", () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}
function probe(route: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port: hostedBackendPort, path: route },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body }),
        );
      },
    );
    call.on("error", reject);
    call.setTimeout(1000, () =>
      call.destroy(new Error("Owned probe timed out.")),
    );
    call.end();
  });
}
function exit(child: ChildProcess) {
  return new Promise<number | null>((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", () =>
      reject(new Error("Owned packaging command failed.")),
    );
  });
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const ended = exit(child);
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    if ((await ended) !== 0)
      throw new Error("Owned packaging shutdown failed.");
  } finally {
    clearTimeout(timer);
  }
}
async function main() {
  if (process.env.APP_ENV !== "test" || process.env.AUTH_MODE !== "local")
    throw new Error("Owned local test parent required.");
  await free();
  const directory = mkdtempSync(
    path.join(root, ".local/hosted-auth/production-install-"),
  );
  mkdirSync(path.join(directory, ".local"), { mode: 0o700 });
  for (const name of ["src", "public"]) {
    if (name === "public" && !existsSync(path.join(root, name))) continue;
    cpSync(path.join(root, name), path.join(directory, name), {
      recursive: true,
    });
  }
  mkdirSync(path.join(directory, "scripts"), { mode: 0o700 });
  cpSync(
    path.join(root, "scripts/start-hosted-auth.ts"),
    path.join(directory, "scripts/start-hosted-auth.ts"),
  );
  for (const name of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "next-env.d.ts",
    ".npmrc",
  ])
    if (existsSync(path.join(root, name)))
      cpSync(path.join(root, name), path.join(directory, name));
  cpSync(path.join(root, ".next"), path.join(directory, ".next"), {
    recursive: true,
    filter: (file) => !file.includes(`${path.sep}.next${path.sep}cache`),
  });
  const packetPath = path.join(directory, ".local/packet.json");
  proof(packetPath, {
    ...hostedTestPacket(),
    ingress: { mode: "disabled" },
    mail: { mode: "disabled" },
  });
  const installLog = openSync(
    path.join(directory, ".local/install.log"),
    "w",
    0o600,
  );
  const install = spawn(
    "npm",
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: directory, stdio: ["ignore", installLog, installLog] },
  );
  if ((await exit(install)) !== 0)
    throw new Error("Owned production-only installation failed.");
  const devOnlyPackages = ["typescript", "eslint", "@testing-library/react"];
  if (
    !existsSync(path.join(directory, "node_modules/tsx/package.json")) ||
    devOnlyPackages.some((name) =>
      existsSync(path.join(directory, "node_modules", name, "package.json")),
    )
  )
    throw new Error("Runtime dependency classification failed.");
  const source: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: "staging",
    AUTH_MODE: "hosted-synthetic",
    APP_URL: hostedTestOrigin,
    BETTER_AUTH_URL: hostedTestOrigin,
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
    HOSTED_INGRESS_SECRET: randomBytes(48).toString("hex"),
    HOSTED_AUTH_CONFIG_FILE: packetPath,
    PORT: String(hostedBackendPort),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };
  for (const field of [
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ])
    delete source[field];
  const launch = (env: NodeJS.ProcessEnv, label: string) => {
    const log = openSync(
      path.join(directory, `.local/${label}.log`),
      "w",
      0o600,
    );
    return spawn(
      process.execPath,
      ["--import", "tsx", "scripts/start-hosted-auth.ts"],
      { cwd: directory, env, detached: true, stdio: ["ignore", log, log] },
    );
  };
  let child: ChildProcess | undefined;
  try {
    child = launch(source, "entry");
    const deadline = Date.now() + 60000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      const result = await probe("/api/health").catch(() => undefined);
      if (result?.status === 200) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready)
      throw new Error("Production-only hosted entry did not become live.");
    const health = await probe("/api/health"),
      denied = await probe("/sign-in");
    if (
      health.body !== JSON.stringify({ status: "ok" }) ||
      denied.status !== 403
    )
      throw new Error("Packaging health/default ingress denial failed.");
    await stop(child);
    child = undefined;
    await free();
    const refused = launch(
      { ...source, APP_ENV: "production" },
      "production-refused",
    );
    if ((await exit(refused)) !== 1)
      throw new Error("Production mode was not refused.");
    await free();
    const identity = (file: string) =>
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex");
    proof(path.join(directory, ".local/proof.json"), {
      status: "PASS",
      productionOnlyInstall: true,
      tsx: JSON.parse(
        readFileSync(
          path.join(directory, "node_modules/tsx/package.json"),
          "utf8",
        ),
      ).version,
      devOnlyPackagesAbsent: devOnlyPackages,
      inheritedOptionalVitestPeerRetained: existsSync(
        path.join(directory, "node_modules/vitest/package.json"),
      ),
      actualEntryHealth: health.status,
      disabledIngressDenial: denied.status,
      SIGTERMExit: 0,
      productionRefusalExit: 1,
      portClosed: hostedBackendPort,
      source: {
        "package.json": identity("package.json"),
        "package-lock.json": identity("package-lock.json"),
        "scripts/start-hosted-auth.ts": identity(
          "scripts/start-hosted-auth.ts",
        ),
      },
      providerNetwork:
        "NOT RUN — disabled ingress/mail, no request reaches auth/DB",
      realDeployment: "NOT RUN",
    });
    proof(path.join(root, ".local/hosted-auth/production-install-proof.json"), {
      status: "PASS",
      directory,
      proof: path.join(directory, ".local/proof.json"),
    });
    process.stdout.write(
      "Owned production-only install and hosted startup/shutdown proof passed.\n",
    );
  } finally {
    if (child) await stop(child);
  }
}
void main().catch(() => {
  process.stderr.write(
    "Owned production-only packaging proof failed; private evidence retained.\n",
  );
  process.exitCode = 1;
});
