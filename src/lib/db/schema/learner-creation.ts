import { sql } from "drizzle-orm";
import {
  check,
  index,
  foreignKey,
  unique,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { learnerProfiles } from "./learners";

// Immutable local creation origin and retry identity; never consent/guardian proof.
export const learnerCreationEvents = pgTable(
  "learner_creation_events",
  {
    actorUserId: text("actor_user_id").notNull(),
    requestId: uuid("request_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    learnerId: uuid("learner_id").notNull(),
    management: text("management").$type<"guardian" | "self">().notNull(),
    origin: text("origin")
      .$type<"local_creation">()
      .default("local_creation")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "learner_creation_events_pkey",
      columns: [table.actorUserId, table.requestId],
    }),
    unique("learner_creation_events_learner_id_key").on(table.learnerId),
    foreignKey({
      name: "learner_creation_events_actor_user_id_fkey",
      columns: [table.actorUserId],
      foreignColumns: [user.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "learner_creation_events_learner_id_fkey",
      columns: [table.learnerId],
      foreignColumns: [learnerProfiles.id],
    }).onDelete("restrict"),
    index("learner_creation_events_actor_idx").on(
      table.actorUserId,
      table.management,
    ),
    check(
      "learner_creation_events_fingerprint_check",
      sql`${table.fingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "learner_creation_events_management_check",
      sql`${table.management} IN ('guardian', 'self')`,
    ),
    check(
      "learner_creation_events_origin_check",
      sql`${table.origin} = 'local_creation'`,
    ),
  ],
);
