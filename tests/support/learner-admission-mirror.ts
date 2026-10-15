// Test-owned source mirror: exactly one composition substitution, no app flag.
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import {
  admissionMirrorPort,
  assertOwnedReadinessDatabase,
} from "./readiness-placement";
import { syntheticAdmissionPolicy } from "./learner-admission-fixtures";
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function inventory(
  root: string,
  directory = "src",
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory())
      Object.assign(files, await inventory(root, relative));
    else if (entry.isFile())
      files[relative] = digest(await readFile(path.join(root, relative)));
  }
  return Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  );
}
async function portAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error("Allocated mirror port is occupied.")),
    );
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}
export async function prepareAdmissionMirror(repo: string, policyId: string) {
  const root = path.join(repo, ".local/learner-admission/isolated-mirror");
  // Check each parent before descending so refresh cannot follow a link into
  // canonical source or another checkout. Only generated src is disposable.
  for (const directory of [
    path.join(repo, ".local"),
    path.dirname(root),
    root,
  ]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await lstat(directory)).isDirectory())
      throw new Error("Mirror requires checkout-owned generated directories.");
  }
  const before = await inventory(repo);
  await rm(path.join(root, "src"), { recursive: true, force: true });
  await cp(path.join(repo, "src"), path.join(root, "src"), { recursive: true });
  let publicExists = false;
  try {
    publicExists = (await stat(path.join(repo, "public"))).isDirectory();
  } catch (error) {
    if (!(
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ))
      throw error;
  }
  if (publicExists)
    await cp(path.join(repo, "public"), path.join(root, "public"), {
      recursive: true,
    });
  for (const name of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
  ])
    await cp(path.join(repo, name), path.join(root, name));
  const modules = path.join(root, "node_modules");
  try {
    await stat(modules);
  } catch {
    await symlink(path.join(repo, "node_modules"), modules, "dir");
  }
  const relative = "src/features/learner-admission/context.ts";
  const fixture = syntheticAdmissionPolicy(policyId);
  const replacement = `import type { AuthRuntime } from "@/lib/auth-factory";\nimport { validateAdmissionCapability } from "./policy";\nimport type { AdmissionContext } from "./service";\nexport function admissionContext(runtime:AuthRuntime):AdmissionContext { return {runtime,admission:validateAdmissionCapability(${JSON.stringify(fixture)})}; }\n`;
  await writeFile(path.join(root, relative), replacement, { mode: 0o600 });
  const after = await inventory(root);
  const changed = Object.keys(before).filter(
    (file) => before[file] !== after[file],
  );
  if (
    changed.length !== 1 ||
    changed[0] !== relative ||
    Object.keys(before).length !== Object.keys(after).length
  )
    throw new Error("Mirror source provenance mismatch.");
  await writeFile(
    path.join(repo, ".local/learner-admission/mirror-source.json"),
    JSON.stringify(
      { root, before, after, overrides: [relative], policyId },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await writeFile(
    path.join(repo, ".local/learner-admission/mirror-context.diff"),
    `--- shipped/context.ts\n${await readFile(path.join(repo, relative), "utf8")}\n+++ test-only/context.ts\n${replacement}`,
    { mode: 0o600 },
  );
  return root;
}
export async function startAdmissionMirror(
  repo: string,
  policyId: string,
  port = admissionMirrorPort,
) {
  if (
    process.env.APP_ENV !== "test" ||
    process.env.AUTH_MODE !== "local" ||
    port !== admissionMirrorPort
  )
    throw new Error("Mirror requires its assigned local test context.");
  assertOwnedReadinessDatabase(repo);
  await portAvailable(port);
  const root = await prepareAdmissionMirror(repo, policyId);
  const origin = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    APP_URL: origin,
    BETTER_AUTH_URL: origin,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const next = path.join(repo, "node_modules/next/dist/bin/next");
  async function logRun(args: string[], name: string) {
    const child = spawn(process.execPath, [next, ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => chunks.push(c));
    const exit = await new Promise<number | null>((resolve) =>
      child.once("exit", resolve),
    );
    await writeFile(
      path.join(repo, ".local/learner-admission", name),
      Buffer.concat(chunks),
      { mode: 0o600 },
    );
    if (exit !== 0)
      throw new Error("Owned mirror build failed; inspect private build log.");
  }
  await logRun(["build"], "mirror-build.log");
  const child: ChildProcess = spawn(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output: Buffer[] = [];
  child.stdout?.on("data", (c) => output.push(c));
  child.stderr?.on("data", (c) => output.push(c));
  async function stop() {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Owned mirror process exit unproven.")),
          10000,
        );
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await writeFile(
      path.join(repo, ".local/learner-admission/mirror-server.log"),
      Buffer.concat(output),
      { mode: 0o600 },
    );
  }
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null) break;
    try {
      if ((await fetch(`${origin}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) {
    await stop();
    throw new Error("Owned mirror did not become ready.");
  }
  return { origin, root, stop };
}
