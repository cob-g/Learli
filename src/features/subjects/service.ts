import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { pgErrorCode, uniqueViolation } from "@/lib/db/errors";
import { auditEvents, subjects } from "@/lib/db/schema";
import { requireRole } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { slugify } from "./slug";

export const subjectNameInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} &+\-'().,/]*$/u),
});
export const subjectStateInput = z.strictObject({ isActive: z.boolean() });

const columns = {
  id: subjects.id,
  name: subjects.name,
  category: subjects.category,
  isActive: subjects.isActive,
};

/** The catalog is public reference data; callers decide what to show. */
export async function listSubjects(db: Database, activeOnly = false) {
  const query = db.select(columns).from(subjects);
  return activeOnly ? query.where(eq(subjects.isActive, true)) : query;
}

export async function listSubjectsForAdmin(
  runtime: AuthRuntime,
  headers: Headers,
) {
  await requireRole(runtime, headers, "admin");
  return listSubjects(runtime.db);
}

/** Admins add specialized subjects only; the core launch catalog is fixed. */
export async function createSpecializedSubject(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "admin");
  const { name } = subjectNameInput.parse(input);
  const base = slugify(name) || "subject";
  try {
    return await runtime.db.transaction(async (tx) => {
      const [taken] = await tx
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.slug, base));
      const [created] = await tx
        .insert(subjects)
        .values({
          name,
          slug: taken ? `${base}-${randomBytes(3).toString("hex")}` : base,
          category: "specialized",
        })
        .returning(columns);
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetSubjectId: created.id,
        action: "subject.created",
      });
      return created;
    });
  } catch (error) {
    if (pgErrorCode(error) === uniqueViolation)
      throw new RuleError(409, "A subject with that name already exists.");
    throw error;
  }
}

/** Deactivating keeps the row and every tutor offering that points at it. */
export async function setSubjectActive(
  runtime: AuthRuntime,
  headers: Headers,
  subjectId: string,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "admin");
  const { isActive } = subjectStateInput.parse(input);
  if (!z.uuid().safeParse(subjectId).success)
    throw new RuleError(404, "We can't find that subject.");
  return runtime.db.transaction(async (tx) => {
    const [changed] = await tx
      .update(subjects)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(subjects.id, subjectId), ne(subjects.isActive, isActive)))
      .returning(columns);
    if (changed) {
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetSubjectId: changed.id,
        action: isActive ? "subject.activated" : "subject.deactivated",
      });
      return changed;
    }
    // Already in the requested state: a repeated request is not an error.
    const [current] = await tx
      .select(columns)
      .from(subjects)
      .where(eq(subjects.id, subjectId));
    if (!current) throw new RuleError(404, "We can't find that subject.");
    return current;
  });
}
