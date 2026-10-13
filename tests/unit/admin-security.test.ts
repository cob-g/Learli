import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  adminAssurancePredicate,
  ADMIN_ASSURANCE_SECONDS,
  ADMIN_FRESH_FACTOR_SECONDS,
} from "@/features/admin-security/assurance";
import { totpCode } from "../support/admin-mfa";
describe("administrator assurance contract", () => {
  it("binds both exact identifiers and a bounded age as SQL parameters", () => {
    const query = new PgDialect().sqlToQuery(
      adminAssurancePredicate("actor", "session", ADMIN_FRESH_FACTOR_SECONDS),
    );
    expect(query.sql).toContain("public.has_admin_assurance");
    expect(query.params).toEqual(["actor", "session", 300]);
  });
  it.each([0, -1, 28801, 1.5, Number.NaN])(
    "refuses an unsafe assurance age %s",
    (age) => expect(() => adminAssurancePredicate("u", "s", age)).toThrow(),
  );
  it("uses a bounded normal assurance lifetime", () =>
    expect(ADMIN_ASSURANCE_SECONDS).toBe(28800));
  it("generates the standard RFC6238 six-digit test proof", () =>
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000)).toBe("287082"));
});
