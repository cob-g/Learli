import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { supportCases } from "./support";

/** Owner-provisioned local duties. Runtime cannot grant or revive staff. */
export const localWorkflowStaff = pgTable(
  "local_workflow_staff",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    capabilities: text("capabilities").array().notNull(),
    status: text("status").$type<"active" | "revoked">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "local_workflow_staff_shape",
      sql`${t.status} IN ('active','revoked') AND cardinality(${t.capabilities}) BETWEEN 1 AND 5 AND array_position(${t.capabilities},NULL) IS NULL AND ${t.capabilities} <@ ARRAY['admission','screening','booking','support','account']::text[]`,
    ),
  ],
);

/** Exact claim receipt; no private request payload or fabricated review evidence. */
export const localWorkflowClaims = pgTable(
  "local_workflow_claims",
  {
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    kind: text("kind").notNull(),
    targetId: text("target_id").notNull(),
    guardianCaseId: uuid("guardian_case_id").references(() => supportCases.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.actorUserId, t.requestId] }),
    check(
      "local_workflow_claim_shape",
      sql`${t.kind} IN ('admission','screening','booking','support','account') AND char_length(${t.targetId}) BETWEEN 1 AND 128 AND (${t.guardianCaseId} IS NULL OR ${t.kind}='admission')`,
    ),
  ],
);
