import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { learnerProfiles } from "./learners";
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
const source = () =>
  text("source")
    .$type<"synthetic_readiness" | "local_operation">()
    .notNull()
    .default("synthetic_readiness");
export const learnerAdmissionPolicies = pgTable(
  "learner_admission_policies",
  {
    id: uuid("id").primaryKey(),
    source: source(),
    authority: text("authority").notNull(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    marketCode: text("market_code").notNull(),
    contentDigest: text("content_digest").notNull(),
    noticeVersion: text("notice_version").notNull(),
    guardianProofMethod: text("guardian_proof_method").notNull(),
    independentEligibilityRule: text("independent_eligibility_rule").notNull(),
    reviewerCapabilityCode: text("reviewer_capability_code").notNull(),
    revocationEffect: text("revocation_effect").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    unique("learner_admission_policy_identity").on(
      t.id,
      t.source,
      t.marketCode,
    ),
    unique("learner_admission_policy_version").on(
      t.source,
      t.marketCode,
      t.version,
    ),
    unique("learner_admission_policy_receipt").on(
      t.id,
      t.version,
      t.reference,
      t.contentDigest,
    ),
    check(
      "learner_admission_policy_synthetic",
      sql`((${t.source}='synthetic_readiness' AND ${t.authority}='synthetic_test' AND ${t.version}='synthetic-admission-v1' AND ${t.reference}='synthetic:admission:v1' AND ${t.marketCode}='synthetic_test' AND ${t.noticeVersion}='synthetic-notice-v1' AND ${t.guardianProofMethod}='synthetic_guardian_review' AND ${t.independentEligibilityRule}='synthetic_independent_review' AND ${t.reviewerCapabilityCode}='learner_admission_review' AND ${t.revocationEffect}='deny_current_learner_access' AND ${t.contentDigest} ~ '^[a-f0-9]{64}$') OR (${t.source}='local_operation' AND ${t.authority}='local_operation' AND ${t.version}='local-admission-v1' AND ${t.reference}='local:admission:v1' AND ${t.marketCode}='local_operation' AND ${t.noticeVersion}='local-notice-v1' AND ${t.guardianProofMethod}='local_guardian_review' AND ${t.independentEligibilityRule}='local_independent_review' AND ${t.reviewerCapabilityCode}='learner_admission_review' AND ${t.revocationEffect}='deny_current_learner_access' AND ${t.contentDigest} ~ '^[a-f0-9]{64}$') OR (${t.id}='8a3658c1-773a-4533-81c6-49ff79870214'::uuid AND ${t.source}='local_operation' AND ${t.authority}='local_operation' AND ${t.version}='local-guardian-admission-v2' AND ${t.reference}='local:guardian-admission:v2' AND ${t.marketCode}='local_guardian_creation' AND ${t.noticeVersion}='local-guardian-notice-v2' AND ${t.guardianProofMethod}='parent_guardian_attestation' AND ${t.independentEligibilityRule}='local_independent_review' AND ${t.reviewerCapabilityCode}='learner_admission_review' AND ${t.revocationEffect}='deny_current_learner_access' AND ${t.contentDigest} ~ '^[a-f0-9]{64}$') OR (${t.id}='8a3658c1-773a-4533-81c6-49ff79870216'::uuid AND ${t.source}='local_operation' AND ${t.authority}='local_operation' AND ${t.version}='local-independent-admission-v2' AND ${t.reference}='local:independent-admission:v2' AND ${t.marketCode}='local_independent_creation' AND ${t.noticeVersion}='local-independent-notice-v2' AND ${t.guardianProofMethod}='local_guardian_review' AND ${t.independentEligibilityRule}='adult_independent_self_attestation' AND ${t.reviewerCapabilityCode}='learner_admission_review' AND ${t.revocationEffect}='deny_current_learner_access' AND ${t.contentDigest} ~ '^[a-f0-9]{64}$'))`,
    ),
  ],
);
export const learnerAdmissionPolicyState = pgTable(
  "learner_admission_policy_state",
  {
    source: source(),
    marketCode: text("market_code").notNull(),
    currentPolicyId: uuid("current_policy_id").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    revision: integer("revision").notNull().default(0),
    updatedAt: time("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.marketCode] }),
    check("learner_admission_policy_state_revision", sql`${t.revision}>=0`),
    foreignKey({
      name: "learner_admission_current_policy_fk",
      columns: [t.currentPolicyId, t.source, t.marketCode],
      foreignColumns: [
        learnerAdmissionPolicies.id,
        learnerAdmissionPolicies.source,
        learnerAdmissionPolicies.marketCode,
      ],
    }).onDelete("restrict"),
  ],
);
export type AdmissionState = "pending" | "authorized" | "rejected" | "revoked";
export const learnerAdmissions = pgTable(
  "learner_admissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id")
      .notNull()
      .unique()
      .references(() => learnerProfiles.id, { onDelete: "restrict" }),
    management: text("management").$type<"guardian" | "self">().notNull(),
    source: source(),
    policyId: uuid("policy_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    policyReference: text("policy_reference").notNull(),
    policyDigest: text("policy_digest").notNull(),
    requestId: uuid("request_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: text("state").$type<AdmissionState>().notNull().default("pending"),
    revision: integer("revision").notNull().default(0),
    selectionPath: text("selection_path"),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    unique("learner_admissions_request").on(t.requesterUserId, t.requestId),
    index("learner_admissions_requester_idx").on(
      t.requesterUserId,
      t.createdAt,
    ),
    foreignKey({
      name: "learner_admissions_policy_receipt_fk",
      columns: [t.policyId, t.policyVersion, t.policyReference, t.policyDigest],
      foreignColumns: [
        learnerAdmissionPolicies.id,
        learnerAdmissionPolicies.version,
        learnerAdmissionPolicies.reference,
        learnerAdmissionPolicies.contentDigest,
      ],
    }).onDelete("restrict"),
    check(
      "learner_admissions_shape",
      sql`${t.source} IN ('synthetic_readiness','local_operation') AND ${t.management} IN ('guardian','self') AND ${t.state} IN ('pending','authorized','rejected','revoked') AND ${t.revision}>=0 AND ${t.requestFingerprint} ~ '^[a-f0-9]{64}$' AND (${t.selectionPath} IS NULL OR char_length(${t.selectionPath})<=2048)`,
    ),
  ],
);
export const learnerAdmissionReviewers = pgTable(
  "learner_admission_reviewers",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    source: source(),
    capabilityCode: text("capability_code").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.source, t.capabilityCode] }),
    check(
      "learner_admission_reviewers_scope",
      sql`${t.source} IN ('synthetic_readiness','local_operation') AND ${t.capabilityCode}='learner_admission_review'`,
    ),
  ],
);
export const learnerAdmissionAssignments = pgTable(
  "learner_admission_assignments",
  {
    admissionId: uuid("admission_id")
      .primaryKey()
      .references(() => learnerAdmissions.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id").notNull(),
    source: source(),
    capabilityCode: text("capability_code").notNull(),
    revision: integer("revision").notNull().default(0),
    assignedAt: time("assigned_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    foreignKey({
      name: "learner_admission_assignment_scope_fk",
      columns: [t.reviewerUserId, t.source, t.capabilityCode],
      foreignColumns: [
        learnerAdmissionReviewers.userId,
        learnerAdmissionReviewers.source,
        learnerAdmissionReviewers.capabilityCode,
      ],
    }).onDelete("restrict"),
    check("learner_admission_assignments_revision", sql`${t.revision}>=0`),
  ],
);
export const learnerAdmissionEvidence = pgTable(
  "learner_admission_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => learnerAdmissions.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => learnerAdmissionPolicies.id, { onDelete: "restrict" }),
    source: source(),
    checkCode: text("check_code").notNull(),
    method: text("method").notNull(),
    noticeVersion: text("notice_version"),
    reference: text("reference").notNull(),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    recordedAt: time("recorded_at"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    unique("learner_admission_evidence_request").on(
      t.recordedByUserId,
      t.requestId,
    ),
    unique("learner_admission_evidence_reference").on(t.source, t.reference),
    index("learner_admission_evidence_admission_idx").on(t.admissionId),
    check(
      "learner_admission_evidence_shape",
      sql`${t.source} IN ('synthetic_readiness','local_operation') AND ${t.checkCode} IN ('guardian_authority','guardian_notice','independent_eligibility') AND ${t.reference} ~ '^[A-Za-z0-9:_-]{1,128}$' AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND ${t.subjectUserId}<>${t.recordedByUserId} AND (${t.revokedAt} IS NULL OR ${t.revokedAt}>=${t.recordedAt})`,
    ),
  ],
);
export const learnerAdmissionEvents = pgTable(
  "learner_admission_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => learnerAdmissions.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    event: text("event").notNull(),
    fromState: text("from_state").$type<AdmissionState>(),
    toState: text("to_state").$type<AdmissionState>().notNull(),
    revision: integer("revision").notNull(),
    policyId: uuid("policy_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    policyReference: text("policy_reference").notNull(),
    policyDigest: text("policy_digest").notNull(),
    evidenceId: uuid("evidence_id").references(
      () => learnerAdmissionEvidence.id,
      { onDelete: "restrict" },
    ),
    assignmentRevision: integer("assignment_revision"),
    createdAt: time("created_at"),
  },
  (t) => [
    unique("learner_admission_events_revision").on(t.admissionId, t.revision),
    unique("learner_admission_events_request").on(t.actorUserId, t.requestId),
    foreignKey({
      name: "learner_admission_events_policy_receipt_fk",
      columns: [t.policyId, t.policyVersion, t.policyReference, t.policyDigest],
      foreignColumns: [
        learnerAdmissionPolicies.id,
        learnerAdmissionPolicies.version,
        learnerAdmissionPolicies.reference,
        learnerAdmissionPolicies.contentDigest,
      ],
    }).onDelete("restrict"),
    check(
      "learner_admission_events_shape",
      sql`${t.revision}>=0 AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND (${t.event} IN ('guardian_profile_created','independent_profile_created','requested','evidence_recorded','evidence_revoked','authorized','rejected','revoked','assigned')) AND (${t.toState} IN ('pending','authorized','rejected','revoked')) AND ((${t.event}='requested' AND ${t.fromState} IS NULL AND ${t.toState}='pending' AND ${t.revision}=0) OR (${t.event} IN ('guardian_profile_created','independent_profile_created') AND ${t.fromState} IS NULL AND ${t.toState}='authorized' AND ${t.revision}=0) OR (${t.event} NOT IN ('requested','guardian_profile_created','independent_profile_created') AND ${t.fromState} IS NOT NULL AND ${t.revision}>0))`,
    ),
  ],
);

