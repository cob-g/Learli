import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tutorProfiles } from "./app";
import { bookings, bookingLifecycleEvents } from "./bookings";

export const googleMeetConnections = pgTable(
  "tutor_google_meet_connections",
  {
    id: uuid("id").primaryKey(),
    tutorId: uuid("tutor_id")
      .notNull()
      .unique()
      .references(() => tutorProfiles.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    googleSubject: text("google_subject").notNull(),
    accountLabel: text("account_label").notNull(),
    fingerprint: text("fingerprint").notNull(),
    state: text("state")
      .$type<"active" | "reconnect" | "disconnected">()
      .notNull(),
    generation: integer("generation").notNull(),
    refreshCiphertext: text("refresh_ciphertext"),
    grantedScopes: text("granted_scopes").array().notNull(),
    consentVersion: text("consent_version")
      .notNull()
      .default("meet-future-bookings-v1"),
    consentAt: timestamp("consent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    busyToken: uuid("busy_token"),
    busyUntil: timestamp("busy_until", { withTimezone: true }),
  },
  (t) => [
    unique("meet_connection_tutor_identity").on(t.id, t.tutorId),
    check(
      "meet_connection_shape",
      sql`${t.state} IN ('active','reconnect','disconnected') AND ${t.generation}>0 AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND char_length(${t.googleSubject}) BETWEEN 1 AND 255 AND char_length(${t.accountLabel}) BETWEEN 1 AND 320 AND (${t.state}<>'active' OR ${t.refreshCiphertext} IS NOT NULL) AND (${t.state}<>'disconnected' OR ${t.refreshCiphertext} IS NULL) AND ${t.consentVersion}='meet-future-bookings-v1' AND isfinite(${t.consentAt})`,
    ),
    check(
      "meet_connection_busy",
      sql`(${t.busyToken} IS NULL AND ${t.busyUntil} IS NULL) OR (${t.busyToken} IS NOT NULL AND ${t.busyUntil} IS NOT NULL AND isfinite(${t.busyUntil}))`,
    ),
  ],
);

export const googleMeetOauthAttempts = pgTable(
  "google_meet_oauth_attempts",
  {
    stateHash: text("state_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    sessionId: text("session_id").notNull(),
    browserHash: text("browser_hash").notNull(),
    nonce: text("nonce").notNull(),
    verifierCiphertext: text("verifier_ciphertext").notNull(),
    fingerprint: text("fingerprint").notNull(),
    connectionId: uuid("connection_id").notNull(),
    expectedGeneration: integer("expected_generation").notNull(),
    replaceAccount: boolean("replace_account").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("meet_oauth_owner_time").on(t.userId, t.createdAt),
    check(
      "meet_oauth_shape",
      sql`${t.stateHash} ~ '^[a-f0-9]{64}$' AND ${t.browserHash} ~ '^[a-f0-9]{64}$' AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND ${t.expectedGeneration}>=0 AND isfinite(${t.createdAt}) AND isfinite(${t.expiresAt}) AND ${t.expiresAt}>${t.createdAt} AND (${t.consumedAt} IS NULL OR isfinite(${t.consumedAt}))`,
    ),
  ],
);

export type MeetJobState =
  | "pending"
  | "claimed"
  | "dispatched"
  | "uncertain"
  | "ready"
  | "suppressed"
  | "blocked";
export const googleMeetJobs = pgTable(
  "booking_meeting_provisioning",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "restrict" }),
    eventId: uuid("event_id")
      .notNull()
      .unique()
      .references(() => bookingLifecycleEvents.id, { onDelete: "restrict" }),
    tutorId: uuid("tutor_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    generation: integer("generation").notNull(),
    fingerprint: text("fingerprint").notNull(),
    state: text("state").$type<MeetJobState>().notNull().default("pending"),
    claimToken: uuid("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    spaceName: text("space_name"),
    meetingUri: text("meeting_uri"),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("meet_job_booking_identity").on(t.id, t.bookingId),
    foreignKey({
      name: "meet_job_connection_fk",
      columns: [t.connectionId, t.tutorId],
      foreignColumns: [googleMeetConnections.id, googleMeetConnections.tutorId],
    }).onDelete("restrict"),
    index("meet_job_claim_order").on(
      t.fingerprint,
      t.state,
      t.nextAttemptAt,
      t.createdAt,
    ),
    check(
      "meet_job_shape",
      sql`${t.state} IN ('pending','claimed','dispatched','uncertain','ready','suppressed','blocked') AND ${t.generation}>0 AND ${t.attempts} BETWEEN 0 AND 5 AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND isfinite(${t.createdAt}) AND isfinite(${t.nextAttemptAt}) AND (${t.claimUntil} IS NULL OR isfinite(${t.claimUntil})) AND (${t.dispatchedAt} IS NULL OR isfinite(${t.dispatchedAt}))`,
    ),
    check(
      "meet_job_receipt",
      sql`(${t.spaceName} IS NULL AND ${t.meetingUri} IS NULL) OR (${t.spaceName} IS NOT NULL AND ${t.meetingUri} IS NOT NULL AND ${t.spaceName} ~ '^spaces/[A-Za-z0-9_-]{1,128}$' AND ${t.meetingUri} ~ '^https://meet[.]google[.]com/[a-z]+-[a-z]+-[a-z]+$' AND char_length(${t.meetingUri})<=2048)`,
    ),
  ],
);
