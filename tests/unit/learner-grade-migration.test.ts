import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { expectedProtections } from "../../scripts/staging-migrations/protections";

describe("additive learner school-grade schema", () => {
  it("adds only nullable grade metadata and its constraint to the prior snapshot", () => {
    const old = JSON.parse(
      readFileSync("drizzle/meta/0033_snapshot.json", "utf8"),
    );
    const current = JSON.parse(
      readFileSync("drizzle/meta/0034_snapshot.json", "utf8"),
    );
    expect(current.prevId).toBe(old.id);
    expect(current.id).not.toBe(old.id);
    const tables = structuredClone(current.tables);
    expect(tables["public.learner_profiles"].columns.grade).toEqual({
      name: "grade",
      type: "integer",
      primaryKey: false,
      notNull: false,
    });
    expect(
      tables["public.learner_profiles"].checkConstraints.learner_profiles_grade,
    ).toBeDefined();
    delete tables["public.learner_profiles"].columns.grade;
    delete tables["public.learner_profiles"].checkConstraints
      .learner_profiles_grade;
    expect({ ...current, id: old.id, prevId: old.prevId, tables }).toEqual(old);
  });
  it("retains every historical function unchanged and adds exactly three explicit entry points", () => {
    const candidate = loadCandidate(process.cwd());
    const old = expectedProtections(
      candidate.entries.slice(0, 34).flatMap((e) => e.statements),
    );
    const current = expectedProtections(
      candidate.entries.slice(0, 35).flatMap((e) => e.statements),
    );
    expect(current.functions).toHaveLength(old.functions.length + 3);
    for (const fn of old.functions)
      expect(current.functions.find((f) => f.name === fn.name)).toEqual(fn);
    expect(current.triggers).toEqual(old.triggers);
    expect(
      current.functions
        .filter((f) => f.name.endsWith("_with_grade"))
        .map((f) => f.name)
        .sort(),
    ).toEqual([
      "create_learner_admission_with_grade",
      "create_local_learner_with_grade",
      "update_admitted_learner_with_grade",
    ]);
  });
});
