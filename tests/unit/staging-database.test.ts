import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { candidateSources } from "../../scripts/staging-migrations/journal";
const connections = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("../../src/lib/db/staging-connection", () => ({
  openStagingConnection: connections.open,
}));
import {
  inspectConfiguration,
  readPrivateJson,
  stagingMain,
} from "../../scripts/staging-database";
const target = {
  version: 1,
  provider: "neon",
  environment: "staging",
  projectId: "fictional-project-123",
  branchId: "br-fictional-123",
  endpointId: "ep-fictional-123",
  hostname: "ep-fictional-123.us-east-2.aws.neon.tech",
  database: "learli_staging",
  runtimeRole: "learli_app",
  migrationRole: "learli_migrator",
  approvedPurposes: ["runtime", "inspect", "migrate"],
  operatorApproval: {
    approvalId: "fictional-record-123",
    approvedBy: "fictional-operator",
    approvedAt: "2026-10-12T00:00:00Z",
    providerVerifiedAt: "2026-10-12T00:00:00Z",
    isolation: "dedicated-synthetic-staging",
  },
};
const config = {
  APP_ENV: "staging",
  STAGING_DATABASE_URL: `postgresql://learli_app:synthetic-private-value@${target.hostname}/learli_staging`,
  STAGING_DATABASE_URL_DIRECT: `postgresql://learli_migrator:synthetic-private-value@${target.hostname}/learli_staging`,
};
const fixtureRoots: string[] = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true });
});
function files() {
  const root = path.join(
    process.cwd(),
    ".local/staging-database-wave",
    `cli-${randomUUID()}`,
  );
  const directory = path.join(root, ".local", "operator");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  fixtureRoots.push(root);
  // Candidate hashing needs real, nonsecret source inputs. The private input
  // tree belongs entirely to this fixture, regardless of checkout permissions.
  cpSync(path.join(process.cwd(), "drizzle"), path.join(root, "drizzle"), {
    recursive: true,
  });
  for (const file of candidateSources) {
    const destination = path.join(root, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(process.cwd(), file), destination);
  }
  const conf = path.join(directory, "config.json"),
    tgt = path.join(directory, "target.json");
  writeFileSync(conf, JSON.stringify(config), { mode: 0o600 });
  writeFileSync(tgt, JSON.stringify(target), { mode: 0o600 });
  return {
    root,
    directory,
    conf,
    tgt,
    args: ["--config", conf, "--target", tgt],
  };
}
describe("explicit staging operator boundary", () => {
  it("configuration-only pure and CLI inspection never open network and never output secret values", async () => {
    const pure = inspectConfiguration(config, target, "inspect");
    expect(pure.summary.network).toBe("NOT RUN");
    expect(JSON.stringify(pure).includes("synthetic-private-value")).toBe(
      false,
    );
    const f = files(),
      result = await stagingMain(["inspect-config", ...f.args], f.root);
    expect(result.status).toBe("PASS");
    expect(result.network).toBe("NOT RUN");
    expect(connections.open).not.toHaveBeenCalled();
    expect(JSON.stringify(result).includes("synthetic-private-value")).toBe(
      false,
    );
  });
  it.each(
    [
      [],
      ["inspect-config"],
      ["inspect-config", "--config", ".env.local"],
      ["seed"],
      ["apply", "--force", "true"],
    ].map((args) => ({ args })),
  )("refuses implicit or unsupported arguments $args", async ({ args }) => {
    expect((await stagingMain(args)).status).toBe("FAIL");
    expect(connections.open).not.toHaveBeenCalled();
  });
  it("refuses readable/foreign-path/symlink/oversized private input files", () => {
    const f = files();
    chmodSync(f.conf, 0o644);
    expect(() => readPrivateJson(f.root, f.conf)).toThrow(
      "private_file_invalid",
    );
    expect(() => readPrivateJson(f.root, "package.json")).toThrow(
      "private_file_invalid",
    );
    const link = path.join(f.directory, "linked.json");
    symlinkSync(f.tgt, link);
    expect(() => readPrivateJson(f.root, link)).toThrow("private_file_invalid");
    const huge = path.join(f.directory, "huge.json");
    writeFileSync(huge, " ".repeat(65537), { mode: 0o600 });
    expect(() => readPrivateJson(f.root, huge)).toThrow("private_file_invalid");
    chmodSync(path.join(f.root, ".local"), 0o755);
    expect(() => readPrivateJson(f.root, f.tgt)).toThrow(
      "private_file_invalid",
    );
  });
  it("sanitizes malformed config and target without secret exception details", async () => {
    const f = files();
    writeFileSync(
      f.conf,
      JSON.stringify({ ...config, unapproved: "synthetic-private-value" }),
    );
    const result = await stagingMain(["inspect-config", ...f.args], f.root);
    expect(result).toEqual({
      version: 1,
      status: "FAIL",
      category: "config_invalid",
    });
    expect(JSON.stringify(result).includes("synthetic-private-value")).toBe(
      false,
    );
  });
  it("rejects malformed apply approval before opening any network", async () => {
    const f = files(),
      plan = path.join(f.directory, "plan.json");
    writeFileSync(
      plan,
      JSON.stringify({ password: "synthetic-private-value" }),
      { mode: 0o600 },
    );
    const result = await stagingMain(
      ["apply", ...f.args, "--plan", plan, "--plan-hash", "a".repeat(64)],
      f.root,
    );
    expect(result).toEqual({
      version: 1,
      status: "FAIL",
      category: "plan_invalid",
    });
    expect(connections.open).not.toHaveBeenCalled();
  });
});
