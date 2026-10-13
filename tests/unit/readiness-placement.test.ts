import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";

const directories: string[] = [];
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true });
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "learli-readiness-placement-"));
  directories.push(root);
  mkdirSync(path.join(root, ".local/postgres"), { recursive: true });
  writeFileSync(
    path.join(root, ".local/postgres/learli-owned"),
    "Learli local development cluster\n",
  );
  writeFileSync(
    path.join(root, ".local/database.json"),
    JSON.stringify({
      ports: { database: 55919 },
      ownerPassword: "fictional-owner",
      appPassword: "fictional-app",
    }),
  );
  const env = {
    APP_ENV: "test",
    AUTH_MODE: "local",
    DATABASE_URL_DIRECT:
      "postgresql://learli_owner:fictional-owner@127.0.0.1:55919/learli_test",
    DATABASE_URL:
      "postgresql://learli_app:fictional-app@127.0.0.1:55919/learli_test",
  };
  return { root, env };
}
describe("owned readiness mirror placement", () => {
  it("accepts this checkout's matching runtime and owner test targets", () => {
    const { root, env } = fixture();
    expect(() => assertOwnedReadinessDatabase(root, env)).not.toThrow();
  });
  it("rejects peer credentials/ports, production and absent ownership without exposing values", () => {
    const { root, env } = fixture();
    for (const change of [
      { DATABASE_URL: env.DATABASE_URL.replace("55919", "55908") },
      {
        DATABASE_URL: env.DATABASE_URL.replace("fictional-app", "peer-secret"),
      },
      {
        DATABASE_URL_DIRECT: env.DATABASE_URL_DIRECT.replace(
          "learli_test",
          "learli_dev",
        ),
      },
      {
        DATABASE_URL_DIRECT: env.DATABASE_URL_DIRECT.replace(
          "127.0.0.1",
          "provider.example",
        ),
      },
      { APP_ENV: "production" },
      { AUTH_MODE: "hosted-synthetic" },
    ]) {
      expect(() =>
        assertOwnedReadinessDatabase(root, { ...env, ...change }),
      ).toThrow(
        "Readiness mirror requires this checkout's owned local test database. Values omitted.",
      );
    }
    rmSync(path.join(root, ".local/postgres/learli-owned"));
    expect(() => assertOwnedReadinessDatabase(root, env)).toThrow(
      "Values omitted.",
    );
  });
});

function ciFixture() {
  const { root, env } = fixture();
  rmSync(path.join(root, ".local/database.json"));
  rmSync(path.join(root, ".local/postgres/learli-owned"));
  const state = {
    kind: "learli-disposable-ci-service",
    sourceRoot: realpathSync(root),
    ports: { database: 55919 },
    ownerPassword: "fictional-owner",
    appPassword: "fictional-app",
  };
  writeFileSync(
    path.join(root, ".local/ci-database.json"),
    JSON.stringify(state),
  );
  return { root, env: { ...env, CI: "true" }, state };
}
describe("disposable CI readiness ownership", () => {
  it("accepts only the exact CI-created checkout and matching test roles without a fake local cluster marker", () => {
    const { root, env } = ciFixture();
    expect(() => assertOwnedReadinessDatabase(root, env)).not.toThrow();
  });
  it("rejects absent CI mode, a copied receipt, wrong target, wrong kind and missing receipt", () => {
    const { root, env, state } = ciFixture();
    for (const change of [
      { CI: undefined },
      { DATABASE_URL: env.DATABASE_URL.replace("55919", "55908") },
    ]) {
      expect(() =>
        assertOwnedReadinessDatabase(root, { ...env, ...change }),
      ).toThrow("Values omitted.");
    }
    for (const change of [
      { sourceRoot: root + "-peer" },
      { kind: "unrecognized-service" },
    ]) {
      writeFileSync(
        path.join(root, ".local/ci-database.json"),
        JSON.stringify({ ...state, ...change }),
      );
      expect(() => assertOwnedReadinessDatabase(root, env)).toThrow(
        "Values omitted.",
      );
    }
    rmSync(path.join(root, ".local/ci-database.json"));
    expect(() => assertOwnedReadinessDatabase(root, env)).toThrow(
      "Values omitted.",
    );
  });
});
