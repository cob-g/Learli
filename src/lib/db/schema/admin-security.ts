import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  check,
  uuid,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";

export const adminSecurityEpochs = pgTable(
  "admin_security_epochs",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    epoch: integer("epoch").notNull().default(1),
  },
  (t) => [check("admin_security_epoch_positive", sql`${t.epoch} > 0`)],
);

export const adminAssuranceReceipts = pgTable(
  "admin_assurance_receipts",
  {
    sessionId: text("session_id")
      .primaryKey()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    factorId: text("factor_id").notNull(),
    epoch: integer("epoch").notNull(),
    roleGrantedAt: timestamp("role_granted_at", {
      withTimezone: true,
    }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    method: text("method").$type<"totp" | "backup_code">().notNull(),
  },
  (t) => [
    check("admin_assurance_epoch_positive", sql`${t.epoch} > 0`),
    check("admin_assurance_method", sql`${t.method} IN ('totp','backup_code')`),
  ],
);

export const adminSecurityEvents = pgTable(
  "admin_security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action")
      .$type<"factor_change_started" | "factor_verified">()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "admin_security_action",
      sql`${t.action} IN ('factor_change_started','factor_verified')`,
    ),
  ],
);