/** Immutable affirmative local guardian declaration; never staff review evidence. */
export const learnerGuardianAttestations = pgTable(
  "learner_guardian_attestations",
  {
    admissionId: uuid("admission_id")
      .primaryKey()
      .references(() => learnerAdmissions.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id")
      .notNull()
      .unique()
      .references(() => learnerProfiles.id, { onDelete: "restrict" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => learnerAdmissionPolicies.id, { onDelete: "restrict" }),
    policyVersion: text("policy_version").notNull(),
    policyDigest: text("policy_digest").notNull(),
    noticeVersion: text("notice_version").notNull(),
    requestId: uuid("request_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    guardianConfirmed: boolean("guardian_confirmed").notNull(),
    consentConfirmed: boolean("consent_confirmed").notNull(),
    source: text("source")
      .$type<"local_operation">()
      .notNull()
      .default("local_operation"),
    createdAt: time("created_at"),
  },
  (t) => [
    unique("learner_guardian_attestations_request").on(
      t.requesterUserId,
      t.requestId,
    ),
    check(
      "learner_guardian_attestations_shape",
      sql`${t.source}='local_operation' AND ${t.policyId}='8a3658c1-773a-4533-81c6-49ff79870214'::uuid AND ${t.policyVersion}='local-guardian-admission-v2' AND ${t.noticeVersion}='local-guardian-notice-v2' AND ${t.policyDigest} ~ '^[a-f0-9]{64}$' AND ${t.requestFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.guardianConfirmed} IS TRUE AND ${t.consentConfirmed} IS TRUE`,
    ),
  ],
);

/** Immutable local self-declaration. It records a claim, never verified age or identity proof. */
export const learnerIndependentAttestations = pgTable(
  "learner_independent_attestations",
  {
    admissionId: uuid("admission_id")
      .primaryKey()
      .references(() => learnerAdmissions.id, { onDelete: "restrict" }),
    learnerId: uuid("learner_id")
      .notNull()
      .unique()
      .references(() => learnerProfiles.id, { onDelete: "restrict" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => learnerAdmissionPolicies.id, { onDelete: "restrict" }),
    policyVersion: text("policy_version").notNull(),
    policyDigest: text("policy_digest").notNull(),
    noticeVersion: text("notice_version").notNull(),
    requestId: uuid("request_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    eligibilityDeclared: boolean("eligibility_declared").notNull(),
    verificationStatus: text("verification_status")
      .$type<"self_attested_unverified">()
      .notNull(),
    source: text("source")
      .$type<"local_operation">()
      .notNull()
      .default("local_operation"),
    createdAt: time("created_at"),
  },
  (t) => [
    unique("learner_independent_attestations_request").on(
      t.requesterUserId,
      t.requestId,
    ),
    check(
      "learner_independent_attestations_shape",
      sql`${t.source}='local_operation' AND ${t.policyId}='8a3658c1-773a-4533-81c6-49ff79870216'::uuid AND ${t.policyVersion}='local-independent-admission-v2' AND ${t.noticeVersion}='local-independent-notice-v2' AND ${t.policyDigest} ~ '^[a-f0-9]{64}$' AND ${t.requestFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.eligibilityDeclared} IS TRUE AND ${t.verificationStatus}='self_attested_unverified'`,
    ),
  ],
);
