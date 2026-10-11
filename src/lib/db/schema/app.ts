import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roles = ["student", "parent", "tutor", "admin"] as const;
export type Role = (typeof roles)[number];

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    check(
      "user_roles_allowed",
      sql`${table.role} IN ('student', 'parent', 'tutor', 'admin')`,
    ),
  ],
);

export const userAccess = pgTable(
  "user_access",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"active" | "suspended">()
      .default("active")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "user_access_status",
      sql`${table.status} IN ('active', 'suspended')`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action")
      .$type<"account.created" | "account.updated" | "fixture.roles_granted">()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "audit_action_allowed",
      sql`${table.action} IN ('account.created', 'account.updated', 'fixture.roles_granted')`,
    ),
  ],
);
