CREATE TABLE "tutor_screening_assignments" (
	"tutor_id" uuid PRIMARY KEY NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"provenance" text NOT NULL,
	"status" text NOT NULL,
	"assignment_revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screening_assignment_revision" CHECK ("tutor_screening_assignments"."assignment_revision">=0 AND "tutor_screening_assignments"."status" IN ('authorized','revoked'))
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_cases" (
	"tutor_id" uuid PRIMARY KEY NOT NULL,
	"provenance" text NOT NULL,
	"policy_version" text NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"current_decision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screening_case_source" CHECK ("tutor_screening_cases"."provenance"='synthetic_readiness'),
	CONSTRAINT "screening_case_revision" CHECK ("tutor_screening_cases"."round">=1 AND "tutor_screening_cases"."revision">=0),
	CONSTRAINT "screening_case_state" CHECK ("tutor_screening_cases"."state" IN ('pending','approved','rejected','suspended','revoked'))
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"provenance" text NOT NULL,
	"policy_version" text NOT NULL,
	"round" integer NOT NULL,
	"expected_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"actor_user_id" text NOT NULL,
	"assignment_revision" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"check_code" text NOT NULL,
	"outcome" text NOT NULL,
	"evidence_reference" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "screening_check_revision" UNIQUE("tutor_id","revision"),
	CONSTRAINT "screening_check_request" UNIQUE("actor_user_id","request_key"),
	CONSTRAINT "screening_check_shape" CHECK ("tutor_screening_checks"."revision"="tutor_screening_checks"."expected_revision"+1 AND "tutor_screening_checks"."expected_revision">=0 AND "tutor_screening_checks"."round">0 AND "tutor_screening_checks"."assignment_revision">=0 AND "tutor_screening_checks"."outcome" IN ('passed','failed','revoked') AND "tutor_screening_checks"."check_code" ~ '^[a-z][a-z0-9_]{0,47}$' AND "tutor_screening_checks"."evidence_reference" ~ '^screening:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND isfinite("tutor_screening_checks"."checked_at") AND isfinite("tutor_screening_checks"."expires_at") AND "tutor_screening_checks"."expires_at">"tutor_screening_checks"."checked_at")
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_decision_checks" (
	"decision_id" uuid NOT NULL,
	"check_code" text NOT NULL,
	"check_id" uuid NOT NULL,
	CONSTRAINT "tutor_screening_decision_checks_decision_id_check_code_pk" PRIMARY KEY("decision_id","check_code")
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"provenance" text NOT NULL,
	"policy_version" text NOT NULL,
	"round" integer NOT NULL,
	"expected_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"actor_user_id" text NOT NULL,
	"assignment_revision" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "screening_decision_revision" UNIQUE("tutor_id","revision"),
	CONSTRAINT "screening_decision_request" UNIQUE("actor_user_id","request_key"),
	CONSTRAINT "screening_decision_shape" CHECK ("tutor_screening_decisions"."revision"="tutor_screening_decisions"."expected_revision"+1 AND "tutor_screening_decisions"."expected_revision">=0 AND "tutor_screening_decisions"."round">0 AND "tutor_screening_decisions"."assignment_revision">=0 AND "tutor_screening_decisions"."action" IN ('approve','reject','suspend','reinstate','reopen','revoke'))
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"revision" integer,
	"kind" text NOT NULL,
	"actor_user_id" text,
	"request_key" uuid,
	"check_id" uuid,
	"decision_id" uuid,
	"assignment_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screening_event_shape" CHECK ((("tutor_screening_events"."kind"='check' AND "tutor_screening_events"."check_id" IS NOT NULL AND "tutor_screening_events"."decision_id" IS NULL AND "tutor_screening_events"."revision">0 AND "tutor_screening_events"."actor_user_id" IS NOT NULL AND "tutor_screening_events"."request_key" IS NOT NULL) OR ("tutor_screening_events"."kind"='decision' AND "tutor_screening_events"."decision_id" IS NOT NULL AND "tutor_screening_events"."check_id" IS NULL AND "tutor_screening_events"."revision">0 AND "tutor_screening_events"."actor_user_id" IS NOT NULL AND "tutor_screening_events"."request_key" IS NOT NULL) OR ("tutor_screening_events"."kind" IN ('request','assignment','revocation') AND "tutor_screening_events"."check_id" IS NULL AND "tutor_screening_events"."decision_id" IS NULL)) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_policies" (
	"provenance" text NOT NULL,
	"version" text NOT NULL,
	"reference" text NOT NULL,
	"authority_reference" text NOT NULL,
	"required_check_codes" text[] NOT NULL,
	"allowed_actions" text[] NOT NULL,
	"expiry_rule" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	CONSTRAINT "tutor_screening_policies_provenance_version_pk" PRIMARY KEY("provenance","version"),
	CONSTRAINT "screening_policy_source" CHECK ("tutor_screening_policies"."provenance"='synthetic_readiness'),
	CONSTRAINT "screening_policy_window" CHECK (isfinite("tutor_screening_policies"."valid_from") AND isfinite("tutor_screening_policies"."valid_until") AND "tutor_screening_policies"."valid_until">"tutor_screening_policies"."valid_from"),
	CONSTRAINT "screening_policy_codes" CHECK (cardinality("tutor_screening_policies"."required_check_codes") BETWEEN 1 AND 20 AND array_position("tutor_screening_policies"."required_check_codes",NULL) IS NULL),
	CONSTRAINT "screening_policy_actions" CHECK (cardinality("tutor_screening_policies"."allowed_actions") BETWEEN 1 AND 6 AND "tutor_screening_policies"."allowed_actions" <@ ARRAY['approve','reject','suspend','reinstate','reopen','revoke']::text[] AND "tutor_screening_policies"."expiry_rule"='all_checks_current')
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_policy_heads" (
	"provenance" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "screening_head_status" CHECK ("tutor_screening_policy_heads"."status" IN ('enabled','revoked'))
);
--> statement-breakpoint
CREATE TABLE "tutor_screening_staff" (
	"user_id" text NOT NULL,
	"provenance" text NOT NULL,
	"status" text NOT NULL,
	"capability" text DEFAULT 'screening_reviewer' NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	CONSTRAINT "tutor_screening_staff_user_id_provenance_pk" PRIMARY KEY("user_id","provenance"),
	CONSTRAINT "screening_staff_source" CHECK ("tutor_screening_staff"."provenance" IN ('local_fixture','synthetic_readiness')),
	CONSTRAINT "screening_staff_status" CHECK ("tutor_screening_staff"."status" IN ('authorized','revoked') AND "tutor_screening_staff"."capability"='screening_reviewer' AND isfinite("tutor_screening_staff"."valid_until"))
);
--> statement-breakpoint
CREATE TABLE "support_case_responses" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"provenance" text NOT NULL,
	"policy_version" text NOT NULL,
	"assignment_revision" integer,
	"acknowledged_assignment_revision" integer,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"escalation_requested_at" timestamp with time zone,
	"escalation_target_user_id" text,
	"response_cycle" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "response_state_shape" CHECK (("support_case_responses"."provenance"='synthetic_readiness' AND "support_case_responses"."response_cycle">=1 AND ("support_case_responses"."assignment_revision" IS NULL OR "support_case_responses"."assignment_revision">0) AND (("support_case_responses"."acknowledged_at" IS NULL AND "support_case_responses"."acknowledged_by" IS NULL AND "support_case_responses"."acknowledged_assignment_revision" IS NULL) OR ("support_case_responses"."acknowledged_at" IS NOT NULL AND isfinite("support_case_responses"."acknowledged_at") AND "support_case_responses"."acknowledged_by" IS NOT NULL AND "support_case_responses"."acknowledged_assignment_revision"="support_case_responses"."assignment_revision")) AND (("support_case_responses"."escalation_requested_at" IS NULL AND "support_case_responses"."escalation_target_user_id" IS NULL) OR (isfinite("support_case_responses"."escalation_requested_at") AND "support_case_responses"."escalation_target_user_id" IS NOT NULL AND "support_case_responses"."acknowledged_at" IS NOT NULL))) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "support_response_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"expected_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"provenance" text NOT NULL,
	"policy_version" text NOT NULL,
	"response_cycle" integer NOT NULL,
	"assignment_revision" integer,
	"target_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_event_request" UNIQUE("actor_user_id","request_key"),
	CONSTRAINT "response_event_revision" UNIQUE("case_id","revision"),
	CONSTRAINT "response_event_shape" CHECK ("support_response_events"."provenance"='synthetic_readiness' AND "support_response_events"."response_cycle">=1 AND (("support_response_events"."action"='intake' AND "support_response_events"."expected_revision"=0 AND "support_response_events"."revision"=0) OR ("support_response_events"."action" IN ('acknowledge','request_escalation','assign','reassign','escalate','close','reopen') AND "support_response_events"."expected_revision">=0 AND "support_response_events"."revision"="support_response_events"."expected_revision"+1)))
);
--> statement-breakpoint
CREATE TABLE "support_response_policies" (
	"provenance" text NOT NULL,
	"version" text NOT NULL,
	"reference" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"responsible_owner_id" text NOT NULL,
	"escalation_owner_id" text NOT NULL,
	"reporting_guidance_reference" text NOT NULL,
	"meeting_guidance_reference" text NOT NULL,
	"allowed_actions" text[] NOT NULL,
	"reason_codes" text[] NOT NULL,
	CONSTRAINT "support_response_policies_provenance_version_pk" PRIMARY KEY("provenance","version"),
	CONSTRAINT "response_policy_source" CHECK ("support_response_policies"."provenance"='synthetic_readiness'),
	CONSTRAINT "response_policy_window" CHECK (isfinite("support_response_policies"."valid_from") AND isfinite("support_response_policies"."valid_until") AND "support_response_policies"."valid_until">"support_response_policies"."valid_from" AND "support_response_policies"."responsible_owner_id"<>"support_response_policies"."escalation_owner_id"),
	CONSTRAINT "response_policy_actions" CHECK (cardinality("support_response_policies"."allowed_actions") BETWEEN 1 AND 10 AND "support_response_policies"."allowed_actions" <@ ARRAY['intake','assign','reassign','acknowledge','request_escalation','escalate','close','reopen','restrict','restore']::text[] AND "support_response_policies"."reason_codes" <@ ARRAY['synthetic_safety_restrict','synthetic_safety_restore']::text[])
);
--> statement-breakpoint
CREATE TABLE "support_response_policy_heads" (
	"provenance" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "response_head_status" CHECK ("support_response_policy_heads"."status" IN ('enabled','revoked'))
);
--> statement-breakpoint
ALTER TABLE "support_case_events" DROP CONSTRAINT "support_case_events_shape";--> statement-breakpoint
ALTER TABLE "support_cases" DROP CONSTRAINT "support_cases_source";--> statement-breakpoint
ALTER TABLE "support_reviewers" DROP CONSTRAINT "support_reviewers_source";--> statement-breakpoint
ALTER TABLE "account_restriction_events" DROP CONSTRAINT "account_restriction_events_shape";--> statement-breakpoint
ALTER TABLE "account_restriction_targets" DROP CONSTRAINT "account_restriction_targets_source";--> statement-breakpoint
ALTER TABLE "support_dispatch_grant_events" DROP CONSTRAINT "support_dispatch_grant_events_kind_check";--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" DROP CONSTRAINT "support_dispatch_grants_source_check";--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" DROP CONSTRAINT "support_reviewer_choices_source_check";--> statement-breakpoint
ALTER TABLE "support_reviewer_events" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_reviewer_events" ADD COLUMN "tooling_actor_id" text;--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD COLUMN "policy_provenance" text;--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD COLUMN "policy_version" text;--> statement-breakpoint
ALTER TABLE "account_restriction_grant_events" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_restriction_grant_events" ADD COLUMN "permitted_actions" text[];--> statement-breakpoint
ALTER TABLE "account_restriction_grant_events" ADD COLUMN "tooling_actor_id" text;--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD COLUMN "source" text DEFAULT 'local_fixture' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD COLUMN "permitted_actions" text[];--> statement-breakpoint
ALTER TABLE "support_dispatch_grant_events" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_dispatch_grant_events" ADD COLUMN "can_escalate" boolean;--> statement-breakpoint
ALTER TABLE "support_dispatch_grant_events" ADD COLUMN "tooling_actor_id" text;--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD COLUMN "can_escalate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_screening_assignments" ADD CONSTRAINT "tutor_screening_assignments_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_assignments" ADD CONSTRAINT "tutor_screening_assignments_reviewer_user_id_provenance_tutor_screening_staff_user_id_provenance_fk" FOREIGN KEY ("reviewer_user_id","provenance") REFERENCES "public"."tutor_screening_staff"("user_id","provenance") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_cases" ADD CONSTRAINT "tutor_screening_cases_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_cases" ADD CONSTRAINT "tutor_screening_cases_current_decision_id_tutor_screening_decisions_id_fk" FOREIGN KEY ("current_decision_id") REFERENCES "public"."tutor_screening_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_cases" ADD CONSTRAINT "tutor_screening_cases_provenance_policy_version_tutor_screening_policies_provenance_version_fk" FOREIGN KEY ("provenance","policy_version") REFERENCES "public"."tutor_screening_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_checks" ADD CONSTRAINT "tutor_screening_checks_tutor_id_tutor_screening_cases_tutor_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_screening_cases"("tutor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_checks" ADD CONSTRAINT "tutor_screening_checks_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_checks" ADD CONSTRAINT "tutor_screening_checks_provenance_policy_version_tutor_screening_policies_provenance_version_fk" FOREIGN KEY ("provenance","policy_version") REFERENCES "public"."tutor_screening_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_decision_checks" ADD CONSTRAINT "tutor_screening_decision_checks_decision_id_tutor_screening_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."tutor_screening_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_decision_checks" ADD CONSTRAINT "tutor_screening_decision_checks_check_id_tutor_screening_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."tutor_screening_checks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_decisions" ADD CONSTRAINT "tutor_screening_decisions_tutor_id_tutor_screening_cases_tutor_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_screening_cases"("tutor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_decisions" ADD CONSTRAINT "tutor_screening_decisions_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_decisions" ADD CONSTRAINT "tutor_screening_decisions_provenance_policy_version_tutor_screening_policies_provenance_version_fk" FOREIGN KEY ("provenance","policy_version") REFERENCES "public"."tutor_screening_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_events" ADD CONSTRAINT "tutor_screening_events_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_events" ADD CONSTRAINT "tutor_screening_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_events" ADD CONSTRAINT "tutor_screening_events_check_id_tutor_screening_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."tutor_screening_checks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_events" ADD CONSTRAINT "tutor_screening_events_decision_id_tutor_screening_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."tutor_screening_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_policy_heads" ADD CONSTRAINT "tutor_screening_policy_heads_provenance_version_tutor_screening_policies_provenance_version_fk" FOREIGN KEY ("provenance","version") REFERENCES "public"."tutor_screening_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" ADD CONSTRAINT "tutor_screening_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_responses" ADD CONSTRAINT "support_case_responses_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_responses" ADD CONSTRAINT "support_case_responses_acknowledged_by_support_reviewers_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_responses" ADD CONSTRAINT "support_case_responses_escalation_target_user_id_support_reviewers_user_id_fk" FOREIGN KEY ("escalation_target_user_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_responses" ADD CONSTRAINT "support_case_responses_provenance_policy_version_support_response_policies_provenance_version_fk" FOREIGN KEY ("provenance","policy_version") REFERENCES "public"."support_response_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_events" ADD CONSTRAINT "support_response_events_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_events" ADD CONSTRAINT "support_response_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_events" ADD CONSTRAINT "support_response_events_target_user_id_support_reviewers_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_events" ADD CONSTRAINT "support_response_events_provenance_policy_version_support_response_policies_provenance_version_fk" FOREIGN KEY ("provenance","policy_version") REFERENCES "public"."support_response_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_policies" ADD CONSTRAINT "support_response_policies_responsible_owner_id_support_reviewers_user_id_fk" FOREIGN KEY ("responsible_owner_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_policies" ADD CONSTRAINT "support_response_policies_escalation_owner_id_support_reviewers_user_id_fk" FOREIGN KEY ("escalation_owner_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_response_policy_heads" ADD CONSTRAINT "support_response_policy_heads_provenance_version_support_response_policies_provenance_version_fk" FOREIGN KEY ("provenance","version") REFERENCES "public"."support_response_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "account_restriction_events_policy_provenance_policy_version_support_response_policies_provenance_version_fk" FOREIGN KEY ("policy_provenance","policy_version") REFERENCES "public"."support_response_policies"("provenance","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_shape" CHECK ((
    ("support_case_events"."action" = 'created' AND "support_case_events"."revision" = 0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" = 'open' AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL)
    OR ("support_case_events"."action" IN ('assigned','reassigned') AND "support_case_events"."revision" > 0 AND "support_case_events"."actor_user_id" IS NULL AND "support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" IS NULL AND "support_case_events"."next_reviewer_id" IS NOT NULL AND (("support_case_events"."action" = 'assigned' AND "support_case_events"."previous_reviewer_id" IS NULL) OR ("support_case_events"."action" = 'reassigned' AND "support_case_events"."previous_reviewer_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" <> "support_case_events"."next_reviewer_id")))
    OR ("support_case_events"."action"='acknowledged' AND "support_case_events"."revision">0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL AND (("support_case_events"."previous_status"='open' AND "support_case_events"."next_status"='in_review') OR ("support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" IS NULL)))
    OR ("support_case_events"."action"='escalation_requested' AND "support_case_events"."revision">0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL AND "support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" IS NULL)
    OR ("support_case_events"."action" = 'status_changed' AND "support_case_events"."revision" > 0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL AND (("support_case_events"."previous_status" = 'open' AND "support_case_events"."next_status" = 'in_review') OR ("support_case_events"."previous_status" = 'in_review' AND "support_case_events"."next_status" = 'closed') OR ("support_case_events"."previous_status" = 'closed' AND "support_case_events"."next_status" = 'in_review')))
  ) IS TRUE);--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_source" CHECK ("support_cases"."source" IN ('local_synthetic','synthetic_readiness'));--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD CONSTRAINT "support_reviewers_expiry" CHECK (("support_reviewers"."source"='local_fixture' AND "support_reviewers"."valid_until" IS NULL) OR ("support_reviewers"."source"='synthetic_readiness' AND "support_reviewers"."valid_until" IS NOT NULL AND isfinite("support_reviewers"."valid_until")));--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD CONSTRAINT "support_reviewers_source" CHECK ("support_reviewers"."source" IN ('local_fixture','synthetic_readiness'));--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "restriction_event_policy_receipt" CHECK ((("account_restriction_events"."reason" IN ('synthetic_safety_restrict','synthetic_safety_restore') AND "account_restriction_events"."policy_provenance"='synthetic_readiness' AND "account_restriction_events"."policy_version" IS NOT NULL) OR ("account_restriction_events"."reason" IN ('local_access_test','local_review_test','local_restore_test') AND "account_restriction_events"."policy_provenance" IS NULL AND "account_restriction_events"."policy_version" IS NULL)) IS TRUE);--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "account_restriction_events_shape" CHECK ((("account_restriction_events"."previous_status" = 'active' AND "account_restriction_events"."next_status" = 'suspended' AND "account_restriction_events"."reason" IN ('local_access_test','local_review_test','synthetic_safety_restrict')) OR ("account_restriction_events"."previous_status" = 'suspended' AND "account_restriction_events"."next_status" = 'active' AND "account_restriction_events"."reason" IN ('local_restore_test','synthetic_safety_restore'))) IS TRUE);--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD CONSTRAINT "account_restriction_grants_source" CHECK (("account_restriction_grants"."source"='local_fixture' AND "account_restriction_grants"."valid_until" IS NULL AND "account_restriction_grants"."permitted_actions" IS NULL) OR ("account_restriction_grants"."source"='synthetic_readiness' AND "account_restriction_grants"."valid_until" IS NOT NULL AND isfinite("account_restriction_grants"."valid_until") AND cardinality("account_restriction_grants"."permitted_actions") BETWEEN 1 AND 2 AND "account_restriction_grants"."permitted_actions" <@ ARRAY['restrict','restore']::text[]));--> statement-breakpoint
ALTER TABLE "account_restriction_targets" ADD CONSTRAINT "account_restriction_targets_source" CHECK ("account_restriction_targets"."source" IN ('local_fixture','synthetic_readiness'));--> statement-breakpoint
ALTER TABLE "support_dispatch_grant_events" ADD CONSTRAINT "support_dispatch_grant_events_kind_check" CHECK ("support_dispatch_grant_events"."kind" IN ('dispatcher','reviewer_choice','escalation_choice'));--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" ADD CONSTRAINT "support_dispatch_grants_expiry" CHECK (("support_dispatch_grants"."source"='local_fixture' AND "support_dispatch_grants"."valid_until" IS NULL) OR ("support_dispatch_grants"."source"='synthetic_readiness' AND "support_dispatch_grants"."valid_until" IS NOT NULL AND isfinite("support_dispatch_grants"."valid_until")));--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" ADD CONSTRAINT "support_dispatch_grants_source_check" CHECK ("support_dispatch_grants"."source" IN ('local_fixture','synthetic_readiness'));--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD CONSTRAINT "support_reviewer_choices_expiry" CHECK (("support_reviewer_choices"."source"='local_fixture' AND "support_reviewer_choices"."valid_until" IS NULL) OR ("support_reviewer_choices"."source"='synthetic_readiness' AND "support_reviewer_choices"."valid_until" IS NOT NULL AND isfinite("support_reviewer_choices"."valid_until")));--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD CONSTRAINT "support_reviewer_choices_source_check" CHECK ("support_reviewer_choices"."source" IN ('local_fixture','synthetic_readiness'));
--> statement-breakpoint
-- Positive decisions bind exact latest receipts; an enrolled tutor never falls back to demo.
CREATE FUNCTION public.has_current_tutor_screening(p_tutor uuid,p_scope text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (p_scope IS NOT DISTINCT FROM 'local_demo' AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=p_tutor) AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases sc WHERE sc.tutor_id=p_tutor)) OR p_scope IS NOT DISTINCT FROM 'synthetic_readiness' AND EXISTS (
 SELECT 1 FROM public.tutor_screening_cases c
 JOIN public.tutor_screening_policy_heads h ON h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled'
 JOIN public.tutor_screening_policies p ON p.provenance=h.provenance AND p.version=h.version
 JOIN public.tutor_screening_decisions d ON d.id=c.current_decision_id AND d.tutor_id=c.tutor_id AND d.round=c.round AND d.policy_version=c.policy_version AND d.provenance=c.provenance AND d.action IN ('approve','reinstate')
 WHERE c.tutor_id=p_tutor AND c.state='approved' AND c.provenance='synthetic_readiness' AND p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp()
 AND NOT EXISTS (SELECT 1 FROM unnest(p.required_check_codes) code WHERE NOT EXISTS (
 SELECT 1 FROM public.tutor_screening_checks ck JOIN public.tutor_screening_decision_checks dc ON dc.check_id=ck.id AND dc.check_code=code AND dc.decision_id=d.id
 WHERE ck.tutor_id=c.tutor_id AND ck.provenance=c.provenance AND ck.policy_version=c.policy_version AND ck.round=c.round AND ck.check_code=code AND ck.outcome='passed' AND ck.checked_at<=clock_timestamp() AND ck.expires_at>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer WHERE newer.tutor_id=ck.tutor_id AND newer.round=ck.round AND newer.check_code=ck.check_code AND newer.revision>ck.revision)))
 ); $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_current_tutor_screening(uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.has_tutor_screening_authority(p_actor text,p_session text,p_tutor uuid,p_source text) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT public.has_admin_assurance(p_actor,p_session,28800) AND EXISTS (
 SELECT 1 FROM public.tutor_screening_assignments a JOIN public.tutor_screening_staff st ON st.user_id=a.reviewer_user_id AND st.provenance=a.provenance JOIN public.tutor_profiles t ON t.id=a.tutor_id
 WHERE a.tutor_id=p_tutor AND a.reviewer_user_id=p_actor AND a.status='authorized' AND a.provenance=p_source AND st.status='authorized' AND st.capability='screening_reviewer' AND st.valid_until>clock_timestamp() AND t.user_id<>p_actor AND EXISTS(SELECT 1 FROM public."user" tu JOIN public.user_access ta ON ta.user_id=tu.id JOIN public.user_roles tr ON tr.user_id=tu.id AND tr.role='tutor' WHERE tu.id=t.user_id AND tu.email_verified AND ta.status='active')
 AND ((p_source='local_fixture' AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases c WHERE c.tutor_id=p_tutor)) OR (p_source='synthetic_readiness' AND EXISTS(SELECT 1 FROM public.tutor_screening_cases c WHERE c.tutor_id=p_tutor AND c.provenance=p_source)))
 ); $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_tutor_screening_authority(text,text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.request_tutor_screening(p_actor text,p_session text,p_tutor uuid,p_key uuid,p_version text)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_tutor public.tutor_profiles%ROWTYPE; v_policy public.tutor_screening_policies%ROWTYPE;
BEGIN
 SELECT * INTO v_tutor FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance='synthetic_readiness' FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF v_tutor.user_id IS DISTINCT FROM p_actor THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT p.* INTO v_policy FROM public.tutor_screening_policies p JOIN public.tutor_screening_policy_heads h ON h.provenance=p.provenance AND h.version=p.version AND h.status='enabled' WHERE p.provenance='synthetic_readiness' AND p.version=p_version AND p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp();
 IF NOT FOUND THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_events e JOIN public.tutor_screening_cases c ON c.tutor_id=e.tutor_id WHERE e.tutor_id=p_tutor AND e.kind='request' AND e.actor_user_id=p_actor AND e.request_key=p_key AND c.policy_version=p_version) THEN RETURN QUERY SELECT 'replayed'::text,0; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_cases WHERE tutor_id=p_tutor) OR v_tutor.review_status<>'pending' OR p_key IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 INSERT INTO public.tutor_screening_cases(tutor_id,provenance,policy_version) VALUES(p_tutor,'synthetic_readiness',v_policy.version);
 INSERT INTO public.tutor_screening_events(tutor_id,kind,actor_user_id,request_key,revision) VALUES(p_tutor,'request',p_actor,p_key,0);
 IF NOT EXISTS(SELECT 1 FROM public.session se JOIN public."user" u ON u.id=se.user_id JOIN public.user_access ua ON ua.user_id=u.id JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='tutor' JOIN public.tutor_profiles current_tutor ON current_tutor.user_id=u.id AND current_tutor.id=p_tutor WHERE se.id=p_session AND se.user_id=p_actor AND se.expires_at>clock_timestamp() AND u.email_verified AND ua.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') THEN RAISE EXCEPTION 'Current tutor authority unavailable.' USING ERRCODE='P4030'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies pol ON pol.provenance=h.provenance AND pol.version=h.version WHERE h.provenance='synthetic_readiness' AND h.version=p_version AND h.status='enabled' AND pol.valid_from<=clock_timestamp() AND pol.valid_until>clock_timestamp()) THEN RAISE EXCEPTION 'Current screening policy unavailable.' USING ERRCODE='P5030'; END IF;
 RETURN QUERY SELECT 'saved'::text,0;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.request_tutor_screening(text,text,uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.record_tutor_screening_check(p_actor text,p_session text,p_tutor uuid,p_expected integer,p_key uuid,p_code text,p_outcome text,p_reference text,p_checked timestamptz,p_expires timestamptz)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.tutor_screening_cases%ROWTYPE; p public.tutor_screening_policies%ROWTYPE; a public.tutor_screening_assignments%ROWTYPE; prior public.tutor_screening_checks%ROWTYPE; v_id uuid; v_now timestamptz;
BEGIN
 IF p_expected IS NULL OR p_expected NOT BETWEEN 0 AND 2147483646 OR p_key IS NULL OR NOT (p_outcome IN ('passed','failed','revoked')) IS TRUE OR p_code IS NULL OR p_reference IS NULL OR p_checked IS NULL OR p_expires IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 SELECT * INTO c FROM public.tutor_screening_cases WHERE tutor_id=p_tutor FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO a FROM public.tutor_screening_assignments WHERE tutor_id=p_tutor FOR SHARE;
 PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance=c.provenance FOR SHARE;
 PERFORM 1 FROM public.tutor_screening_staff WHERE user_id=p_actor AND provenance=c.provenance FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('screening-request:'||p_actor||':'||p_key::text,0));
 v_now:=clock_timestamp();
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,c.provenance) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT pol.* INTO p FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=c.provenance AND pol.version=c.policy_version AND pol.valid_from<=v_now AND pol.valid_until>v_now;
 IF NOT FOUND THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO prior FROM public.tutor_screening_checks WHERE actor_user_id=p_actor AND request_key=p_key;
 IF FOUND THEN
 IF prior.tutor_id=p_tutor AND prior.expected_revision=p_expected AND prior.check_code=p_code AND prior.outcome=p_outcome AND prior.evidence_reference=p_reference AND prior.checked_at=p_checked AND prior.expires_at=p_expires THEN RETURN QUERY SELECT 'replayed'::text,prior.revision; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::integer; END IF; RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_decisions WHERE actor_user_id=p_actor AND request_key=p_key) OR c.revision<>p_expected THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 IF NOT (p_code=ANY(p.required_check_codes)) OR p_checked>v_now OR NOT isfinite(p_checked) OR NOT isfinite(p_expires) OR p_expires<=p_checked OR p_reference !~ '^screening:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 INSERT INTO public.tutor_screening_checks(tutor_id,provenance,policy_version,round,expected_revision,revision,check_code,outcome,evidence_reference,checked_at,expires_at,actor_user_id,assignment_revision,request_key,created_at) VALUES(p_tutor,c.provenance,c.policy_version,c.round,p_expected,p_expected+1,p_code,p_outcome,p_reference,p_checked,p_expires,p_actor,a.assignment_revision,p_key,v_now) RETURNING id INTO v_id;
 UPDATE public.tutor_screening_cases SET revision=p_expected+1,state=CASE WHEN state='approved' THEN 'pending' ELSE state END,current_decision_id=CASE WHEN state='approved' THEN NULL ELSE current_decision_id END,updated_at=v_now WHERE tutor_id=p_tutor;
 INSERT INTO public.tutor_screening_events(tutor_id,revision,kind,actor_user_id,request_key,check_id,assignment_revision,created_at) VALUES(p_tutor,p_expected+1,'check',p_actor,p_key,v_id,a.assignment_revision,v_now);
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RAISE EXCEPTION 'Current assurance expired.' USING ERRCODE='P4030'; END IF;
 IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,c.provenance) THEN RAISE EXCEPTION 'Current assignment unavailable.' USING ERRCODE='P4040'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=p.provenance AND pol.version=p.version AND pol.valid_from<=clock_timestamp() AND pol.valid_until>clock_timestamp()) THEN RAISE EXCEPTION 'Current policy unavailable.' USING ERRCODE='P5030'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_tutor_screening_check(text,text,uuid,integer,uuid,text,text,text,timestamptz,timestamptz) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.decide_tutor_screening(p_actor text,p_session text,p_tutor uuid,p_expected integer,p_key uuid,p_action text)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.tutor_screening_cases%ROWTYPE; p public.tutor_screening_policies%ROWTYPE; a public.tutor_screening_assignments%ROWTYPE; prior public.tutor_screening_decisions%ROWTYPE; v_id uuid; v_now timestamptz; v_state text; v_profile text; v_round integer;
