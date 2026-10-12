import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  digest,
  parseJournal,
  validateHistory,
} from "../../scripts/staging-migrations/journal";
import { expectedGrant } from "../../scripts/staging-migrations/privileges";
import { planHash, planSchema } from "../../scripts/staging-migrations/runner";
const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
const files = Object.fromEntries(
  readdirSync("drizzle")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => [file, readFileSync(`drizzle/${file}`, "utf8")]),
);
const candidate = parseJournal(journal, files, digest("synthetic-source"));
describe("controlled staging journal and plan", () => {
  it("captures all17 exact ordered migration hashes and freezes SQL", () => {
    expect(candidate.entries).toHaveLength(17);
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
