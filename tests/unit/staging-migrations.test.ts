import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  digest,
  parseJournal,
  validateHistory,
} from "../../scripts/staging-migrations/journal";
import { expectedGrant } from "../../scripts/staging-migrations/privileges";
import { expectedProtections } from "../../scripts/staging-migrations/protections";
import {
  expectedTables,
  planHash,
  planSchema,
} from "../../scripts/staging-migrations/runner";
const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
const files = Object.fromEntries(
  readdirSync("drizzle")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => [file, readFileSync(`drizzle/${file}`, "utf8")]),
);
const candidate = parseJournal(journal, files, digest("synthetic-source"));
describe("controlled staging journal and plan", () => {
  it("captures the reviewed ordered migration hashes and freezes SQL", () => {
    expect(candidate.entries).toHaveLength(22);
    expect(candidate.entries[0].hash).toBe(
      digest(files["0000_local_identity_foundation.sql"]),
    );
    expect(Object.isFrozen(candidate.entries[0].statements)).toBe(true);
    expect(Object.isFrozen(candidate)).toBe(true);
  });
  it.each(["idx", "when", "tag", "extra", "missing"])(
    "refuses journal/file divergence %s",
    (mode) => {
      const value = JSON.parse(journal),
        sql = { ...files };
      if (mode === "idx") value.entries[1].idx = 3;
      if (mode === "when") value.entries[1].when = value.entries[0].when;
      if (mode === "tag") value.entries[0].tag = "../../escape";
      if (mode === "extra") sql["0017_unknown.sql"] = "SELECT 1";
      if (mode === "missing") delete sql[value.entries[0].tag + ".sql"];
      expect(() =>
        parseJournal(JSON.stringify(value), sql, digest("source")),
      ).toThrow("candidate_invalid");
    },
  );
  it("binds changes in source and SQL to new candidate identity", () => {
    expect(
      parseJournal(journal, files, digest("different-source")).hash,
    ).not.toBe(candidate.hash);
    const tag = candidate.entries[16].tag + ".sql";
    expect(
      parseJournal(
        journal,
        { ...files, [tag]: files[tag] + "\n" },
        candidate.sourceHash,
      ).hash,
    ).not.toBe(candidate.hash);
  });
  it("accepts only full exact history prefixes", () => {
    const history = candidate.entries
      .slice(0, 16)
      .map(({ hash, when }) => ({ hash, when }));
    expect(validateHistory(candidate, history)).toHaveLength(16);
    expect(() =>
      validateHistory(candidate, [
        ...history,
        { hash: digest("unknown"), when: 9999999999999 },
      ]),
    ).toThrow("history_divergent");
    expect(() => validateHistory(candidate, history.slice(1))).toThrow(
      "history_divergent",
    );
    expect(() => validateHistory(candidate, [...history].reverse())).toThrow(
      "history_divergent",
    );
    expect(() =>
      validateHistory(candidate, [{ ...history[0], hash: digest("diverged") }]),
    ).toThrow("history_divergent");
  });
  it("hashes normalized strict plans and rejects arbitrary fields", () => {
    const plan = planSchema.parse({
      version: 1,
      targetHash: digest("target"),
      candidateHash: candidate.hash,
      history: [],
      schemaHash: digest("schema"),
      state: "empty",
      pending: candidate.entries.map((entry) => entry.hash),
    });
    expect(planHash({ ...plan })).toBe(planHash(plan));
    expect(planHash({ ...plan, targetHash: digest("changed") })).not.toBe(
      planHash(plan),
    );
    expect(() =>
      planSchema.parse({ ...plan, password: "forbidden" }),
    ).toThrow();
  });
  it("preserves broad auth rights and narrow protected column/function boundaries", () => {
    expect(expectedGrant("session", "token", "DELETE")).toBe(true);
    expect(expectedGrant("bookings", "state", "UPDATE")).toBe(true);
    expect(expectedGrant("bookings", "start_at_utc", "UPDATE")).toBe(false);
    expect(expectedGrant("subjects", "name_revision", "UPDATE")).toBe(false);
    expect(expectedGrant("booking_events", "created_at", "SELECT")).toBe(true);
    expect(expectedGrant("booking_events", "id", "DELETE")).toBe(false);
    expect(expectedGrant("user_access", "status", "UPDATE")).toBe(false);
    expect(expectedGrant("user_roles", "role", "INSERT")).toBe(false);
  });
});

