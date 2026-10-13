import { afterEach, describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertPrivatePath,
  assertAllowedProvenance,
  assertProvenanceCoverage,
  assertTableInventory,
  acceptedTableInventory,
  syntheticProvenance,
  normalizeSchema,
  readSource,
  validateRestorePort,
  validateRunId,
  validateOwnedPostmaster,
} from "../../scripts/local-backup-restore";

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "learli-restore-unit-"));
  temporary.push(root);
  for (const directory of [".local", ".local/postgres", ".local/postgres/data"])
    mkdirSync(path.join(root, directory), { mode: 0o700 });
  const owner = "a".repeat(64),
    app = "b".repeat(64);
  const write = (file: string, value: string) =>
    writeFileSync(path.join(root, file), value, { mode: 0o600 });
  write(
    ".local/database.json",
    JSON.stringify({
      ports: { database: 55502 },
      ownerPassword: owner,
      appPassword: app,
    }),
  );
  write(".local/postgres/learli-owned", "Learli local development cluster\n");
  write(".local/postgres/data/postmaster.pid", "owned-placeholder");
  const env = `APP_ENV=test\nAUTH_MODE=local\nDATABASE_URL_DIRECT=postgresql://learli_owner:${owner}@127.0.0.1:55502/learli_test\nDATABASE_URL=postgresql://learli_app:${app}@127.0.0.1:55502/learli_test\n`;
  write(".env.test.local", env);
  return { root, env, write };
}
describe("local backup restoration boundaries", () => {
  it("covers every inspected source column and refuses omitted/new provenance contracts", () => {
    const columns = syntheticProvenance.map(([table, column]) => ({
      table,
      column,
    }));
    expect(() => assertProvenanceCoverage(columns)).not.toThrow();
    expect(() => assertProvenanceCoverage(columns.slice(1))).toThrow(
      "provenance-coverage",
    );
    expect(() =>
      assertProvenanceCoverage([
        ...columns,
        { table: "future_booking", column: "source" },
      ]),
    ).toThrow("provenance-coverage");
    expect(() =>
      assertAllowedProvenance("future_booking", "source", [
        "synthetic_readiness",
      ]),
    ).toThrow("provenance-coverage");
  });
  it.each(syntheticProvenance)(
    "accepts only the exact %s.%s synthetic provenance",
    (table, column, allowed) => {
      expect(() =>
        assertAllowedProvenance(table, column, [...allowed]),
      ).not.toThrow();
      for (const value of [
        "operational",
        "approved",
        "real_person",
        "unknown",
        "synthetic_other",
        "",
        "SYNTHETIC_READINESS",
        "synthetic_readiness ",
      ])
        expect(() => assertAllowedProvenance(table, column, [value])).toThrow(
          "synthetic-only",
        );
      if (!([...allowed] as (string | null)[]).includes(null))
        expect(() => assertAllowedProvenance(table, column, [null])).toThrow(
          "synthetic-only",
        );
    },
  );
  it("permits the accepted booking sources without promoting private reviews", () => {
    expect(() =>
      assertAllowedProvenance("bookings", "source", [
        "local_simulation",
        "synthetic_readiness",
      ]),
    ).not.toThrow();
    expect(() =>
      assertAllowedProvenance("private_booking_reviews", "source", [
        "synthetic_readiness",
      ]),
    ).toThrow();
    expect(() =>
      assertAllowedProvenance("learner_admissions", "source", [
        "local_fixture",
      ]),
    ).toThrow();
  });
  it("accepts only allocated review publication readiness provenance and keeps private source separate", () => {
    assertAllowedProvenance("publication_reviews", "source", [
      "synthetic_readiness",
    ]);
    assertAllowedProvenance("review_publication_policy_head", "source", [
      "synthetic_readiness",
    ]);
    for (const source of ["local_synthetic", "local_fixture", "operational"]) {
      expect(() =>
        assertAllowedProvenance("publication_reviews", "source", [source]),
      ).toThrow();
    }
    expect(() =>
      assertAllowedProvenance("private_booking_reviews", "source", [
        "synthetic_readiness",
      ]),
    ).toThrow();
  });
  it("derives exact accepted snapshot inventory and rejects missing/replaced/extra tables", () => {
    const expected = acceptedTableInventory(process.cwd());
    expect(expected).toContain("drizzle.__drizzle_migrations");
    expect(expected).toContain("public.learner_admission_evidence");
    expect(expected).toContain("public.tutor_screening_decision_checks");
    expect(expected).toContain("public.booking_workflow_notice_intents");
    expect(() =>
      assertTableInventory(expected, [...expected].reverse()),
    ).not.toThrow();
    for (const actual of [
      expected.slice(1),
      [...expected, "public.unrecognized"],
      ["public.replaced", ...expected.slice(1)],
    ])
      expect(() => assertTableInventory(expected, actual)).toThrow(
        "table-inventory",
      );
  });
  it("requires matching private postmaster and live process identity before stop", () => {
    const data = "/owned/new-target/data",
      port = 55512,
      token = "learli_restore_unique";
    const pid = `12345\n${data}\n1700000000\n${port}\n\n127.0.0.1\n0\nready\n`;
    const command = `/usr/local/bin/postgres -D ${data} -h 127.0.0.1 -p ${port} -c cluster_name=${token}\n`;
    expect(validateOwnedPostmaster(pid, command, data, port, token)).toBe(
      12345,
    );
    for (const changed of [
      pid.replace("12345", "-1"),
      pid.replace(data, "/foreign/data"),
      pid.replace("55512", "55502"),
      pid.replace("127.0.0.1", "0.0.0.0"),
    ])
      expect(() =>
        validateOwnedPostmaster(changed, command, data, port, token),
      ).toThrow("stop-identity");
    for (const changed of [
      command.replace(token, "foreign"),
      command.replace(data, "/foreign/data"),
      "unrelated-process",
    ])
      expect(() =>
        validateOwnedPostmaster(pid, changed, data, port, token),
      ).toThrow("stop-identity");
  });
  it.each([
    "../main",
    "/tmp/target",
    "a/b",
    "hello world",
    "-option",
    "x".repeat(65),
    "",
  ])("rejects unsafe target id %s", (value) =>
    expect(() => validateRunId(value)).toThrow(),
  );
  it.each([55502, 0, 1023, 65536, 55512.5, NaN])(
    "rejects unsafe or source-equal port %s",
    (value) => expect(() => validateRestorePort(value, 55502)).toThrow(),
  );
  it("accepts a distinct bounded port and simple new target id", () => {
    expect(validateRestorePort(55512, 55502)).toBe(55512);
    expect(validateRunId("drill-123")).toBe("drill-123");
  });
  it("reads only exact owned test configuration", () => {
    const { root } = fixture();
    expect(readSource(root).config.port).toBe(55502);
  });
  it.each([
    ["APP_ENV=test", "APP_ENV=production"],
    ["AUTH_MODE=local", "AUTH_MODE=hosted"],
    ["127.0.0.1", "production.example"],
    ["/learli_test", "/learli_dev"],
    ["55502", "55432"],
    ["/learli_test", "/learli_test?host=remote"],
    ["learli_owner", "learli_app"],
    ["a".repeat(64), "c".repeat(64)],
  ])("refuses changed source boundary %s", (from, to) => {
    const { root, env, write } = fixture();
    write(".env.test.local", env.replaceAll(from, to));
    expect(() => readSource(root)).toThrow();
  });
  it("rejects a missing or forged ownership marker", () => {
    const { root, write } = fixture();
    write(".local/postgres/learli-owned", "another checkout");
    expect(() => readSource(root)).toThrow();
  });
  it("rejects shared-readable credentials", () => {
    const { root } = fixture();
    chmodSync(path.join(root, ".env.test.local"), 0o644);
    expect(() => readSource(root)).toThrow();
  });
  it("rejects symlink traversal and out-of-root artifacts", () => {
    const { root } = fixture();
    symlinkSync(
      path.join(root, ".local/postgres/data"),
      path.join(root, ".local/alias"),
    );
    expect(() =>
      assertPrivatePath(root, path.join(root, ".local/alias/postmaster.pid")),
    ).toThrow();
    expect(() =>
      assertPrivatePath(root, path.join(root, "../elsewhere")),
    ).toThrow();
  });
  it("normalizes only dump comments and restriction keys, preserving grants/constraints", () => {
    const source =
      "-- version\n\\restrict one\nCREATE TABLE x(id int CHECK(id>0));\nGRANT SELECT ON x TO learli_app;\n\\unrestrict one\n";
    expect(normalizeSchema(source)).toBe(
      normalizeSchema(source.replaceAll("one", "two")),
    );
    expect(normalizeSchema(source)).not.toBe(
      normalizeSchema(source.replace("GRANT SELECT", "GRANT UPDATE")),
    );
  });
});