BEGIN
 IF p_expected IS NULL OR p_expected NOT BETWEEN 0 AND 2147483646 OR p_key IS NULL OR NOT (p_action IN ('approve','reject','suspend','reinstate','reopen','revoke')) IS TRUE THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 SELECT * INTO c FROM public.tutor_screening_cases WHERE tutor_id=p_tutor FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO a FROM public.tutor_screening_assignments WHERE tutor_id=p_tutor FOR SHARE;
 PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance=c.provenance FOR SHARE;
 PERFORM 1 FROM public.tutor_screening_staff WHERE user_id=p_actor AND provenance=c.provenance FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('screening-request:'||p_actor||':'||p_key::text,0));
 v_now:=clock_timestamp();
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,c.provenance) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT pol.* INTO p FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=c.provenance AND (p_action='reopen' OR pol.version=c.policy_version) AND pol.valid_from<=v_now AND pol.valid_until>v_now;
 IF NOT FOUND OR NOT (p_action=ANY(p.allowed_actions)) THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO prior FROM public.tutor_screening_decisions WHERE actor_user_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF prior.tutor_id=p_tutor AND prior.expected_revision=p_expected AND prior.action=p_action THEN RETURN QUERY SELECT 'replayed'::text,prior.revision; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::integer; END IF; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_checks WHERE actor_user_id=p_actor AND request_key=p_key) OR c.revision<>p_expected THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 IF NOT ((p_action IN ('approve','reject') AND c.state='pending') OR (p_action='suspend' AND c.state='approved') OR (p_action='reinstate' AND c.state='suspended') OR (p_action='revoke' AND c.state<>'revoked') OR (p_action='reopen' AND (c.state IN ('rejected','revoked','suspended') OR c.policy_version<>p.version OR NOT public.has_current_tutor_screening(p_tutor,'synthetic_readiness')))) THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 IF p_action IN ('approve','reinstate') AND EXISTS(SELECT 1 FROM unnest(p.required_check_codes) code WHERE NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks ck WHERE ck.tutor_id=p_tutor AND ck.policy_version=p.version AND ck.provenance=c.provenance AND ck.round=c.round AND ck.check_code=code AND ck.outcome='passed' AND ck.checked_at<=v_now AND ck.expires_at>v_now AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer WHERE newer.tutor_id=p_tutor AND newer.round=c.round AND newer.check_code=code AND newer.revision>ck.revision))) THEN RETURN QUERY SELECT 'missing_checks'::text,NULL::integer; RETURN; END IF;
 v_state:=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reinstate' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'suspend' THEN 'suspended' WHEN 'revoke' THEN 'revoked' ELSE 'pending' END;
 v_profile:=CASE WHEN v_state='revoked' THEN 'suspended' ELSE v_state END;
 v_round:=c.round+CASE WHEN p_action='reopen' THEN 1 ELSE 0 END;
 INSERT INTO public.tutor_screening_decisions(tutor_id,provenance,policy_version,round,expected_revision,revision,action,actor_user_id,assignment_revision,request_key,created_at) VALUES(p_tutor,c.provenance,p.version,v_round,p_expected,p_expected+1,p_action,p_actor,a.assignment_revision,p_key,v_now) RETURNING id INTO v_id;
 IF p_action IN ('approve','reinstate') THEN INSERT INTO public.tutor_screening_decision_checks(decision_id,check_code,check_id) SELECT v_id,ck.check_code,ck.id FROM public.tutor_screening_checks ck WHERE ck.tutor_id=p_tutor AND ck.round=c.round AND ck.policy_version=p.version AND ck.check_code=ANY(p.required_check_codes) AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer WHERE newer.tutor_id=p_tutor AND newer.round=c.round AND newer.check_code=ck.check_code AND newer.revision>ck.revision); END IF;
 UPDATE public.tutor_screening_cases SET revision=p_expected+1,state=v_state,round=v_round,policy_version=p.version,current_decision_id=v_id,updated_at=v_now WHERE tutor_id=p_tutor;
 UPDATE public.tutor_profiles SET review_status=v_profile,updated_at=v_now WHERE id=p_tutor;
 INSERT INTO public.audit_events(actor_user_id,target_user_id,action) SELECT p_actor,user_id,CASE p_action WHEN 'approve' THEN 'tutor_review.approved' WHEN 'reinstate' THEN 'tutor_review.reinstated' WHEN 'reject' THEN 'tutor_review.rejected' WHEN 'reopen' THEN 'tutor_review.reopened' ELSE 'tutor_review.suspended' END FROM public.tutor_profiles WHERE id=p_tutor;
 INSERT INTO public.tutor_screening_events(tutor_id,revision,kind,actor_user_id,request_key,decision_id,assignment_revision,created_at) VALUES(p_tutor,p_expected+1,'decision',p_actor,p_key,v_id,a.assignment_revision,v_now);
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RAISE EXCEPTION 'Current assurance expired.' USING ERRCODE='P4030'; END IF;
 IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,c.provenance) THEN RAISE EXCEPTION 'Current assignment unavailable.' USING ERRCODE='P4040'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=p.provenance AND pol.version=p.version AND pol.valid_from<=clock_timestamp() AND pol.valid_until>clock_timestamp()) THEN RAISE EXCEPTION 'Current policy unavailable.' USING ERRCODE='P5030'; END IF;
 IF p_action IN ('approve','reinstate') AND NOT public.has_current_tutor_screening(p_tutor,'synthetic_readiness') THEN RAISE EXCEPTION 'Current required screening evidence unavailable.' USING ERRCODE='P4090'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4090' THEN RETURN QUERY SELECT 'missing_checks'::text,NULL::integer; WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.decide_tutor_screening(text,text,uuid,integer,uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.review_local_tutor_application(p_actor text,p_session text,p_tutor uuid,p_action text)