describe("forward migration protection definitions", () => {
  const original =
    "CREATE FUNCTION protect() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;";
  const replacement =
    "CREATE OR REPLACE FUNCTION protect() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'blocked'; END; $$;";
  const trigger =
    "CREATE TRIGGER protect BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION protect();";
  it("retains the original reviewed protections for an older history prefix", () => {
    const result = expectedProtections(
      candidate.entries.slice(0, 17).flatMap((entry) => entry.statements),
    );
    expect(result.functions).toHaveLength(9);
    expect(result.triggers).toHaveLength(9);
    expect(
      result.triggers.every((item) => !item.constraint && !item.deferrable),
    ).toBe(true);
  });
  it("compares the latest replacement body and exact function settings", () => {
    const result = expectedProtections([original, replacement]);
    expect(result.functions).toEqual([
      {
        name: "protect",
        body: "BEGIN RAISE EXCEPTION 'blocked'; END;",
        language: "plpgsql",
        returns: "trigger",
        definer: true,
        searchPath: "pg_catalog",
      },
    ]);
  });
  it("includes the reviewed lifecycle replacement and deferred audit guard once", () => {
    const result = expectedProtections(
      candidate.entries.flatMap((entry) => entry.statements),
    );
    expect(result.functions).toHaveLength(24);
    expect(result.triggers).toHaveLength(21);
    expect(
      result.functions.filter((fn) => fn.name === "preserve_demo_booking"),
    ).toHaveLength(1);
    expect(
      result.functions.find((fn) => fn.name === "preserve_demo_booking")?.body,
    ).toContain("demo_cancelled");
    expect(
      result.triggers.find(
        (trigger) => trigger.name === "require_booking_lifecycle_event",
      ),
    ).toMatchObject({
      constraint: true,
      deferrable: true,
      deferred: true,
      type: 17,
    });
  });
  it("reconciles an explicit dropped trigger and retains deferred constraint semantics", () => {
    const result = expectedProtections([
      original,
      trigger,
      "DROP TRIGGER protect ON public.bookings;",
      "CREATE CONSTRAINT TRIGGER protect AFTER UPDATE ON public.bookings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION protect();",
    ]);
    expect(result.triggers).toEqual([
      {
        name: "protect",
        table: "bookings",
        function: "protect",
        type: 17,
        constraint: true,
        deferrable: true,
        deferred: true,
      },
    ]);
  });
  it.each([
    [original, original],
    [trigger, trigger],
    ["DROP TRIGGER missing ON bookings;"],
    ["DROP FUNCTION protect();"],
    ["ALTER TRIGGER protect ON bookings RENAME TO changed;"],
    [
      "CREATE TRIGGER protect BEFORE UPDATE ON bookings FOR EACH ROW WHEN (false) EXECUTE FUNCTION protect();",
    ],
    [
      "CREATE TRIGGER protect BEFORE UPDATE OF state ON bookings FOR EACH ROW EXECUTE FUNCTION protect();",
    ],
  ])(
    "rejects unsupported or inconsistent protection DDL %j",
    (...statements) => {
      expect(() => expectedProtections(statements)).toThrow(
        "candidate_invalid",
      );
    },
  );
});

describe("reviewed public table inventory", () => {
  it("keeps historical quoted and forward qualified tables in the same inventory", () => {
    expect(
      expectedTables([
        'CREATE TABLE "old_records" (id uuid);',
        "-- reviewed forward table\nCREATE TABLE public.new_records (id uuid);",
        'CREATE TABLE public."quoted_records" (id uuid);',
      ]),
    ).toEqual(["new_records", "old_records", "quoted_records"]);
  });
  it.each([
    "CREATE TABLE foreign_schema.records (id uuid);",
    "CREATE TABLE IF NOT EXISTS records (id uuid);",
    'CREATE TABLE "unexpected-name" (id uuid);',
  ])("rejects unsupported table declaration %s", (statement) => {
    expect(() => expectedTables([statement])).toThrow("candidate_invalid");
  });
  it("rejects duplicate table declarations across a candidate", () => {
    expect(() =>
      expectedTables([
        'CREATE TABLE "records" (id uuid);',
        "CREATE TABLE public.records (id uuid);",
      ]),
    ).toThrow("candidate_invalid");
  });
});