RETURNS TABLE(outcome text,status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t public.tutor_profiles%ROWTYPE; v_from text;v_to text;v_audit text;
BEGIN
 SELECT * INTO t FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 PERFORM 1 FROM public.tutor_screening_assignments WHERE tutor_id=p_tutor FOR SHARE;
 PERFORM 1 FROM public.tutor_screening_staff WHERE user_id=p_actor AND provenance='local_fixture' FOR SHARE;
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text; RETURN; END IF;
 IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,'local_fixture') THEN RETURN QUERY SELECT 'not_found'::text,NULL::text; RETURN; END IF;
 v_from:=CASE p_action WHEN 'approve' THEN 'pending' WHEN 'reject' THEN 'pending' WHEN 'suspend' THEN 'approved' WHEN 'reinstate' THEN 'suspended' WHEN 'reopen' THEN 'rejected' END;
 v_to:=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'suspend' THEN 'suspended' WHEN 'reinstate' THEN 'approved' WHEN 'reopen' THEN 'pending' END;
 v_audit:=CASE p_action WHEN 'approve' THEN 'tutor_review.approved' WHEN 'reject' THEN 'tutor_review.rejected' WHEN 'suspend' THEN 'tutor_review.suspended' WHEN 'reinstate' THEN 'tutor_review.reinstated' WHEN 'reopen' THEN 'tutor_review.reopened' END;
 IF v_to IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN; END IF;
 IF t.review_status<>v_from THEN RETURN QUERY SELECT 'conflict'::text,NULL::text; RETURN; END IF;
 UPDATE public.tutor_profiles SET review_status=v_to,updated_at=clock_timestamp() WHERE id=p_tutor;
 INSERT INTO public.audit_events(actor_user_id,target_user_id,action) VALUES(p_actor,t.user_id,v_audit);
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RAISE EXCEPTION 'Current assurance expired.' USING ERRCODE='P4030'; END IF; IF NOT public.has_tutor_screening_authority(p_actor,p_session,p_tutor,'local_fixture') THEN RAISE EXCEPTION 'Current assignment unavailable.' USING ERRCODE='P4040'; END IF;
 RETURN QUERY SELECT 'saved'::text,v_to;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.review_local_tutor_application(text,text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
-- Tutor can resubmit a rejected application, but cannot approve or erase provenance.
CREATE FUNCTION public.resubmit_tutor_application(p_actor text,p_session text,p_tutor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t public.tutor_profiles%ROWTYPE; c public.tutor_screening_cases%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 SELECT * INTO c FROM public.tutor_screening_cases WHERE tutor_id=p_tutor FOR UPDATE;
 IF c.tutor_id IS NOT NULL THEN PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance=c.provenance FOR SHARE; END IF;
 IF t.user_id IS DISTINCT FROM p_actor OR t.review_status<>'rejected' OR NOT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active') THEN RETURN false; END IF;
 IF c.tutor_id IS NOT NULL THEN
 UPDATE public.tutor_screening_cases SET state='pending',round=round+1,revision=revision+1,current_decision_id=NULL,updated_at=clock_timestamp() WHERE tutor_id=p_tutor;
 INSERT INTO public.tutor_screening_events(tutor_id,revision,kind,actor_user_id) VALUES(p_tutor,c.revision+1,'request',p_actor);
 END IF;
 UPDATE public.tutor_profiles SET review_status='pending',updated_at=clock_timestamp() WHERE id=p_tutor;
 IF NOT EXISTS(SELECT 1 FROM public.session se JOIN public."user" u ON u.id=se.user_id JOIN public.user_access ua ON ua.user_id=u.id JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='tutor' JOIN public.tutor_profiles current_tutor ON current_tutor.user_id=u.id AND current_tutor.id=p_tutor WHERE se.id=p_session AND se.user_id=p_actor AND se.expires_at>clock_timestamp() AND u.email_verified AND ua.status='active') THEN RAISE EXCEPTION 'Current tutor authority unavailable.' USING ERRCODE='P4030'; END IF;
 IF c.tutor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies p ON p.provenance=h.provenance AND p.version=h.version WHERE h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled' AND p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp()) THEN RAISE EXCEPTION 'Current screening policy unavailable.' USING ERRCODE='P4030'; END IF;
 RETURN true;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN false;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resubmit_tutor_application(text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.reject_screening_history_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Screening and response history is append-only.' USING ERRCODE='55000'; END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reject_screening_history_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER screening_policy_immutable BEFORE UPDATE OR DELETE ON public.tutor_screening_policies FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE TRIGGER screening_check_immutable BEFORE UPDATE OR DELETE ON public.tutor_screening_checks FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE TRIGGER screening_decision_immutable BEFORE UPDATE OR DELETE ON public.tutor_screening_decisions FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE TRIGGER screening_decision_check_immutable BEFORE UPDATE OR DELETE ON public.tutor_screening_decision_checks FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE TRIGGER screening_event_immutable BEFORE UPDATE OR DELETE ON public.tutor_screening_events FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE FUNCTION public.validate_screening_rows() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE d public.tutor_screening_decisions%ROWTYPE;ck public.tutor_screening_checks%ROWTYPE;p public.tutor_screening_policies%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='tutor_screening_cases' THEN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.tutor_id<>OLD.tutor_id OR NEW.provenance<>OLD.provenance)) THEN RAISE EXCEPTION 'Screening provenance is permanent.' USING ERRCODE='55000'; END IF;
 IF NEW.current_decision_id IS NOT NULL THEN SELECT * INTO d FROM public.tutor_screening_decisions WHERE id=NEW.current_decision_id;
 IF d.tutor_id IS DISTINCT FROM NEW.tutor_id OR d.round IS DISTINCT FROM NEW.round OR d.policy_version IS DISTINCT FROM NEW.policy_version OR d.provenance IS DISTINCT FROM NEW.provenance THEN RAISE EXCEPTION 'Invalid screening head.' USING ERRCODE='23514'; END IF; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_assignments' THEN
 IF NEW.provenance='synthetic_readiness' AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases WHERE tutor_id=NEW.tutor_id AND provenance=NEW.provenance) THEN RAISE EXCEPTION 'Invalid screening assignment source.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.provenance<>OLD.provenance THEN RAISE EXCEPTION 'Assignment source immutable.' USING ERRCODE='55000'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_checks' THEN
 SELECT * INTO p FROM public.tutor_screening_policies WHERE provenance=NEW.provenance AND version=NEW.policy_version;
 IF NOT (NEW.check_code=ANY(p.required_check_codes)) IS TRUE OR NEW.checked_at>clock_timestamp() THEN RAISE EXCEPTION 'Invalid check receipt.' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_decision_checks' THEN
 SELECT * INTO d FROM public.tutor_screening_decisions WHERE id=NEW.decision_id;SELECT * INTO ck FROM public.tutor_screening_checks WHERE id=NEW.check_id;
 IF d.action NOT IN ('approve','reinstate') OR ck.tutor_id<>d.tutor_id OR ck.round<>d.round OR ck.policy_version<>d.policy_version OR ck.provenance<>d.provenance OR ck.check_code<>NEW.check_code OR ck.outcome<>'passed' THEN RAISE EXCEPTION 'Invalid bound check.' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_policies' THEN
 IF EXISTS(SELECT 1 FROM unnest(NEW.required_check_codes) code WHERE code !~ '^[a-z][a-z0-9_]{0,47}$') OR cardinality(NEW.required_check_codes)<>(SELECT count(DISTINCT code) FROM unnest(NEW.required_check_codes) code) OR NEW.reference !~ '^policy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NEW.authority_reference !~ '^synthetic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid screening packet.' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.validate_screening_rows() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER screening_case_validate BEFORE INSERT OR UPDATE OR DELETE ON public.tutor_screening_cases FOR EACH ROW EXECUTE FUNCTION public.validate_screening_rows();
--> statement-breakpoint
CREATE TRIGGER screening_assignment_validate BEFORE INSERT OR UPDATE ON public.tutor_screening_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_screening_rows();
--> statement-breakpoint
CREATE TRIGGER screening_check_validate BEFORE INSERT ON public.tutor_screening_checks FOR EACH ROW EXECUTE FUNCTION public.validate_screening_rows();
--> statement-breakpoint
CREATE TRIGGER screening_decision_check_validate BEFORE INSERT ON public.tutor_screening_decision_checks FOR EACH ROW EXECUTE FUNCTION public.validate_screening_rows();
--> statement-breakpoint
CREATE TRIGGER screening_policy_validate BEFORE INSERT ON public.tutor_screening_policies FOR EACH ROW EXECUTE FUNCTION public.validate_screening_rows();
--> statement-breakpoint
-- Completeness is checked at transaction end, after all bound receipt rows exist.
CREATE FUNCTION public.validate_screening_positive_decision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE v_tutor uuid;c public.tutor_screening_cases%ROWTYPE;d public.tutor_screening_decisions%ROWTYPE;p public.tutor_screening_policies%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='tutor_screening_cases' THEN v_tutor:=NEW.tutor_id; ELSE SELECT tutor_id INTO v_tutor FROM public.tutor_screening_decisions WHERE id=NEW.decision_id; END IF;
 SELECT * INTO c FROM public.tutor_screening_cases WHERE tutor_id=v_tutor;
 IF c.state='approved' THEN
 SELECT * INTO d FROM public.tutor_screening_decisions WHERE id=c.current_decision_id;
 SELECT * INTO p FROM public.tutor_screening_policies WHERE provenance=c.provenance AND version=c.policy_version;
 IF d.id IS NULL OR d.action NOT IN ('approve','reinstate') OR EXISTS(SELECT 1 FROM unnest(p.required_check_codes) code WHERE NOT EXISTS(SELECT 1 FROM public.tutor_screening_decision_checks bound JOIN public.tutor_screening_checks ck ON ck.id=bound.check_id WHERE bound.decision_id=d.id AND bound.check_code=code AND ck.tutor_id=c.tutor_id AND ck.round=c.round AND ck.provenance=c.provenance AND ck.policy_version=c.policy_version AND ck.check_code=code AND ck.outcome='passed' AND ck.checked_at<=d.created_at AND ck.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer WHERE newer.tutor_id=c.tutor_id AND newer.round=c.round AND newer.check_code=code AND newer.revision>ck.revision))) THEN RAISE EXCEPTION 'Incomplete positive screening receipt.' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.validate_screening_positive_decision() FROM PUBLIC;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER screening_positive_complete AFTER INSERT OR UPDATE ON public.tutor_screening_cases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_screening_positive_decision();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER screening_positive_bindings AFTER INSERT ON public.tutor_screening_decision_checks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_screening_positive_decision();

--> statement-breakpoint
CREATE FUNCTION public.has_current_support_policy(p_version text) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.support_response_policies p JOIN public.support_response_policy_heads h ON h.provenance=p.provenance AND h.version=p.version AND h.status='enabled' WHERE p.provenance='synthetic_readiness' AND p.version=p_version AND p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY[p.responsible_owner_id,p.escalation_owner_id]) AS owners(owner_id) WHERE NOT EXISTS(SELECT 1 FROM public.support_reviewers r JOIN public."user" u ON u.id=r.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles g ON g.user_id=u.id AND g.role='admin' WHERE r.user_id=owners.owner_id AND r.source=p.provenance AND r.status='authorized' AND r.valid_until>clock_timestamp() AND u.email_verified AND a.status='active'))); $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_current_support_policy(text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.has_safeguarding_case_authority(p_actor text,p_session text,p_case uuid,p_scope text) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.support_cases c JOIN public.support_case_responses resp ON resp.case_id=c.id WHERE c.id=p_case AND c.source='synthetic_readiness' AND resp.provenance=c.source AND (
 (p_scope='requester' AND c.requester_user_id=p_actor AND EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active'))
 OR (p_scope IN ('reviewer','dispatcher') AND c.requester_user_id<>p_actor AND public.has_admin_assurance(p_actor,p_session,28800) AND public.has_current_support_policy(resp.policy_version) AND (
 (p_scope='dispatcher' AND EXISTS(SELECT 1 FROM public.support_dispatch_grants g WHERE g.case_id=c.id AND g.dispatcher_user_id=p_actor AND g.source=c.source AND g.status='authorized' AND g.valid_until>clock_timestamp()))
 OR (p_scope='reviewer' AND EXISTS(SELECT 1 FROM public.support_case_assignments ass JOIN public.support_reviewers r ON r.user_id=ass.reviewer_user_id WHERE ass.case_id=c.id AND ass.reviewer_user_id=p_actor AND r.source=c.source AND r.status='authorized' AND r.valid_until>clock_timestamp())))))); $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_safeguarding_case_authority(text,text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.create_safeguarding_case(p_actor text,p_session text,p_key uuid,p_version text,p_category text,p_subject text,p_body text)
RETURNS TABLE(outcome text,case_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_prior public.support_cases%ROWTYPE;v_id uuid;v_now timestamptz;
BEGIN
 PERFORM 1 FROM public.support_response_policy_heads WHERE provenance='synthetic_readiness' FOR SHARE;
 PERFORM 1 FROM public.support_reviewers WHERE user_id IN (SELECT responsible_owner_id FROM public.support_response_policies WHERE provenance='synthetic_readiness' AND version=p_version UNION SELECT escalation_owner_id FROM public.support_response_policies WHERE provenance='synthetic_readiness' AND version=p_version) ORDER BY user_id FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('support:'||p_actor,0));v_now:=clock_timestamp();
 IF NOT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now AND u.email_verified AND a.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid; RETURN; END IF;
 IF NOT public.has_current_support_policy(p_version) OR NOT EXISTS(SELECT 1 FROM public.support_response_policies p WHERE p.provenance='synthetic_readiness' AND p.version=p_version AND 'intake'=ANY(p.allowed_actions)) THEN RETURN QUERY SELECT 'unavailable'::text,NULL::uuid; RETURN; END IF;
 IF p_key IS NULL OR NOT (p_category IN ('general','account','safety')) IS TRUE OR p_subject IS NULL OR char_length(p_subject) NOT BETWEEN 1 AND 120 OR p_subject<>btrim(p_subject) OR p_body IS NULL OR char_length(p_body) NOT BETWEEN 1 AND 2000 OR p_body<>btrim(p_body) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid; RETURN; END IF;
 SELECT * INTO v_prior FROM public.support_cases WHERE requester_user_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF v_prior.source='synthetic_readiness' AND v_prior.category=p_category AND v_prior.subject=p_subject AND v_prior.body=p_body THEN RETURN QUERY SELECT 'replayed'::text,v_prior.id; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::uuid; END IF; RETURN; END IF;
 IF (SELECT count(*) FROM public.support_cases WHERE requester_user_id=p_actor AND created_at>v_now-interval '5 minutes')>=5 THEN RETURN QUERY SELECT 'limited'::text,NULL::uuid; RETURN; END IF;
 INSERT INTO public.support_cases(requester_user_id,request_key,source,category,subject,body,created_at,updated_at) VALUES(p_actor,p_key,'synthetic_readiness',p_category,p_subject,p_body,v_now,v_now) RETURNING id INTO v_id;
 INSERT INTO public.support_case_responses(case_id,provenance,policy_version) VALUES(v_id,'synthetic_readiness',p_version);
 INSERT INTO public.support_case_events(case_id,action,actor_user_id,next_status,revision,created_at) VALUES(v_id,'created',p_actor,'open',0,v_now);
 INSERT INTO public.support_response_events(case_id,action,actor_user_id,request_key,expected_revision,revision,provenance,policy_version,response_cycle,created_at) VALUES(v_id,'intake',p_actor,p_key,0,0,'synthetic_readiness',p_version,1,v_now);
 IF NOT EXISTS(SELECT 1 FROM public.session se JOIN public."user" u ON u.id=se.user_id JOIN public.user_access a ON a.user_id=u.id WHERE se.id=p_session AND se.user_id=p_actor AND se.expires_at>clock_timestamp() AND u.email_verified AND a.status='active') THEN RAISE EXCEPTION 'Current identity unavailable.' USING ERRCODE='P4030'; END IF;
 IF NOT public.has_current_support_policy(p_version) THEN RAISE EXCEPTION 'Current policy unavailable.' USING ERRCODE='P5030'; END IF;
 RETURN QUERY SELECT 'saved'::text,v_id;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::uuid;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_safeguarding_case(text,text,uuid,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.change_safeguarding_response(p_actor text,p_session text,p_case uuid,p_expected integer,p_key uuid,p_action text,p_target text DEFAULT NULL)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.support_cases%ROWTYPE;r public.support_case_responses%ROWTYPE;p public.support_response_policies%ROWTYPE;prior public.support_response_events%ROWTYPE;v_previous text;v_scope text;v_now timestamptz;v_status text;v_cycle integer;v_assignment integer;
BEGIN
 IF p_expected IS NULL OR p_expected NOT BETWEEN 0 AND 2147483646 OR p_key IS NULL OR NOT (p_action IN ('assign','reassign','escalate','acknowledge','request_escalation','close','reopen')) IS TRUE THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO c FROM public.support_cases WHERE id=p_case AND source='synthetic_readiness' FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO r FROM public.support_case_responses WHERE case_id=p_case FOR UPDATE;
 SELECT a.reviewer_user_id INTO v_previous FROM public.support_case_assignments a WHERE a.case_id=p_case FOR UPDATE;
 PERFORM 1 FROM public.support_response_policy_heads WHERE provenance=r.provenance FOR SHARE;
 SELECT * INTO p FROM public.support_response_policies WHERE provenance=r.provenance AND version=r.policy_version;
 PERFORM 1 FROM public.support_reviewers WHERE user_id IN (p_actor,p_target,p.responsible_owner_id,p.escalation_owner_id) ORDER BY user_id FOR SHARE;
 PERFORM 1 FROM public.support_dispatch_grants WHERE case_id=p_case AND dispatcher_user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.support_reviewer_choices WHERE case_id=p_case AND reviewer_user_id=p_target FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('safeguarding-request:'||p_actor||':'||p_key::text,0));v_now:=clock_timestamp();
 v_scope:=CASE WHEN p_action IN ('assign','reassign','escalate') THEN 'dispatcher' ELSE 'reviewer' END;
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF NOT public.has_safeguarding_case_authority(p_actor,p_session,p_case,v_scope) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 IF NOT public.has_current_support_policy(p.version) OR NOT (p_action=ANY(p.allowed_actions)) THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO prior FROM public.support_response_events WHERE actor_user_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF prior.case_id=p_case AND prior.expected_revision=p_expected AND prior.action=p_action AND prior.target_user_id IS NOT DISTINCT FROM p_target THEN RETURN QUERY SELECT 'replayed'::text,prior.revision; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::integer; END IF; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.support_assignment_events WHERE actor_user_id=p_actor AND request_key=p_key) OR c.revision<>p_expected THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 v_assignment:=r.assignment_revision;v_cycle:=r.response_cycle;v_status:=c.status;
 IF p_action IN ('assign','reassign','escalate','request_escalation') THEN
 IF p_target IS NULL OR p_target IN (p_actor,c.requester_user_id) OR NOT EXISTS(SELECT 1 FROM public.support_reviewer_choices ch JOIN public.support_reviewers staff ON staff.user_id=ch.reviewer_user_id JOIN public."user" u ON u.id=staff.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles role ON role.user_id=u.id AND role.role='admin' WHERE ch.case_id=p_case AND ch.reviewer_user_id=p_target AND ch.source=c.source AND ch.status='authorized' AND ch.valid_until>v_now AND staff.source=c.source AND staff.status='authorized' AND staff.valid_until>v_now AND u.email_verified AND a.status='active' AND (p_action IN ('assign','reassign') OR (ch.can_escalate AND p_target=p.escalation_owner_id))) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 END IF;
 IF p_action IN ('assign','reassign','escalate') THEN
 IF c.status='closed' OR v_previous=p_target OR NOT ((p_action='assign' AND v_previous IS NULL) OR (p_action IN ('reassign','escalate') AND v_previous IS NOT NULL)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 IF p_action='escalate' AND (r.escalation_target_user_id IS DISTINCT FROM p_target OR r.escalation_requested_at IS NULL OR r.acknowledged_assignment_revision IS DISTINCT FROM r.assignment_revision) THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 INSERT INTO public.support_case_assignments(case_id,reviewer_user_id,updated_at) VALUES(p_case,p_target,v_now) ON CONFLICT(case_id) DO UPDATE SET reviewer_user_id=p_target,updated_at=v_now;
 v_assignment:=p_expected+1;
 UPDATE public.support_case_responses SET assignment_revision=v_assignment,acknowledged_assignment_revision=NULL,acknowledged_by=NULL,acknowledged_at=NULL,escalation_requested_at=NULL,escalation_target_user_id=NULL WHERE case_id=p_case;
 INSERT INTO public.support_case_events(case_id,action,previous_reviewer_id,next_reviewer_id,revision,created_at) VALUES(p_case,CASE WHEN v_previous IS NULL THEN 'assigned' ELSE 'reassigned' END,v_previous,p_target,p_expected+1,v_now);
 INSERT INTO public.support_assignment_events(case_id,actor_user_id,request_key,expected_revision,revision,kind,previous_reviewer_id,next_reviewer_id,created_at) VALUES(p_case,p_actor,p_key,p_expected,p_expected+1,p_action,v_previous,p_target,v_now);
 ELSIF p_action='acknowledge' THEN
 IF c.status='closed' OR r.assignment_revision IS NULL OR r.acknowledged_assignment_revision=r.assignment_revision OR p_target IS NOT NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 UPDATE public.support_case_responses SET acknowledged_assignment_revision=assignment_revision,acknowledged_by=p_actor,acknowledged_at=v_now WHERE case_id=p_case;
 v_status:='in_review';
 INSERT INTO public.support_case_events(case_id,action,actor_user_id,previous_status,next_status,revision,created_at) VALUES(p_case,'acknowledged',p_actor,CASE WHEN c.status='open' THEN 'open' END,CASE WHEN c.status='open' THEN 'in_review' END,p_expected+1,v_now);
 ELSIF p_action='request_escalation' THEN
 IF c.status<>'in_review' OR r.acknowledged_assignment_revision IS DISTINCT FROM r.assignment_revision OR r.acknowledged_at IS NULL OR r.escalation_requested_at IS NOT NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 UPDATE public.support_case_responses SET escalation_requested_at=v_now,escalation_target_user_id=p_target WHERE case_id=p_case;
 INSERT INTO public.support_case_events(case_id,action,actor_user_id,revision,created_at) VALUES(p_case,'escalation_requested',p_actor,p_expected+1,v_now);
 ELSE
 IF p_target IS NOT NULL OR NOT ((p_action='close' AND c.status='in_review' AND r.acknowledged_assignment_revision=r.assignment_revision AND r.acknowledged_at IS NOT NULL) OR (p_action='reopen' AND c.status='closed')) IS TRUE THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 v_status:=CASE WHEN p_action='close' THEN 'closed' ELSE 'in_review' END;
 IF p_action='reopen' THEN v_cycle:=v_cycle+1;UPDATE public.support_case_responses SET response_cycle=v_cycle,acknowledged_assignment_revision=NULL,acknowledged_by=NULL,acknowledged_at=NULL,escalation_requested_at=NULL,escalation_target_user_id=NULL WHERE case_id=p_case; END IF;
 INSERT INTO public.support_case_events(case_id,action,actor_user_id,previous_status,next_status,revision,created_at) VALUES(p_case,'status_changed',p_actor,c.status,v_status,p_expected+1,v_now);
 END IF;
 UPDATE public.support_cases SET revision=p_expected+1,status=v_status,updated_at=v_now WHERE id=p_case;
 INSERT INTO public.support_response_events(case_id,action,actor_user_id,request_key,expected_revision,revision,provenance,policy_version,response_cycle,assignment_revision,target_user_id,created_at) VALUES(p_case,p_action,p_actor,p_key,p_expected,p_expected+1,r.provenance,r.policy_version,v_cycle,v_assignment,p_target,v_now);
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RAISE EXCEPTION 'Current assurance expired.' USING ERRCODE='P4030'; END IF;
 IF NOT public.has_current_support_policy(p.version) THEN RAISE EXCEPTION 'Current response policy unavailable.' USING ERRCODE='P5030'; END IF;
 IF NOT public.has_safeguarding_case_authority(p_actor,p_session,p_case,v_scope) THEN RAISE EXCEPTION 'Current case authority unavailable.' USING ERRCODE='P4040'; END IF;
 IF p_target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.support_reviewer_choices ch JOIN public.support_reviewers st ON st.user_id=ch.reviewer_user_id JOIN public."user" u ON u.id=st.user_id JOIN public.user_access ua ON ua.user_id=u.id JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='admin' WHERE ch.case_id=p_case AND ch.reviewer_user_id=p_target AND ch.source=c.source AND ch.status='authorized' AND ch.valid_until>clock_timestamp() AND st.source=c.source AND st.status='authorized' AND st.valid_until>clock_timestamp() AND u.email_verified AND ua.status='active' AND (p_action IN ('assign','reassign') OR (ch.can_escalate AND p_target=p.escalation_owner_id))) THEN RAISE EXCEPTION 'Current target unavailable.' USING ERRCODE='P4040'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.change_safeguarding_response(text,text,uuid,integer,uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.change_safeguarding_access(p_actor text,p_session text,p_target text,p_expected integer,p_action text,p_reason text,p_key uuid)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t public.account_restriction_targets%ROWTYPE;g public.account_restriction_grants%ROWTYPE;p public.support_response_policies%ROWTYPE;prior public.account_restriction_events%ROWTYPE;v_status text;v_next text;v_now timestamptz;
BEGIN
 IF p_expected IS NULL OR p_expected NOT BETWEEN 0 AND 2147483646 OR p_key IS NULL OR NOT (p_action IN ('restrict','restore')) IS TRUE THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE user_id=p_target FOR UPDATE;
 SELECT * INTO t FROM public.account_restriction_targets WHERE user_id=p_target AND source='synthetic_readiness' FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT status INTO v_status FROM public.user_access WHERE user_id=p_target FOR UPDATE;
 SELECT * INTO g FROM public.account_restriction_grants WHERE staff_user_id=p_actor AND target_user_id=p_target FOR SHARE;
 PERFORM 1 FROM public.support_response_policy_heads WHERE provenance='synthetic_readiness' FOR SHARE;
 SELECT pol.* INTO p FROM public.support_response_policies pol JOIN public.support_response_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance='synthetic_readiness';
 PERFORM 1 FROM public.support_reviewers WHERE user_id IN (p.responsible_owner_id,p.escalation_owner_id) ORDER BY user_id FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended('account-restriction-request:'||p_actor||':'||p_key::text,0));v_now:=clock_timestamp();
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF p_actor=p_target OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target AND role='admin') OR g.source IS DISTINCT FROM t.source OR g.status IS DISTINCT FROM 'authorized' OR g.valid_until IS NULL OR g.valid_until<=v_now OR NOT (p_action=ANY(g.permitted_actions)) IS TRUE THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 IF NOT public.has_current_support_policy(p.version) OR NOT (p_action=ANY(p.allowed_actions)) IS TRUE OR NOT (p_reason=ANY(p.reason_codes)) IS TRUE THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 IF (p_action='restrict' AND p_reason<>'synthetic_safety_restrict') OR (p_action='restore' AND p_reason<>'synthetic_safety_restore') THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO prior FROM public.account_restriction_events WHERE actor_user_id=p_actor AND request_key=p_key;
 v_next:=CASE p_action WHEN 'restrict' THEN 'suspended' ELSE 'active' END;
 IF FOUND THEN IF prior.target_user_id=p_target AND prior.expected_revision=p_expected AND prior.next_status=v_next AND prior.reason=p_reason AND prior.policy_provenance=t.source THEN RETURN QUERY SELECT 'replayed'::text,prior.revision; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::integer; END IF; RETURN; END IF;
 IF t.revision<>p_expected OR v_status=v_next OR v_status IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 UPDATE public.user_access SET status=v_next WHERE user_id=p_target;
 UPDATE public.account_restriction_targets SET revision=p_expected+1 WHERE user_id=p_target;
 INSERT INTO public.account_restriction_events(actor_user_id,target_user_id,request_key,expected_revision,revision,previous_status,next_status,reason,policy_provenance,policy_version,created_at) VALUES(p_actor,p_target,p_key,p_expected,p_expected+1,v_status,v_next,p_reason,t.source,p.version,v_now);
 IF NOT public.has_admin_assurance(p_actor,p_session,28800) THEN RAISE EXCEPTION 'Current assurance expired.' USING ERRCODE='P4030'; END IF;
 IF NOT public.has_current_support_policy(p.version) THEN RAISE EXCEPTION 'Current response policy unavailable.' USING ERRCODE='P5030'; END IF;
 IF p_actor=p_target OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target AND role='admin') OR NOT EXISTS(SELECT 1 FROM public.account_restriction_grants gr WHERE gr.staff_user_id=p_actor AND gr.target_user_id=p_target AND gr.source=t.source AND gr.status='authorized' AND gr.valid_until>clock_timestamp() AND p_action=ANY(gr.permitted_actions)) THEN RAISE EXCEPTION 'Current target grant unavailable.' USING ERRCODE='P4040'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.change_safeguarding_access(text,text,text,integer,text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER response_policy_immutable BEFORE UPDATE OR DELETE ON public.support_response_policies FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE TRIGGER response_history_immutable BEFORE UPDATE OR DELETE ON public.support_response_events FOR EACH ROW EXECUTE FUNCTION public.reject_screening_history_change();
--> statement-breakpoint
CREATE FUNCTION public.guard_readiness_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE v_source text;v_previous text;
BEGIN
 IF TG_TABLE_NAME='support_cases' THEN
 v_source:=NEW.source;
 IF TG_OP='UPDATE' AND (NEW.source<>OLD.source OR NEW.requester_user_id<>OLD.requester_user_id OR NEW.request_key<>OLD.request_key OR NEW.body<>OLD.body OR NEW.subject<>OLD.subject OR NEW.category<>OLD.category) THEN RAISE EXCEPTION 'Report identity is immutable.' USING ERRCODE='55000'; END IF;
 IF v_source='synthetic_readiness' AND current_user='learli_app' THEN RAISE EXCEPTION 'Readiness actions require scoped functions.' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME IN ('support_reviewers','support_dispatch_grants','support_reviewer_choices','account_restriction_targets','account_restriction_grants') THEN
 IF TG_OP='UPDATE' AND (NEW.source<>OLD.source OR (to_jsonb(NEW)-ARRAY['status','valid_until','permitted_actions','can_escalate','updated_at','revision']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','valid_until','permitted_actions','can_escalate','updated_at','revision'])) THEN RAISE EXCEPTION 'Authority source immutable.' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='support_dispatch_grants' OR TG_TABLE_NAME='support_reviewer_choices' THEN
 SELECT source INTO v_source FROM public.support_cases WHERE id=NEW.case_id;
 IF NOT ((NEW.source='local_fixture' AND v_source='local_synthetic') OR (NEW.source='synthetic_readiness' AND v_source='synthetic_readiness')) THEN RAISE EXCEPTION 'Authority source mismatch.' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='support_reviewer_choices' THEN
 SELECT source INTO v_previous FROM public.support_reviewers WHERE user_id=NEW.reviewer_user_id;
 IF NEW.source IS DISTINCT FROM v_previous THEN RAISE EXCEPTION 'Reviewer source mismatch.' USING ERRCODE='23514'; END IF;
 END IF;
 ELSIF TG_TABLE_NAME='account_restriction_grants' THEN
 SELECT source INTO v_source FROM public.account_restriction_targets WHERE user_id=NEW.target_user_id;
 IF NEW.source IS DISTINCT FROM v_source THEN RAISE EXCEPTION 'Target source mismatch.' USING ERRCODE='23514'; END IF;
 END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_readiness_source() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER support_readiness_guard BEFORE INSERT OR UPDATE ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE TRIGGER support_reviewer_source_guard BEFORE INSERT OR UPDATE ON public.support_reviewers FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE TRIGGER support_dispatch_source_guard BEFORE INSERT OR UPDATE ON public.support_dispatch_grants FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE TRIGGER support_choice_source_guard BEFORE INSERT OR UPDATE ON public.support_reviewer_choices FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE TRIGGER restriction_target_source_guard BEFORE INSERT OR UPDATE ON public.account_restriction_targets FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE TRIGGER restriction_grant_source_guard BEFORE INSERT OR UPDATE ON public.account_restriction_grants FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_source();
--> statement-breakpoint
CREATE FUNCTION public.validate_response_state() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE v_case uuid; c public.support_cases%ROWTYPE;r public.support_case_responses%ROWTYPE;v_assignee text;v_assignment integer;
BEGIN
 IF TG_TABLE_NAME='support_cases' THEN v_case:=NEW.id; ELSE v_case:=NEW.case_id; END IF;
 SELECT * INTO c FROM public.support_cases WHERE id=v_case;SELECT * INTO r FROM public.support_case_responses WHERE case_id=v_case;
 IF c.source='synthetic_readiness' THEN
 IF r.case_id IS NULL OR r.provenance<>c.source THEN RAISE EXCEPTION 'Missing response receipt.' USING ERRCODE='23514'; END IF;
 SELECT reviewer_user_id INTO v_assignee FROM public.support_case_assignments WHERE case_id=v_case;
 SELECT max(revision) INTO v_assignment FROM public.support_assignment_events WHERE case_id=v_case;
 IF r.assignment_revision IS DISTINCT FROM v_assignment OR (r.acknowledged_by IS NOT NULL AND r.acknowledged_by IS DISTINCT FROM v_assignee) THEN RAISE EXCEPTION 'Stale response assignment receipt.' USING ERRCODE='23514'; END IF;
 ELSIF r.case_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid response source.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.validate_response_state() FROM PUBLIC;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER support_response_receipt_required AFTER INSERT OR UPDATE ON public.support_cases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_response_state();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER support_response_assignment_valid AFTER INSERT OR UPDATE ON public.support_case_responses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_response_state();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER support_response_assignee_valid AFTER INSERT OR UPDATE ON public.support_case_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_response_state();
--> statement-breakpoint
CREATE FUNCTION public.validate_response_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.version !~ '^[a-z0-9][a-z0-9_-]{0,63}$' OR NEW.reference !~ '^policy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NEW.reporting_guidance_reference !~ '^(policy|synthetic):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NEW.meeting_guidance_reference !~ '^(policy|synthetic):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR cardinality(NEW.allowed_actions)<>(SELECT count(DISTINCT code) FROM unnest(NEW.allowed_actions) code) OR cardinality(NEW.reason_codes) NOT BETWEEN 1 AND 2 OR cardinality(NEW.reason_codes)<>(SELECT count(DISTINCT code) FROM unnest(NEW.reason_codes) code) OR EXISTS(SELECT 1 FROM unnest(ARRAY[NEW.responsible_owner_id,NEW.escalation_owner_id]) id WHERE NOT EXISTS(SELECT 1 FROM public.support_reviewers r WHERE r.user_id=id AND r.source=NEW.provenance)) THEN RAISE EXCEPTION 'Invalid synthetic response packet.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.validate_response_policy() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER response_policy_valid BEFORE INSERT ON public.support_response_policies FOR EACH ROW EXECUTE FUNCTION public.validate_response_policy();
--> statement-breakpoint
CREATE FUNCTION public.guard_readiness_case_history() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_user='learli_app' AND EXISTS(SELECT 1 FROM public.support_cases c WHERE c.id=NEW.case_id AND c.source='synthetic_readiness') THEN RAISE EXCEPTION 'Readiness history requires scoped functions.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_readiness_case_history() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER readiness_case_history_guard BEFORE INSERT ON public.support_case_events FOR EACH ROW EXECUTE FUNCTION public.guard_readiness_case_history();
