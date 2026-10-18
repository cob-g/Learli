CREATE TABLE "local_workflow_claims" (
	"actor_user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_workflow_claims_actor_user_id_request_id_pk" PRIMARY KEY("actor_user_id","request_id"),
	CONSTRAINT "local_workflow_claim_shape" CHECK ("local_workflow_claims"."kind" IN ('admission','screening','booking','support','account') AND char_length("local_workflow_claims"."target_id") BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE TABLE "local_workflow_staff" (
	"user_id" text PRIMARY KEY NOT NULL,
	"capabilities" text[] NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_workflow_staff_shape" CHECK ("local_workflow_staff"."status" IN ('active','revoked') AND cardinality("local_workflow_staff"."capabilities") BETWEEN 1 AND 5 AND array_position("local_workflow_staff"."capabilities",NULL) IS NULL AND "local_workflow_staff"."capabilities" <@ ARRAY['admission','screening','booking','support','account']::text[])
);
--> statement-breakpoint
ALTER TABLE "guardian_learner_links" DROP CONSTRAINT "guardian_learner_links_source";--> statement-breakpoint
ALTER TABLE "learner_profiles" DROP CONSTRAINT "learner_profiles_source";--> statement-breakpoint
ALTER TABLE "booking_lifecycle_events" DROP CONSTRAINT "booking_lifecycle_events_event_check";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_local_source";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_demo_state";--> statement-breakpoint
ALTER TABLE "support_cases" DROP CONSTRAINT "support_cases_source";--> statement-breakpoint
ALTER TABLE "support_reviewers" DROP CONSTRAINT "support_reviewers_source";--> statement-breakpoint
ALTER TABLE "support_reviewers" DROP CONSTRAINT "support_reviewers_expiry";--> statement-breakpoint
ALTER TABLE "account_restriction_events" DROP CONSTRAINT "restriction_event_policy_receipt";--> statement-breakpoint
ALTER TABLE "account_restriction_events" DROP CONSTRAINT "account_restriction_events_shape";--> statement-breakpoint
ALTER TABLE "account_restriction_grants" DROP CONSTRAINT "account_restriction_grants_source";--> statement-breakpoint
ALTER TABLE "account_restriction_targets" DROP CONSTRAINT "account_restriction_targets_source";--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" DROP CONSTRAINT "support_dispatch_grants_source_check";--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" DROP CONSTRAINT "support_dispatch_grants_expiry";--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" DROP CONSTRAINT "support_reviewer_choices_source_check";--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" DROP CONSTRAINT "support_reviewer_choices_expiry";--> statement-breakpoint
ALTER TABLE "tutor_screening_cases" DROP CONSTRAINT "screening_case_source";--> statement-breakpoint
ALTER TABLE "tutor_screening_policies" DROP CONSTRAINT "screening_policy_source";--> statement-breakpoint
ALTER TABLE "tutor_screening_policies" DROP CONSTRAINT "screening_policy_window";--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" DROP CONSTRAINT "screening_staff_source";--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" DROP CONSTRAINT "screening_staff_status";--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" DROP CONSTRAINT "learner_admission_evidence_shape";--> statement-breakpoint
ALTER TABLE "learner_admission_policies" DROP CONSTRAINT "learner_admission_policy_synthetic";--> statement-breakpoint
ALTER TABLE "learner_admission_reviewers" DROP CONSTRAINT "learner_admission_reviewers_scope";--> statement-breakpoint
ALTER TABLE "learner_admissions" DROP CONSTRAINT "learner_admissions_shape";--> statement-breakpoint
ALTER TABLE "booking_workflow_grants" DROP CONSTRAINT "booking_workflow_grant_shape";--> statement-breakpoint
ALTER TABLE "booking_workflow_policies" DROP CONSTRAINT "booking_workflow_policy_shape";--> statement-breakpoint
ALTER TABLE "booking_workflow_policy_head" DROP CONSTRAINT "booking_workflow_policy_head_source_check";--> statement-breakpoint
ALTER TABLE "tutor_screening_policies" ALTER COLUMN "valid_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" ALTER COLUMN "valid_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_workflow_grants" ALTER COLUMN "valid_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "local_workflow_claims" ADD CONSTRAINT "local_workflow_claims_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_workflow_staff" ADD CONSTRAINT "local_workflow_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_learner_links" ADD CONSTRAINT "guardian_learner_links_source" CHECK ("guardian_learner_links"."source" IN ('local_fixture', 'synthetic_readiness', 'local_operation'));--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_source" CHECK ("learner_profiles"."source" IN ('local_fixture', 'synthetic_readiness', 'local_operation'));--> statement-breakpoint
ALTER TABLE "booking_lifecycle_events" ADD CONSTRAINT "booking_lifecycle_events_event_check" CHECK (("booking_lifecycle_events"."workflow_policy_id" IS NULL AND "booking_lifecycle_events"."event" IN ('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed') AND "booking_lifecycle_events"."workflow_revision" IS NULL AND "booking_lifecycle_events"."reason_code" IS NULL) OR ("booking_lifecycle_events"."workflow_policy_id" IS NOT NULL AND "booking_lifecycle_events"."event" IN ('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled') AND "booking_lifecycle_events"."workflow_revision">=0 AND "booking_lifecycle_events"."reason_code" IN ('synthetic_request','synthetic_prerequisite_review','synthetic_completed','synthetic_no_show','synthetic_participant_change','synthetic_expiry','local_request','local_prerequisite_review','local_completed','local_no_show','local_participant_change','local_expiry')));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_local_source" CHECK ("bookings"."source" IN ('local_simulation','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_demo_state" CHECK (("bookings"."source"='local_simulation' AND "bookings"."state" IN ('demo_reserved','demo_expired','demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND "bookings"."workflow_policy_id" IS NULL AND "bookings"."admission_policy_id" IS NULL AND "bookings"."workflow_revision"=0) OR ("bookings"."source" IN ('synthetic_readiness','local_operation') AND "bookings"."state" IN ('provisional','confirmed','completed','no_show','expired','cancelled','replaced') AND "bookings"."workflow_policy_id" IS NOT NULL AND "bookings"."admission_policy_id" IS NOT NULL AND "bookings"."workflow_revision">=0));--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_source" CHECK ("support_cases"."source" IN ('local_synthetic','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD CONSTRAINT "support_reviewers_source" CHECK ("support_reviewers"."source" IN ('local_fixture','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD CONSTRAINT "support_reviewers_expiry" CHECK (("support_reviewers"."source" IN ('local_fixture','local_operation') AND "support_reviewers"."valid_until" IS NULL) OR ("support_reviewers"."source"='synthetic_readiness' AND "support_reviewers"."valid_until" IS NOT NULL AND isfinite("support_reviewers"."valid_until")));--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "restriction_event_policy_receipt" CHECK ((("account_restriction_events"."reason" IN ('synthetic_safety_restrict','synthetic_safety_restore') AND "account_restriction_events"."policy_provenance"='synthetic_readiness' AND "account_restriction_events"."policy_version" IS NOT NULL) OR ("account_restriction_events"."reason" IN ('local_access_test','local_review_test','local_restore_test','local_restrict','local_restore') AND "account_restriction_events"."policy_provenance" IS NULL AND "account_restriction_events"."policy_version" IS NULL)) IS TRUE);--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "account_restriction_events_shape" CHECK ((("account_restriction_events"."previous_status" = 'active' AND "account_restriction_events"."next_status" = 'suspended' AND "account_restriction_events"."reason" IN ('local_access_test','local_review_test','synthetic_safety_restrict','local_restrict')) OR ("account_restriction_events"."previous_status" = 'suspended' AND "account_restriction_events"."next_status" = 'active' AND "account_restriction_events"."reason" IN ('local_restore_test','synthetic_safety_restore','local_restore'))) IS TRUE);--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD CONSTRAINT "account_restriction_grants_source" CHECK (("account_restriction_grants"."source"='local_fixture' AND "account_restriction_grants"."valid_until" IS NULL AND "account_restriction_grants"."permitted_actions" IS NULL) OR ("account_restriction_grants"."source"='local_operation' AND "account_restriction_grants"."valid_until" IS NULL AND "account_restriction_grants"."permitted_actions" <@ ARRAY['restrict','restore']::text[] AND cardinality("account_restriction_grants"."permitted_actions") BETWEEN 1 AND 2) OR ("account_restriction_grants"."source"='synthetic_readiness' AND "account_restriction_grants"."valid_until" IS NOT NULL AND isfinite("account_restriction_grants"."valid_until") AND cardinality("account_restriction_grants"."permitted_actions") BETWEEN 1 AND 2 AND "account_restriction_grants"."permitted_actions" <@ ARRAY['restrict','restore']::text[]));--> statement-breakpoint
ALTER TABLE "account_restriction_targets" ADD CONSTRAINT "account_restriction_targets_source" CHECK ("account_restriction_targets"."source" IN ('local_fixture','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" ADD CONSTRAINT "support_dispatch_grants_source_check" CHECK ("support_dispatch_grants"."source" IN ('local_fixture','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "support_dispatch_grants" ADD CONSTRAINT "support_dispatch_grants_expiry" CHECK (("support_dispatch_grants"."source" IN ('local_fixture','local_operation') AND "support_dispatch_grants"."valid_until" IS NULL) OR ("support_dispatch_grants"."source"='synthetic_readiness' AND "support_dispatch_grants"."valid_until" IS NOT NULL AND isfinite("support_dispatch_grants"."valid_until")));--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD CONSTRAINT "support_reviewer_choices_source_check" CHECK ("support_reviewer_choices"."source" IN ('local_fixture','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "support_reviewer_choices" ADD CONSTRAINT "support_reviewer_choices_expiry" CHECK (("support_reviewer_choices"."source" IN ('local_fixture','local_operation') AND "support_reviewer_choices"."valid_until" IS NULL) OR ("support_reviewer_choices"."source"='synthetic_readiness' AND "support_reviewer_choices"."valid_until" IS NOT NULL AND isfinite("support_reviewer_choices"."valid_until")));--> statement-breakpoint
ALTER TABLE "tutor_screening_cases" ADD CONSTRAINT "screening_case_source" CHECK ("tutor_screening_cases"."provenance" IN ('synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "tutor_screening_policies" ADD CONSTRAINT "screening_policy_source" CHECK ("tutor_screening_policies"."provenance" IN ('synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "tutor_screening_policies" ADD CONSTRAINT "screening_policy_window" CHECK (isfinite("tutor_screening_policies"."valid_from") AND (("tutor_screening_policies"."provenance"='local_operation' AND "tutor_screening_policies"."valid_until" IS NULL) OR ("tutor_screening_policies"."valid_until" IS NOT NULL AND isfinite("tutor_screening_policies"."valid_until") AND "tutor_screening_policies"."valid_until">"tutor_screening_policies"."valid_from")));--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" ADD CONSTRAINT "screening_staff_source" CHECK ("tutor_screening_staff"."provenance" IN ('local_fixture','synthetic_readiness','local_operation'));--> statement-breakpoint
ALTER TABLE "tutor_screening_staff" ADD CONSTRAINT "screening_staff_status" CHECK ("tutor_screening_staff"."status" IN ('authorized','revoked') AND "tutor_screening_staff"."capability"='screening_reviewer' AND (("tutor_screening_staff"."provenance"='local_operation' AND "tutor_screening_staff"."valid_until" IS NULL) OR ("tutor_screening_staff"."valid_until" IS NOT NULL AND isfinite("tutor_screening_staff"."valid_until"))));--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" ADD CONSTRAINT "learner_admission_evidence_shape" CHECK ("learner_admission_evidence"."source" IN ('synthetic_readiness','local_operation') AND "learner_admission_evidence"."check_code" IN ('guardian_authority','guardian_notice','independent_eligibility') AND "learner_admission_evidence"."reference" ~ '^[A-Za-z0-9:_-]{1,128}$' AND "learner_admission_evidence"."fingerprint" ~ '^[a-f0-9]{64}$' AND "learner_admission_evidence"."subject_user_id"<>"learner_admission_evidence"."recorded_by_user_id" AND ("learner_admission_evidence"."revoked_at" IS NULL OR "learner_admission_evidence"."revoked_at">="learner_admission_evidence"."recorded_at"));--> statement-breakpoint
ALTER TABLE "learner_admission_policies" ADD CONSTRAINT "learner_admission_policy_synthetic" CHECK ((("learner_admission_policies"."source"='synthetic_readiness' AND "learner_admission_policies"."authority"='synthetic_test' AND "learner_admission_policies"."version"='synthetic-admission-v1' AND "learner_admission_policies"."reference"='synthetic:admission:v1' AND "learner_admission_policies"."market_code"='synthetic_test' AND "learner_admission_policies"."notice_version"='synthetic-notice-v1' AND "learner_admission_policies"."guardian_proof_method"='synthetic_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='synthetic_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$') OR ("learner_admission_policies"."source"='local_operation' AND "learner_admission_policies"."authority"='local_operation' AND "learner_admission_policies"."version"='local-admission-v1' AND "learner_admission_policies"."reference"='local:admission:v1' AND "learner_admission_policies"."market_code"='local_operation' AND "learner_admission_policies"."notice_version"='local-notice-v1' AND "learner_admission_policies"."guardian_proof_method"='local_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='local_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$')));--> statement-breakpoint
ALTER TABLE "learner_admission_reviewers" ADD CONSTRAINT "learner_admission_reviewers_scope" CHECK ("learner_admission_reviewers"."source" IN ('synthetic_readiness','local_operation') AND "learner_admission_reviewers"."capability_code"='learner_admission_review');--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_shape" CHECK ("learner_admissions"."source" IN ('synthetic_readiness','local_operation') AND "learner_admissions"."management" IN ('guardian','self') AND "learner_admissions"."state" IN ('pending','authorized','rejected','revoked') AND "learner_admissions"."revision">=0 AND "learner_admissions"."request_fingerprint" ~ '^[a-f0-9]{64}$' AND ("learner_admissions"."selection_path" IS NULL OR char_length("learner_admissions"."selection_path")<=2048));--> statement-breakpoint
ALTER TABLE "booking_workflow_grants" ADD CONSTRAINT "booking_workflow_grant_shape" CHECK ("booking_workflow_grants"."action" IN ('confirm','complete','no_show') AND (("booking_workflow_grants"."valid_until" IS NOT NULL AND isfinite("booking_workflow_grants"."valid_until") AND "booking_workflow_grants"."reference" ~ '^synthetic:[0-9a-f-]{36}$') OR ("booking_workflow_grants"."valid_until" IS NULL AND "booking_workflow_grants"."reference" ~ '^local:[0-9a-f-]{36}$')));--> statement-breakpoint
ALTER TABLE "booking_workflow_policies" ADD CONSTRAINT "booking_workflow_policy_shape" CHECK ((("booking_workflow_policies"."version"='synthetic-booking-v1' AND "booking_workflow_policies"."reference"='synthetic:booking:v1') OR ("booking_workflow_policies"."version"='synthetic-booking-v2' AND "booking_workflow_policies"."reference"='synthetic:booking:v2') OR ("booking_workflow_policies"."version"='local-booking-v1' AND "booking_workflow_policies"."reference"='local:booking:v1')) AND "booking_workflow_policies"."content_digest" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "booking_workflow_policy_head" ADD CONSTRAINT "booking_workflow_policy_head_source" CHECK ("booking_workflow_policy_head"."source" IN ('synthetic_readiness','local_operation'));
--> statement-breakpoint
CREATE FUNCTION public.local_workflow_identity(p_actor text,p_session text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active'); $$;
--> statement-breakpoint
CREATE FUNCTION public.workflow_identity(p_actor text,p_session text,p_source text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE p_source WHEN 'local_operation' THEN public.local_workflow_identity(p_actor,p_session) WHEN 'synthetic_readiness' THEN public.admission_identity(p_actor,p_session) ELSE false END; $$;
--> statement-breakpoint
CREATE FUNCTION public.has_local_workflow_staff(p_actor text,p_session text,p_capability text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.local_workflow_identity(p_actor,p_session) AND public.has_admin_assurance(p_actor,p_session,28800) AND EXISTS(SELECT 1 FROM public.local_workflow_staff s WHERE s.user_id=p_actor AND s.status='active' AND p_capability=ANY(s.capabilities)); $$;
--> statement-breakpoint
-- Extend the existing admission_policy_current contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.admission_policy_current(p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public.learner_admission_policies p JOIN public.learner_admission_policy_state s
 ON s.current_policy_id=p.id AND s.source=p.source AND s.market_code=p.market_code
 WHERE p.id=p_policy AND ((p.source='synthetic_readiness' AND p.authority='synthetic_test') OR (p.source='local_operation' AND p.authority='local_operation')) AND s.enabled);
$$;
--> statement-breakpoint
-- Extend the existing has_current_learner_authority contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.has_current_learner_authority(p_actor text,p_session text,p_learner uuid,p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admission_policies WHERE id=p_policy)) AND public.admission_policy_current(p_policy) AND EXISTS(
 SELECT 1 FROM public.learner_profiles l JOIN public.learner_admissions a ON a.learner_id=l.id
 JOIN public.learner_admission_policies p ON p.id=a.policy_id
 WHERE l.id=p_learner AND l.source IN ('synthetic_readiness','local_operation') AND l.source=p.source AND l.status='active' AND a.state='authorized'
 AND a.source=l.source AND a.management=l.management AND a.policy_id=p_policy
 AND a.policy_version=p.version AND a.policy_reference=p.reference AND a.policy_digest=p.content_digest
 AND a.requester_user_id=p_actor AND public.admission_evidence_complete(a.id)
 AND ((l.management='self' AND l.user_id=p_actor AND l.level='college_support'
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor AND r.role='student'))
 OR (l.management='guardian' AND l.user_id IS NULL
 AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.guardian_learner_links g ON g.guardian_user_id=r.user_id
 WHERE r.user_id=p_actor AND r.role='parent' AND g.learner_id=l.id AND g.source=l.source AND g.status='authorized'))));
$$;
--> statement-breakpoint
-- Extend the existing admission_reviewer_allowed contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.admission_reviewer_allowed(p_actor text,p_session text,p_admission uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admissions WHERE id=p_admission)) AND public.has_admin_assurance(p_actor,p_session,28800)
 AND EXISTS(SELECT 1 FROM public.learner_admissions a JOIN public.learner_admission_policies p ON p.id=a.policy_id
 JOIN public.learner_admission_assignments x ON x.admission_id=a.id
 JOIN public.learner_admission_reviewers r ON r.user_id=x.reviewer_user_id AND r.source=x.source AND r.capability_code=x.capability_code
 WHERE a.id=p_admission AND a.requester_user_id<>p_actor AND x.reviewer_user_id=p_actor
 AND x.source=a.source AND x.capability_code=p.reviewer_capability_code AND r.active AND (a.source<>'local_operation' OR public.has_local_workflow_staff(p_actor,p_session,'admission')));
$$;
--> statement-breakpoint
-- Extend the existing create_learner_admission contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.create_learner_admission(p_actor text,p_session text,p_request uuid,p_policy uuid,p_management text,p_name text,p_level text,p_zone text,p_selection text)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_policy public.learner_admission_policies%ROWTYPE; v_prior public.learner_admissions%ROWTYPE; v_hash text; v_a uuid; v_l uuid; v_now timestamptz;
BEGIN
 PERFORM 1 FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.learner_admission_policy_state s JOIN public.learner_admission_policies p
 ON p.source=s.source AND p.market_code=s.market_code WHERE p.id=p_policy FOR SHARE OF s;
 IF NOT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admission_policies WHERE id=p_policy)) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF NOT public.admission_policy_current(p_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 SELECT p.* INTO v_policy FROM public.learner_admission_policies p WHERE p.id=p_policy;
 IF p_request IS NULL OR NOT (p_management IN('guardian','self')) IS TRUE OR p_name IS NULL OR p_name<>btrim(p_name)
 OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
 OR NOT(p_level IN('elementary','middle_school','high_school','college_support')) IS TRUE
 OR (p_management='self' AND p_level<>'college_support') OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64
 OR p_zone ~* '^etc/' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
 OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$')
 OR NOT public.valid_admission_selection(p_selection)
 THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 v_hash:=encode(sha256(convert_to(jsonb_build_array(p_policy,p_management,p_name,p_level,p_zone,p_selection)::text,'UTF8')),'hex');
 SELECT a.* INTO v_prior FROM public.learner_admissions a WHERE a.requester_user_id=p_actor AND a.request_id=p_request;
 IF FOUND THEN
  IF v_prior.request_fingerprint<>v_hash THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;
  ELSE RETURN QUERY SELECT 'replayed'::text,v_prior.id,v_prior.learner_id,0; END IF; RETURN;
 END IF;
 IF p_management='self' AND EXISTS(SELECT 1 FROM public.learner_profiles l WHERE l.user_id=p_actor)
 THEN RETURN QUERY SELECT 'exists'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF p_management='guardian' AND (SELECT count(*) FROM public.learner_admissions a WHERE a.requester_user_id=p_actor AND a.management='guardian')>=20
 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request)
 THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 v_a:=gen_random_uuid();v_l:=gen_random_uuid();v_now:=clock_timestamp();
 INSERT INTO public.learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone,status,created_at,updated_at)
 VALUES(v_l,(CASE WHEN v_policy.source='local_operation' THEN 'local-admission:' ELSE 'readiness-admission:' END)||v_a::text,v_policy.source,p_management,CASE WHEN p_management='self' THEN p_actor END,p_name,p_level,p_zone,'inactive',v_now,v_now);
 INSERT INTO public.learner_admissions(id,requester_user_id,learner_id,management,source,policy_id,policy_version,policy_reference,policy_digest,request_id,request_fingerprint,selection_path,created_at,updated_at)
 VALUES(v_a,p_actor,v_l,p_management,v_policy.source,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,p_request,v_hash,p_selection,v_now,v_now);
 INSERT INTO public.learner_admission_events(admission_id,actor_user_id,request_id,fingerprint,event,to_state,revision,policy_id,policy_version,policy_reference,policy_digest,created_at)
 VALUES(v_a,p_actor,p_request,v_hash,'requested','pending',0,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,v_now);
 IF NOT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admission_policies WHERE id=p_policy)) OR NOT public.admission_policy_current(p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'created'::text,v_a,v_l,0;
END;
$$;
--> statement-breakpoint
-- Extend the existing create_learner_admission_with_grade contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.create_learner_admission_with_grade(p_actor text,p_session text,p_request uuid,p_policy uuid,p_management text,p_name text,p_level text,p_zone text,p_selection text,p_grade integer)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_policy public.learner_admission_policies%ROWTYPE; v_prior public.learner_admissions%ROWTYPE; v_hash text; v_a uuid; v_l uuid; v_now timestamptz;
BEGIN
 PERFORM 1 FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.learner_admission_policy_state s JOIN public.learner_admission_policies p
 ON p.source=s.source AND p.market_code=s.market_code WHERE p.id=p_policy FOR SHARE OF s;
 IF NOT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admission_policies WHERE id=p_policy)) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF NOT public.admission_policy_current(p_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 SELECT p.* INTO v_policy FROM public.learner_admission_policies p WHERE p.id=p_policy;
 IF p_request IS NULL OR NOT (p_management IN('guardian','self')) IS TRUE OR p_name IS NULL OR p_name<>btrim(p_name)
 OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
 OR NOT(p_level IN('elementary','middle_school','high_school','college_support')) IS TRUE
 OR (p_grade IS NOT NULL AND (p_grade NOT BETWEEN 1 AND 12 OR p_management<>'guardian' OR p_level='college_support'))
 OR (p_management='self' AND p_level<>'college_support') OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64
 OR p_zone ~* '^etc/' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
 OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$')
 OR NOT public.valid_admission_selection(p_selection)
 THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 v_hash:=encode(sha256(convert_to((CASE WHEN p_grade IS NULL THEN jsonb_build_array(p_policy,p_management,p_name,p_level,p_zone,p_selection) ELSE jsonb_build_array(p_policy,p_management,p_name,p_level,p_zone,p_selection,p_grade) END)::text,'UTF8')),'hex');
 SELECT a.* INTO v_prior FROM public.learner_admissions a WHERE a.requester_user_id=p_actor AND a.request_id=p_request;
 IF FOUND THEN
  IF v_prior.request_fingerprint<>v_hash THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;
  ELSE RETURN QUERY SELECT 'replayed'::text,v_prior.id,v_prior.learner_id,0; END IF; RETURN;
 END IF;
 IF p_management='self' AND EXISTS(SELECT 1 FROM public.learner_profiles l WHERE l.user_id=p_actor)
 THEN RETURN QUERY SELECT 'exists'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF p_management='guardian' AND (SELECT count(*) FROM public.learner_admissions a WHERE a.requester_user_id=p_actor AND a.management='guardian')>=20
 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request)
 THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
 v_a:=gen_random_uuid();v_l:=gen_random_uuid();v_now:=clock_timestamp();
 INSERT INTO public.learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone,grade,status,created_at,updated_at)
 VALUES(v_l,(CASE WHEN v_policy.source='local_operation' THEN 'local-admission:' ELSE 'readiness-admission:' END)||v_a::text,v_policy.source,p_management,CASE WHEN p_management='self' THEN p_actor END,p_name,p_level,p_zone,p_grade,'inactive',v_now,v_now);
 INSERT INTO public.learner_admissions(id,requester_user_id,learner_id,management,source,policy_id,policy_version,policy_reference,policy_digest,request_id,request_fingerprint,selection_path,created_at,updated_at)
 VALUES(v_a,p_actor,v_l,p_management,v_policy.source,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,p_request,v_hash,p_selection,v_now,v_now);
 INSERT INTO public.learner_admission_events(admission_id,actor_user_id,request_id,fingerprint,event,to_state,revision,policy_id,policy_version,policy_reference,policy_digest,created_at)
 VALUES(v_a,p_actor,p_request,v_hash,'requested','pending',0,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,v_now);
 IF NOT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.learner_admission_policies WHERE id=p_policy)) OR NOT public.admission_policy_current(p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'created'::text,v_a,v_l,0;
END;
$$;
--> statement-breakpoint
-- Extend the existing record_learner_admission_evidence contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.record_learner_admission_evidence(p_actor text,p_session text,p_admission uuid,p_revision integer,p_request uuid,p_check text,p_reference text)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_p public.learner_admission_policies%ROWTYPE;v_prior public.learner_admission_events%ROWTYPE;v_hash text;v_id uuid;v_rev integer;v_now timestamptz;
BEGIN
 PERFORM public.lock_learner_admission(p_actor,p_session,p_admission);
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=p_admission;
 SELECT p.* INTO v_p FROM public.learner_admission_policies p WHERE p.id=v_a.policy_id;
 v_hash:=encode(sha256(convert_to(jsonb_build_array(p_admission,p_revision,'evidence_recorded',p_check,p_reference)::text,'UTF8')),'hex');
 SELECT e.* INTO v_prior FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
 IF FOUND THEN
  IF v_prior.fingerprint<>v_hash THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;
  ELSE RETURN QUERY SELECT 'replayed'::text,v_a.id,v_a.learner_id,v_prior.revision;END IF;RETURN;
 END IF;
 IF p_request IS NULL OR p_revision IS NULL OR p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9:_-]{1,128}$'
 OR NOT((v_a.management='guardian' AND p_check IN('guardian_authority','guardian_notice')) OR (v_a.management='self' AND p_check='independent_eligibility')) IS TRUE
 THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF v_a.revision<>p_revision OR v_a.state<>'pending' THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF NOT public.admission_policy_current(v_a.policy_id) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.learner_admission_evidence e WHERE e.source=v_a.source AND e.reference=p_reference)
 THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF (SELECT count(*) FROM public.learner_admission_evidence e WHERE e.admission_id=p_admission)>=16
 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 v_id:=gen_random_uuid();v_now:=clock_timestamp();
 INSERT INTO public.learner_admission_evidence(id,admission_id,policy_id,source,check_code,method,notice_version,reference,subject_user_id,recorded_by_user_id,request_id,fingerprint,recorded_at)
 VALUES(v_id,p_admission,v_a.policy_id,v_a.source,p_check,CASE WHEN v_a.management='guardian' THEN v_p.guardian_proof_method ELSE v_p.independent_eligibility_rule END,
 CASE WHEN p_check='guardian_notice' THEN v_p.notice_version END,p_reference,v_a.requester_user_id,p_actor,p_request,v_hash,v_now);
 v_rev:=public.append_learner_admission_event(p_admission,p_actor,p_request,v_hash,'evidence_recorded',v_a.state,v_id,v_now);
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) OR NOT public.admission_policy_current(v_a.policy_id) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'recorded'::text,v_a.id,v_a.learner_id,v_rev;
END;
$$;
--> statement-breakpoint
-- Extend the existing decide_learner_admission contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.decide_learner_admission(p_actor text,p_session text,p_admission uuid,p_revision integer,p_request uuid,p_action text)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_prior public.learner_admission_events%ROWTYPE;v_hash text;v_to text;v_now timestamptz;v_rev integer;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Admission decisions require read committed' USING ERRCODE='25001';END IF;
 PERFORM public.lock_learner_admission(p_actor,p_session,p_admission);
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=p_admission;
 v_hash:=encode(sha256(convert_to(jsonb_build_array(p_admission,p_revision,p_action)::text,'UTF8')),'hex');
 SELECT e.* INTO v_prior FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
 IF FOUND THEN
  IF v_prior.fingerprint<>v_hash THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;
  ELSE RETURN QUERY SELECT 'replayed'::text,v_a.id,v_a.learner_id,v_prior.revision;END IF;RETURN;
 END IF;
 IF p_request IS NULL OR p_revision IS NULL OR NOT(p_action IN('authorize','reject','revoke')) IS TRUE
 THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF v_a.revision<>p_revision OR NOT((v_a.state='pending' AND p_action IN('authorize','reject')) OR(v_a.state='authorized' AND p_action='revoke'))
 THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF p_action='authorize' THEN
  IF NOT public.admission_policy_current(v_a.policy_id) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
  IF NOT public.admission_evidence_complete(p_admission) OR NOT EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access x ON x.user_id=u.id
    WHERE u.id=v_a.requester_user_id AND u.email_verified AND (v_a.source='local_operation' OR u.email LIKE '%.test') AND x.status='active')
  THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 END IF;
 v_now:=clock_timestamp();v_to:=CASE p_action WHEN 'authorize' THEN 'authorized' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END;
 UPDATE public.learner_profiles SET status=CASE WHEN p_action='authorize' THEN 'active' ELSE 'inactive' END,updated_at=v_now WHERE id=v_a.learner_id;
 IF p_action='authorize' THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(v_a.requester_user_id,CASE WHEN v_a.management='guardian' THEN 'parent' ELSE 'student' END) ON CONFLICT DO NOTHING;
  IF v_a.management='guardian' THEN
   INSERT INTO public.guardian_learner_links(guardian_user_id,learner_id,source,status,created_at,updated_at) VALUES(v_a.requester_user_id,v_a.learner_id,v_a.source,'authorized',v_now,v_now);
  END IF;
 ELSIF p_action='revoke' AND v_a.management='guardian' THEN
  UPDATE public.guardian_learner_links g SET status='revoked',updated_at=v_now WHERE g.learner_id=v_a.learner_id AND g.guardian_user_id=v_a.requester_user_id;
 END IF;
 v_rev:=public.append_learner_admission_event(p_admission,p_actor,p_request,v_hash,v_to,v_to,NULL,v_now);
 IF p_action='authorize' AND (NOT public.admission_policy_current(v_a.policy_id) OR NOT public.admission_evidence_complete(p_admission) OR NOT EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access x ON x.user_id=u.id WHERE u.id=v_a.requester_user_id AND u.email_verified AND (v_a.source='local_operation' OR u.email LIKE '%.test') AND x.status='active')) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'decided'::text,v_a.id,v_a.learner_id,v_rev;
END;
$$;
--> statement-breakpoint
-- Extend the existing protect_learner_admission_records contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.protect_learner_admission_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Admission records are retained.' USING ERRCODE='55000';END IF;
 IF TG_TABLE_NAME IN('learner_admission_events','learner_admission_policies') THEN
  RAISE EXCEPTION 'Admission receipts are immutable.' USING ERRCODE='55000';
 ELSIF TG_TABLE_NAME='learner_admissions' THEN
  IF (to_jsonb(NEW)-ARRAY['state','revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','revision','updated_at'])
   OR NEW.revision<>OLD.revision+1 OR NOT(
    (OLD.state='pending' AND NEW.state IN('pending','authorized','rejected'))
    OR(OLD.state='authorized' AND NEW.state IN('authorized','revoked'))
    OR(OLD.state IN('rejected','revoked') AND NEW.state=OLD.state))
  THEN RAISE EXCEPTION 'Admission transition is invalid.' USING ERRCODE='55000';END IF;
 ELSIF TG_TABLE_NAME='learner_admission_evidence' THEN
  IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
  THEN RAISE EXCEPTION 'Admission evidence is immutable.' USING ERRCODE='55000';END IF;
 ELSIF TG_TABLE_NAME='learner_profiles' THEN
  IF (OLD.id,OLD.source,OLD.management,OLD.user_id,OLD.fixture_key) IS DISTINCT FROM (NEW.id,NEW.source,NEW.management,NEW.user_id,NEW.fixture_key)
   OR(OLD.source IN ('synthetic_readiness','local_operation') AND (current_user='learli_app' OR NEW.level<>OLD.level))
  THEN RAISE EXCEPTION 'Learner provenance is protected.' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='guardian_learner_links' THEN
  IF(OLD.guardian_user_id,OLD.learner_id,OLD.management,OLD.source) IS DISTINCT FROM(NEW.guardian_user_id,NEW.learner_id,NEW.management,NEW.source)
  THEN RAISE EXCEPTION 'Guardian provenance is protected.' USING ERRCODE='55000';END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Extend the existing check_learner_admission_integrity contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.check_learner_admission_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_id uuid;v_a public.learner_admissions%ROWTYPE;v_l public.learner_profiles%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='learner_profiles' THEN
  IF NEW.source NOT IN ('synthetic_readiness','local_operation') THEN RETURN NULL;END IF;
  SELECT a.id INTO v_id FROM public.learner_admissions a WHERE a.learner_id=NEW.id;
 ELSIF TG_TABLE_NAME='guardian_learner_links' THEN
  IF NEW.source NOT IN ('synthetic_readiness','local_operation') THEN RETURN NULL;END IF;
  SELECT a.id INTO v_id FROM public.learner_admissions a WHERE a.learner_id=NEW.learner_id;
 ELSIF TG_TABLE_NAME='learner_admissions' THEN v_id:=NEW.id;
 ELSE v_id:=NEW.admission_id;END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=v_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admission provenance is required.' USING ERRCODE='23514';END IF;
 SELECT l.* INTO v_l FROM public.learner_profiles l WHERE l.id=v_a.learner_id;
 IF NOT EXISTS(SELECT 1 FROM public.learner_admission_policies p WHERE p.id=v_a.policy_id AND p.source=v_a.source) OR v_l.source<>v_a.source OR v_l.management<>v_a.management
 OR (v_l.management='self' AND (v_l.user_id IS DISTINCT FROM v_a.requester_user_id OR v_l.level<>'college_support'))
 OR v_l.status<>(CASE WHEN v_a.state='authorized' THEN 'active' ELSE 'inactive' END)
 OR NOT EXISTS(SELECT 1 FROM public.learner_admission_events e WHERE e.admission_id=v_a.id AND e.revision=v_a.revision
 AND e.to_state=v_a.state AND e.policy_id=v_a.policy_id AND e.policy_version=v_a.policy_version AND e.policy_reference=v_a.policy_reference AND e.policy_digest=v_a.policy_digest)
 OR(v_a.state='authorized' AND NOT public.admission_evidence_complete(v_a.id))
 OR EXISTS(SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=v_l.id AND
  (v_l.management<>'guardian' OR g.guardian_user_id<>v_a.requester_user_id OR g.source<>v_a.source
   OR v_a.state IN('pending','rejected') OR g.status<>(CASE WHEN v_a.state='authorized' THEN 'authorized' ELSE 'revoked' END)))
 OR(v_a.management='guardian' AND v_a.state IN('authorized','revoked') AND NOT EXISTS(SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=v_l.id AND g.guardian_user_id=v_a.requester_user_id AND g.source=v_a.source))
 THEN RAISE EXCEPTION 'Admission relationship is inconsistent.' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='learner_admission_evidence' THEN
  IF NEW.policy_id<>v_a.policy_id OR NEW.source<>v_a.source OR NEW.subject_user_id<>v_a.requester_user_id
  OR NOT EXISTS(SELECT 1 FROM public.learner_admission_policies p WHERE p.id=NEW.policy_id
   AND NEW.method=CASE WHEN v_a.management='guardian' THEN p.guardian_proof_method ELSE p.independent_eligibility_rule END
   AND ((v_a.management='guardian' AND NEW.check_code IN('guardian_authority','guardian_notice')) OR(v_a.management='self' AND NEW.check_code='independent_eligibility'))
   AND(CASE WHEN NEW.check_code='guardian_notice' THEN NEW.notice_version=p.notice_version ELSE NEW.notice_version IS NULL END) IS TRUE)
  OR NOT EXISTS(SELECT 1 FROM public.learner_admission_events e WHERE e.admission_id=v_a.id AND e.evidence_id=NEW.id AND e.event='evidence_recorded' AND e.actor_user_id=NEW.recorded_by_user_id AND e.request_id=NEW.request_id AND e.fingerprint=NEW.fingerprint)
  THEN RAISE EXCEPTION 'Admission evidence is inconsistent.' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NULL;
END;
$$;
--> statement-breakpoint
-- Extend the existing has_current_tutor_screening contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.has_current_tutor_screening(p_tutor uuid,p_scope text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (p_scope IS NOT DISTINCT FROM 'local_demo' AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=p_tutor) AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases sc WHERE sc.tutor_id=p_tutor)) OR p_scope IN ('synthetic_readiness','local_operation') AND EXISTS (
 SELECT 1 FROM public.tutor_screening_cases c
 JOIN public.tutor_screening_policy_heads h ON h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled'
 JOIN public.tutor_screening_policies p ON p.provenance=h.provenance AND p.version=h.version
 JOIN public.tutor_screening_decisions d ON d.id=c.current_decision_id AND d.tutor_id=c.tutor_id AND d.round=c.round AND d.policy_version=c.policy_version AND d.provenance=c.provenance AND d.action IN ('approve','reinstate')
 WHERE c.tutor_id=p_tutor AND c.state='approved' AND c.provenance=p_scope AND p.valid_from<=clock_timestamp() AND ((p.provenance='local_operation' AND p.valid_until IS NULL) OR p.valid_until>clock_timestamp())
 AND NOT EXISTS (SELECT 1 FROM unnest(p.required_check_codes) code WHERE NOT EXISTS (
 SELECT 1 FROM public.tutor_screening_checks ck JOIN public.tutor_screening_decision_checks dc ON dc.check_id=ck.id AND dc.check_code=code AND dc.decision_id=d.id
 WHERE ck.tutor_id=c.tutor_id AND ck.provenance=c.provenance AND ck.policy_version=c.policy_version AND ck.round=c.round AND ck.check_code=code AND ck.outcome='passed' AND ck.checked_at<=clock_timestamp() AND ck.expires_at>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer WHERE newer.tutor_id=ck.tutor_id AND newer.round=ck.round AND newer.check_code=ck.check_code AND newer.revision>ck.revision)))
 ); $$;
--> statement-breakpoint
-- Extend the existing has_tutor_screening_authority contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.has_tutor_screening_authority(p_actor text,p_session text,p_tutor uuid,p_source text) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT public.has_admin_assurance(p_actor,p_session,28800) AND EXISTS (
 SELECT 1 FROM public.tutor_screening_assignments a JOIN public.tutor_screening_staff st ON st.user_id=a.reviewer_user_id AND st.provenance=a.provenance JOIN public.tutor_profiles t ON t.id=a.tutor_id
 WHERE a.tutor_id=p_tutor AND a.reviewer_user_id=p_actor AND a.status='authorized' AND a.provenance=p_source AND st.status='authorized' AND st.capability='screening_reviewer' AND ((st.provenance='local_operation' AND st.valid_until IS NULL AND public.has_local_workflow_staff(p_actor,p_session,'screening')) OR (st.provenance<>'local_operation' AND st.valid_until>clock_timestamp())) AND t.user_id<>p_actor AND EXISTS(SELECT 1 FROM public."user" tu JOIN public.user_access ta ON ta.user_id=tu.id JOIN public.user_roles tr ON tr.user_id=tu.id AND tr.role='tutor' WHERE tu.id=t.user_id AND tu.email_verified AND ta.status='active')
 AND ((p_source='local_fixture' AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases c WHERE c.tutor_id=p_tutor)) OR (p_source IN ('synthetic_readiness','local_operation') AND EXISTS(SELECT 1 FROM public.tutor_screening_cases c WHERE c.tutor_id=p_tutor AND c.provenance=p_source)))
 ); $$;
--> statement-breakpoint
-- Extend the existing request_tutor_screening contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.request_tutor_screening(p_actor text,p_session text,p_tutor uuid,p_key uuid,p_version text)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_source text; v_tutor public.tutor_profiles%ROWTYPE; v_policy public.tutor_screening_policies%ROWTYPE;
BEGIN
 SELECT provenance INTO v_source FROM public.tutor_screening_policies WHERE version=p_version;
 SELECT * INTO v_tutor FROM public.tutor_profiles WHERE id=p_tutor FOR UPDATE;
 PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance=v_source FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active' AND (v_source='local_operation' OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
 IF v_tutor.user_id IS DISTINCT FROM p_actor THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
 SELECT p.* INTO v_policy FROM public.tutor_screening_policies p JOIN public.tutor_screening_policy_heads h ON h.provenance=p.provenance AND h.version=p.version AND h.status='enabled' WHERE p.provenance=v_source AND p.version=p_version AND p.valid_from<=clock_timestamp() AND ((p.provenance='local_operation' AND p.valid_until IS NULL) OR p.valid_until>clock_timestamp());
 IF NOT FOUND THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_events e JOIN public.tutor_screening_cases c ON c.tutor_id=e.tutor_id WHERE e.tutor_id=p_tutor AND e.kind='request' AND e.actor_user_id=p_actor AND e.request_key=p_key AND c.policy_version=p_version) THEN RETURN QUERY SELECT 'replayed'::text,0; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_cases WHERE tutor_id=p_tutor) OR v_tutor.review_status<>'pending' OR p_key IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 INSERT INTO public.tutor_screening_cases(tutor_id,provenance,policy_version) VALUES(p_tutor,v_policy.provenance,v_policy.version);
 INSERT INTO public.tutor_screening_events(tutor_id,kind,actor_user_id,request_key,revision) VALUES(p_tutor,'request',p_actor,p_key,0);
 IF NOT EXISTS(SELECT 1 FROM public.session se JOIN public."user" u ON u.id=se.user_id JOIN public.user_access ua ON ua.user_id=u.id JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='tutor' JOIN public.tutor_profiles current_tutor ON current_tutor.user_id=u.id AND current_tutor.id=p_tutor WHERE se.id=p_session AND se.user_id=p_actor AND se.expires_at>clock_timestamp() AND u.email_verified AND ua.status='active' AND (v_source='local_operation' OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')) THEN RAISE EXCEPTION 'Current tutor authority unavailable.' USING ERRCODE='P4030'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies pol ON pol.provenance=h.provenance AND pol.version=h.version WHERE h.provenance=v_source AND h.version=p_version AND h.status='enabled' AND pol.valid_from<=clock_timestamp() AND ((pol.provenance='local_operation' AND pol.valid_until IS NULL) OR pol.valid_until>clock_timestamp())) THEN RAISE EXCEPTION 'Current screening policy unavailable.' USING ERRCODE='P5030'; END IF;
 RETURN QUERY SELECT 'saved'::text,0;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
-- Extend the existing record_tutor_screening_check contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.record_tutor_screening_check(p_actor text,p_session text,p_tutor uuid,p_expected integer,p_key uuid,p_code text,p_outcome text,p_reference text,p_checked timestamptz,p_expires timestamptz)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.tutor_screening_cases%ROWTYPE; p public.tutor_screening_policies%ROWTYPE; a public.tutor_screening_assignments%ROWTYPE; prior public.tutor_screening_checks%ROWTYPE; v_id uuid; v_now timestamptz;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Screening checks require read committed' USING ERRCODE='25001';END IF;
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
 SELECT pol.* INTO p FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=c.provenance AND pol.version=c.policy_version AND pol.valid_from<=v_now AND ((pol.provenance='local_operation' AND pol.valid_until IS NULL) OR pol.valid_until>v_now);
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
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=p.provenance AND pol.version=p.version AND pol.valid_from<=clock_timestamp() AND ((pol.provenance='local_operation' AND pol.valid_until IS NULL) OR pol.valid_until>clock_timestamp())) THEN RAISE EXCEPTION 'Current policy unavailable.' USING ERRCODE='P5030'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
-- Extend the existing decide_tutor_screening contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.decide_tutor_screening(p_actor text,p_session text,p_tutor uuid,p_expected integer,p_key uuid,p_action text)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.tutor_screening_cases%ROWTYPE; p public.tutor_screening_policies%ROWTYPE; a public.tutor_screening_assignments%ROWTYPE; prior public.tutor_screening_decisions%ROWTYPE; v_id uuid; v_now timestamptz; v_state text; v_profile text; v_round integer;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Screening decisions require read committed' USING ERRCODE='25001';END IF;
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
 SELECT pol.* INTO p FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=c.provenance AND (p_action='reopen' OR pol.version=c.policy_version) AND pol.valid_from<=v_now AND ((pol.provenance='local_operation' AND pol.valid_until IS NULL) OR pol.valid_until>v_now);
 IF NOT FOUND OR NOT (p_action=ANY(p.allowed_actions)) THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer; RETURN; END IF;
 SELECT * INTO prior FROM public.tutor_screening_decisions WHERE actor_user_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF prior.tutor_id=p_tutor AND prior.expected_revision=p_expected AND prior.action=p_action THEN RETURN QUERY SELECT 'replayed'::text,prior.revision; ELSE RETURN QUERY SELECT 'conflict'::text,NULL::integer; END IF; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tutor_screening_checks WHERE actor_user_id=p_actor AND request_key=p_key) OR c.revision<>p_expected THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
 IF NOT ((p_action IN ('approve','reject') AND c.state='pending') OR (p_action='suspend' AND c.state='approved') OR (p_action='reinstate' AND c.state='suspended') OR (p_action='revoke' AND c.state<>'revoked') OR (p_action='reopen' AND (c.state IN ('rejected','revoked','suspended') OR c.policy_version<>p.version OR NOT public.has_current_tutor_screening(p_tutor,c.provenance)))) THEN RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN; END IF;
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
 IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_policies pol JOIN public.tutor_screening_policy_heads h ON h.provenance=pol.provenance AND h.version=pol.version AND h.status='enabled' WHERE pol.provenance=p.provenance AND pol.version=p.version AND pol.valid_from<=clock_timestamp() AND ((pol.provenance='local_operation' AND pol.valid_until IS NULL) OR pol.valid_until>clock_timestamp())) THEN RAISE EXCEPTION 'Current policy unavailable.' USING ERRCODE='P5030'; END IF;
 IF p_action IN ('approve','reinstate') AND NOT public.has_current_tutor_screening(p_tutor,c.provenance) THEN RAISE EXCEPTION 'Current required screening evidence unavailable.' USING ERRCODE='P4090'; END IF;
 RETURN QUERY SELECT 'saved'::text,p_expected+1;
EXCEPTION WHEN SQLSTATE 'P4090' THEN RETURN QUERY SELECT 'missing_checks'::text,NULL::integer; WHEN SQLSTATE 'P4030' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; WHEN SQLSTATE 'P4040' THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; WHEN SQLSTATE 'P5030' THEN RETURN QUERY SELECT 'unavailable'::text,NULL::integer;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_screening_rows() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE d public.tutor_screening_decisions%ROWTYPE;ck public.tutor_screening_checks%ROWTYPE;p public.tutor_screening_policies%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='tutor_screening_cases' THEN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.tutor_id<>OLD.tutor_id OR NEW.provenance<>OLD.provenance)) THEN RAISE EXCEPTION 'Screening provenance is permanent.' USING ERRCODE='55000'; END IF;
 IF NEW.current_decision_id IS NOT NULL THEN SELECT * INTO d FROM public.tutor_screening_decisions WHERE id=NEW.current_decision_id;
 IF d.tutor_id IS DISTINCT FROM NEW.tutor_id OR d.round IS DISTINCT FROM NEW.round OR d.policy_version IS DISTINCT FROM NEW.policy_version OR d.provenance IS DISTINCT FROM NEW.provenance THEN RAISE EXCEPTION 'Invalid screening head.' USING ERRCODE='23514'; END IF; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_assignments' THEN
 IF NEW.provenance IN ('synthetic_readiness','local_operation') AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_cases WHERE tutor_id=NEW.tutor_id AND provenance=NEW.provenance) THEN RAISE EXCEPTION 'Invalid screening assignment source.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.provenance<>OLD.provenance THEN RAISE EXCEPTION 'Assignment source immutable.' USING ERRCODE='55000'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_checks' THEN
 SELECT * INTO p FROM public.tutor_screening_policies WHERE provenance=NEW.provenance AND version=NEW.policy_version;
 IF NOT (NEW.check_code=ANY(p.required_check_codes)) IS TRUE OR NEW.checked_at>clock_timestamp() THEN RAISE EXCEPTION 'Invalid check receipt.' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_decision_checks' THEN
 SELECT * INTO d FROM public.tutor_screening_decisions WHERE id=NEW.decision_id;SELECT * INTO ck FROM public.tutor_screening_checks WHERE id=NEW.check_id;
 IF d.action NOT IN ('approve','reinstate') OR ck.tutor_id<>d.tutor_id OR ck.round<>d.round OR ck.policy_version<>d.policy_version OR ck.provenance<>d.provenance OR ck.check_code<>NEW.check_code OR ck.outcome<>'passed' THEN RAISE EXCEPTION 'Invalid bound check.' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='tutor_screening_policies' THEN
 IF EXISTS(SELECT 1 FROM unnest(NEW.required_check_codes) code WHERE code !~ '^[a-z][a-z0-9_]{0,47}$') OR cardinality(NEW.required_check_codes)<>(SELECT count(DISTINCT code) FROM unnest(NEW.required_check_codes) code) OR NEW.reference !~ '^policy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT ((NEW.provenance='synthetic_readiness' AND NEW.authority_reference ~ '^synthetic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') OR (NEW.provenance='local_operation' AND NEW.authority_reference ~ '^local:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN RAISE EXCEPTION 'Invalid screening packet.' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
-- Extend the existing booking_workflow_policy_current contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.booking_workflow_policy_current(p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.booking_workflow_policy_head h JOIN public.booking_workflow_policies p ON p.id=h.policy_id WHERE h.source IN ('synthetic_readiness','local_operation') AND h.source=p.terms->>'source' AND ((h.source='local_operation' AND p.version='local-booking-v1') OR (h.source='synthetic_readiness' AND p.version IN ('synthetic-booking-v1','synthetic-booking-v2'))) AND h.enabled AND p.id=p_policy AND ((h.source='synthetic_readiness' AND p.terms->>'authority'='synthetic_test') OR (h.source='local_operation' AND p.terms->>'authority'='local_operation')) AND p.terms->>'version'=p.version AND p.terms->>'reference'=p.reference AND p.terms->>'contentDigest'=p.content_digest AND p.terms->>'policyId'=p.id::text AND p.terms->>'durationMinutes'='60' AND p.terms->>'stepMinutes'='30' AND p.terms->>'noticeMinutes'='60' AND p.terms->>'horizonDays'='14' AND p.terms->>'provisionalMinutes'='10' AND p.terms->>'cancelCutoffMinutes'='60' AND p.terms->>'moveCutoffMinutes'='60' AND p.terms->>'confirmationPrerequisite'=CASE h.source WHEN 'local_operation' THEN 'local_prerequisite_review' ELSE 'synthetic_prerequisite_review' END AND p.terms->>'confirmationActor'='assigned_mfa_admin' AND p.terms->>'outcomeActor'='assigned_mfa_admin' AND (p.version='synthetic-booking-v1' OR (p.version IN ('synthetic-booking-v2','local-booking-v1') AND p.terms->>'completionActor'='assigned_tutor')) AND p.terms->>'disputePath'='/support' AND p.terms->>'meetingAccess'='confirmed_until_end'); $$;
--> statement-breakpoint
-- Extend the existing booking_workflow_tutor_current contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.booking_workflow_tutor_current(p_tutor uuid,p_learner uuid,p_subject uuid,p_offering boolean) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.has_current_tutor_screening(p_tutor,(SELECT source FROM public.learner_profiles WHERE id=p_learner)) AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public."user" u ON u.id=t.user_id JOIN public.user_access a ON a.user_id=u.id AND a.status='active' WHERE t.id=p_tutor AND t.review_status='approved' AND u.email_verified AND ((SELECT source FROM public.learner_profiles WHERE id=p_learner)='local_operation' OR u.email LIKE '%.test') AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tutor') AND (NOT p_offering OR EXISTS(SELECT 1 FROM public.tutor_subjects ts JOIN public.subjects s ON s.id=ts.subject_id AND s.is_active JOIN public.learner_profiles l ON l.id=p_learner WHERE ts.tutor_id=t.id AND s.id=p_subject AND l.level=ANY(ts.levels)))); $$;
--> statement-breakpoint
-- Extend the existing has_current_booking_beneficiary contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.has_current_booking_beneficiary(p_actor text,p_learner uuid,p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access x ON x.user_id=u.id AND x.status='active' WHERE u.id=p_actor AND u.email_verified AND ((SELECT source FROM public.learner_admission_policies WHERE id=p_policy)='local_operation' OR u.email LIKE '%.test')) AND public.admission_policy_current(p_policy) AND EXISTS(
 SELECT 1 FROM public.learner_profiles l JOIN public.learner_admissions a ON a.learner_id=l.id
 JOIN public.learner_admission_policies p ON p.id=a.policy_id
 WHERE l.id=p_learner AND l.source IN ('synthetic_readiness','local_operation') AND l.source=p.source AND l.status='active' AND a.state='authorized'
 AND a.source=l.source AND a.management=l.management AND a.policy_id=p_policy
 AND a.policy_version=p.version AND a.policy_reference=p.reference AND a.policy_digest=p.content_digest
 AND a.requester_user_id=p_actor AND public.admission_evidence_complete(a.id)
 AND ((l.management='self' AND l.user_id=p_actor AND l.level='college_support'
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor AND r.role='student'))
 OR (l.management='guardian' AND l.user_id IS NULL
 AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.guardian_learner_links g ON g.guardian_user_id=r.user_id
 WHERE r.user_id=p_actor AND r.role='parent' AND g.learner_id=l.id AND g.source=l.source AND g.status='authorized'))));
$$;
--> statement-breakpoint
-- Extend the existing has_booking_workflow_task contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.has_booking_workflow_task(p_actor text,p_session text,p_booking uuid,p_action text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.bookings b
  JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id
  JOIN public.tutor_profiles t ON t.id=b.tutor_id
  WHERE b.id=p_booking AND b.source IN ('synthetic_readiness','local_operation') AND (
   (p_action='complete' AND p.version IN ('synthetic-booking-v2','local-booking-v1')
    AND p.terms->>'completionActor'='assigned_tutor'
    AND b.state IN('confirmed','completed') AND t.user_id=p_actor
    AND public.workflow_identity(p_actor,p_session,b.source)
    AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor AND r.role='tutor')
    AND public.booking_workflow_policy_current(p.id)
    AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
    AND public.booking_workflow_tutor_current(t.id,b.learner_id,b.subject_id,false))
   OR
   ((p_action<>'complete' OR p.version='synthetic-booking-v1')
    AND public.has_admin_assurance(p_actor,p_session,28800)
    AND b.booked_by_user_id<>p_actor AND t.user_id<>p_actor
    AND EXISTS(SELECT 1 FROM public.booking_workflow_grants g
      WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=p_actor
        AND g.action=p_action AND g.active AND ((b.source='local_operation' AND g.valid_until IS NULL AND g.reference ~ '^local:[0-9a-f-]{36}$' AND public.has_local_workflow_staff(p_actor,p_session,'booking')) OR (b.source='synthetic_readiness' AND g.valid_until>clock_timestamp()))))
  )
 );
$$;
--> statement-breakpoint
-- Extend the existing create_policy_booking contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.create_policy_booking(p_actor text,p_session text,p_key uuid,p_policy uuid,p_learner uuid,p_tutor uuid,p_subject uuid,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;p public.booking_workflow_policies;n timestamptz;e uuid;ap uuid;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_key IS NULL OR p_policy IS NULL OR p_learner IS NULL OR p_tutor IS NULL OR p_subject IS NULL OR p_start IS NULL OR p_end IS NULL OR p_zone IS NULL OR p_fingerprint IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 PERFORM u.id FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=p_policy;
 IF p.id IS NULL OR NOT public.booking_workflow_policy_current(p_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 ap:=(p.terms->>'admissionPolicyId')::uuid;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,ap) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_tutor_current(p_tutor,p_learner,p_subject,true) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO b FROM public.bookings WHERE booked_by_user_id=p_actor AND idempotency_key=p_key;
 IF b.id IS NOT NULL THEN
 IF b.source IS DISTINCT FROM p.terms->>'source' OR b.request_fingerprint<>p_fingerprint OR b.workflow_policy_id<>p_policy THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT id INTO e FROM public.booking_lifecycle_events WHERE booking_lifecycle_events.booking_id=b.id AND event='workflow_provisional';
 RETURN QUERY SELECT 'replayed'::text,b.id,e;RETURN;END IF;
 n:=clock_timestamp();
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_slot_valid(p_tutor,p_start,p_end,n,NULL) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (SELECT count(*) FROM public.bookings WHERE booked_by_user_id=p_actor AND created_at>n-interval '1 minute')>=20 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM public.expire_policy_bookings(p_tutor);
 -- Legacy expiry materialization is delegated to the established shared service.
 INSERT INTO public.bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES(p.terms->>'source',p_tutor,p_learner,p_actor,p_subject,p_start,p_end,p_zone,p_key,p_fingerprint,'provisional',n,n+interval '10 minutes',p_policy,ap) RETURNING * INTO b;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,p_actor,'workflow_provisional',p_key,p_fingerprint,n,p_policy,0,CASE WHEN b.source='local_operation' THEN 'local_request' ELSE 'synthetic_request' END) RETURNING id INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,b.id,'create',p_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'created'::text,b.id,e;
END; $$;
--> statement-breakpoint
-- Extend the existing change_policy_booking contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.change_policy_booking(p_actor text,p_session text,p_booking uuid,p_request uuid,p_current_policy uuid,p_revision integer,p_action text,p_reason text,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r public.bookings;e public.booking_lifecycle_events;p public.booking_workflow_policies;n timestamptz;newstate text;family boolean;tutor boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_request IS NULL OR p_current_policy IS NULL OR p_revision IS NULL OR p_revision<0 OR NOT (p_action IN('confirm','complete','no_show','cancel','reschedule')) IS TRUE OR p_reason IS NULL OR p_fingerprint IS NULL OR (p_action='reschedule' AND (p_start IS NULL OR p_end IS NULL OR p_zone IS NULL)) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings prior ON prior.tutor_id=t.id WHERE prior.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR NO KEY UPDATE;
 IF b.id IS NULL OR b.source NOT IN ('synthetic_readiness','local_operation') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_current_policy IS DISTINCT FROM b.workflow_policy_id OR NOT public.booking_workflow_policy_current(p_current_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=b.workflow_policy_id;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.workflow_identity(p_actor,p_session,b.source) AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id);
 IF (p_action IN('cancel','reschedule') AND NOT(family OR tutor)) OR (p_action IN('confirm','complete','no_show') AND (NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action='confirm'))) OR p_action NOT IN('confirm','complete','no_show','cancel','reschedule') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE actor_user_id=p_actor AND request_id=p_request;
 IF e.id IS NOT NULL THEN
 IF e.booking_id<>b.id OR e.request_fingerprint<>p_fingerprint OR e.workflow_policy_id IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 RETURN QUERY SELECT 'replayed'::text,coalesce(e.replacement_booking_id,b.id),e.id;RETURN;END IF;
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_reason<>((CASE WHEN b.source='local_operation' THEN 'local_' ELSE 'synthetic_' END)||(CASE p_action WHEN 'confirm' THEN 'prerequisite_review' WHEN 'complete' THEN 'completed' WHEN 'no_show' THEN 'no_show' ELSE 'participant_change' END)) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 n:=clock_timestamp();
 IF b.workflow_revision<>p_revision OR EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision) OR b.state NOT IN('provisional','confirmed') OR (b.state='provisional' AND b.expires_at<=n) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (p_action='confirm' AND (b.state<>'provisional' OR b.start_at_utc<=n)) OR (p_action IN('complete','no_show') AND (b.state<>'confirmed' OR b.end_at_utc>n)) OR (p_action IN('cancel','reschedule') AND b.start_at_utc<=n+make_interval(mins=>CASE p_action WHEN 'cancel' THEN (p.terms->>'cancelCutoffMinutes')::integer ELSE (p.terms->>'moveCutoffMinutes')::integer END)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_action='reschedule' AND (NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true) OR NOT public.booking_workflow_slot_valid(b.tutor_id,p_start,p_end,n,b.id) OR p_start=b.start_at_utc OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 newstate:=CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled' WHEN 'reschedule' THEN 'replaced' WHEN 'complete' THEN 'completed' ELSE 'no_show' END;
 -- Last post-lock checks use this connection and current clock; a receipt is no grant.
 IF NOT public.booking_workflow_policy_current(p_current_policy) OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action)) OR (family AND NOT public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id)) OR (tutor AND NOT public.workflow_identity(p_actor,p_session,b.source)) THEN RAISE EXCEPTION 'Workflow authority changed' USING ERRCODE='42501';END IF;
 UPDATE public.bookings SET state=newstate,workflow_revision=workflow_revision+1 WHERE id=b.id;
 IF p_action='reschedule' THEN
 INSERT INTO public.bookings(logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES(b.logical_booking_id,b.id,b.revision+1,b.source,b.tutor_id,b.learner_id,b.booked_by_user_id,b.subject_id,p_start,p_end,p_zone,gen_random_uuid(),p_fingerprint,b.state,n,b.expires_at,b.workflow_policy_id,b.admission_policy_id) RETURNING * INTO r;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES(r.logical_booking_id,r.id,p_actor,'workflow_'||r.state,gen_random_uuid(),p_fingerprint,n,r.workflow_policy_id,0,(CASE WHEN b.source='local_operation' THEN 'local_' ELSE 'synthetic_' END)||CASE r.state WHEN 'confirmed' THEN 'prerequisite_review' ELSE 'request' END);
 END IF;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,replacement_booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,r.id,p_actor,CASE p_action WHEN 'reschedule' THEN 'workflow_rescheduled' ELSE 'workflow_'||newstate END,p_request,p_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,p_reason) RETURNING * INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,coalesce(r.id,b.id),p_action,p_current_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'saved'::text,coalesce(r.id,b.id),e.id;
END; $$;
--> statement-breakpoint
-- Extend the existing expire_policy_bookings contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.expire_policy_bookings(p_tutor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;n timestamptz;
BEGIN
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 n:=clock_timestamp();
 FOR b IN SELECT * FROM public.bookings WHERE tutor_id=p_tutor AND source IN ('synthetic_readiness','local_operation') AND state='provisional' AND expires_at<=n FOR NO KEY UPDATE LOOP
 UPDATE public.bookings SET state='expired',workflow_revision=workflow_revision+1 WHERE id=b.id;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES(b.logical_booking_id,b.id,b.booked_by_user_id,'workflow_expired',gen_random_uuid(),b.request_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,CASE WHEN b.source='local_operation' THEN 'local_expiry' ELSE 'synthetic_expiry' END);END LOOP;
END; $$;
--> statement-breakpoint
-- Extend the existing assert_booking_workflow_authority contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.assert_booking_workflow_authority(p_actor text,p_session text,p_booking uuid,p_action text,p_policy uuid,p_original_state text,p_expiry timestamptz,p_start timestamptz,p_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;n timestamptz;family boolean;tutor boolean;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_policy IS NULL OR p_original_state IS NULL OR p_expiry IS NULL OR p_start IS NULL OR p_end IS NULL OR NOT (p_action IN('create','confirm','cancel','reschedule','complete','no_show')) IS TRUE OR public.workflow_identity(p_actor,p_session,(SELECT source FROM public.bookings WHERE id=p_booking)) IS NOT TRUE THEN RAISE EXCEPTION 'Workflow identity or action unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 n:=clock_timestamp();
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.workflow_identity(p_actor,p_session,(SELECT source FROM public.bookings WHERE id=p_booking)) AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false);
 IF b.id IS NULL OR b.workflow_policy_id IS DISTINCT FROM p_policy OR NOT public.booking_workflow_policy_current(p_policy) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
 OR (p_action IN('create','cancel','reschedule') AND NOT(family OR (p_action<>'create' AND tutor)))
 OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action))
 OR (p_action IN('create','confirm','reschedule','complete','no_show') AND NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action IN('create','confirm','reschedule')))
 THEN RAISE EXCEPTION 'Workflow authority changed after writes' USING ERRCODE='42501';END IF;
 IF p_action IN('create','reschedule') AND public.booking_workflow_slot_valid(b.tutor_id,b.start_at_utc,b.end_at_utc,n,b.id) IS NOT TRUE THEN RAISE EXCEPTION 'Workflow slot changed after writes' USING ERRCODE='P4090';END IF;
 IF (p_original_state='provisional' AND p_expiry<=n) OR (p_action='confirm' AND p_start<=n) OR (p_action IN('cancel','reschedule') AND p_start<=n+interval '60 minutes') OR (p_action IN('complete','no_show') AND p_end>n)
 THEN RAISE EXCEPTION 'Workflow window changed after writes' USING ERRCODE='P4090';END IF;
END; $$;
--> statement-breakpoint
-- Extend the existing assert_booking_workflow_receipt contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.assert_booking_workflow_receipt(p_actor text,p_session text,p_booking uuid,p_event uuid,p_action text,p_policy uuid,p_replayed boolean,p_original_state text,p_expiry timestamptz,p_start timestamptz,p_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;e public.booking_lifecycle_events;family boolean;tutor boolean;expected text;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_event IS NULL OR p_policy IS NULL OR p_replayed IS NULL OR NOT (p_action IN('create','confirm','cancel','reschedule','complete','no_show')) IS TRUE OR public.workflow_identity(p_actor,p_session,(SELECT source FROM public.bookings WHERE id=p_booking)) IS NOT TRUE THEN RAISE EXCEPTION 'Receipt identity or action unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE id=p_event;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false);
 IF b.id IS NULL OR b.source NOT IN ('synthetic_readiness','local_operation') OR b.workflow_policy_id IS DISTINCT FROM p_policy OR public.booking_workflow_policy_current(p_policy) IS NOT TRUE OR public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) IS NOT TRUE OR e.id IS NULL OR e.workflow_policy_id IS DISTINCT FROM p_policy OR e.logical_booking_id IS DISTINCT FROM b.logical_booking_id
 OR (p_action IN('create','cancel','reschedule') AND NOT (family OR (p_action<>'create' AND tutor)) IS TRUE)
 OR (p_action IN('confirm','complete','no_show') AND public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) IS NOT TRUE)
 OR (p_action IN('create','confirm','reschedule','complete','no_show') AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action IN('create','confirm','reschedule')) IS NOT TRUE)
 THEN RAISE EXCEPTION 'Receipt current authority unavailable' USING ERRCODE='42501';END IF;
 IF p_replayed THEN RETURN;END IF;
 IF p_original_state IS NULL OR p_expiry IS NULL OR p_start IS NULL OR p_end IS NULL THEN RAISE EXCEPTION 'Receipt transition context unavailable' USING ERRCODE='42501';END IF;
 expected:=CASE p_action WHEN 'create' THEN 'provisional' WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled' WHEN 'complete' THEN 'completed' WHEN 'no_show' THEN 'no_show' ELSE p_original_state END;
 IF b.state IS DISTINCT FROM expected OR (p_action<>'reschedule' AND (e.booking_id IS DISTINCT FROM b.id OR e.workflow_revision IS DISTINCT FROM b.workflow_revision OR e.event IS DISTINCT FROM 'workflow_'||expected)) OR (p_action='reschedule' AND (e.replacement_booking_id IS DISTINCT FROM b.id OR e.event IS DISTINCT FROM 'workflow_rescheduled'))
 THEN RAISE EXCEPTION 'Receipt postcondition unavailable' USING ERRCODE='P4090';END IF;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,b.id,p_action,p_policy,p_original_state,p_expiry,p_start,p_end);
END; $$;
--> statement-breakpoint
-- Extend the existing booking_workflow_participant contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.booking_workflow_participant(p_actor text,p_session text,p_booking uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.workflow_identity(p_actor,p_session,(SELECT source FROM public.bookings WHERE id=p_booking)) AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=p_booking AND b.source IN ('synthetic_readiness','local_operation') AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND (public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id) OR (EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor AND t.review_status='approved') AND public.has_current_tutor_screening(b.tutor_id,b.source)))); $$;
--> statement-breakpoint
-- Extend the existing guard_demo_booking_insert contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.guard_demo_booking_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE prior public.bookings;
BEGIN
 IF NEW.source IN ('synthetic_readiness','local_operation') THEN
 IF NOT EXISTS(SELECT 1 FROM public.booking_workflow_policies policy JOIN public.learner_admission_policies admission ON admission.id=NEW.admission_policy_id AND admission.source=NEW.source JOIN public.learner_profiles learner ON learner.id=NEW.learner_id AND learner.source=NEW.source WHERE policy.id=NEW.workflow_policy_id AND policy.terms->>'source'=NEW.source AND (policy.terms->>'admissionPolicyId')::uuid=admission.id) THEN RAISE EXCEPTION 'Workflow source receipt mismatch' USING ERRCODE='23514';END IF;
 NEW.logical_booking_id:=coalesce(NEW.logical_booking_id,NEW.id);
 IF current_user='learli_app' THEN RAISE EXCEPTION 'Readiness writes require the scoped function' USING ERRCODE='42501'; END IF;
 IF NEW.replaces_booking_id IS NOT NULL THEN
 SELECT * INTO prior FROM public.bookings WHERE id=NEW.replaces_booking_id FOR NO KEY UPDATE;
 IF prior.id IS NULL OR prior.state<>'replaced' OR NEW.logical_booking_id<>prior.logical_booking_id OR NEW.revision<>prior.revision+1 OR NEW.workflow_revision<>0 OR
 (NEW.tutor_id,NEW.learner_id,NEW.subject_id,NEW.booked_by_user_id,NEW.source,NEW.expires_at,NEW.workflow_policy_id,NEW.admission_policy_id) IS DISTINCT FROM (prior.tutor_id,prior.learner_id,prior.subject_id,prior.booked_by_user_id,prior.source,prior.expires_at,prior.workflow_policy_id,prior.admission_policy_id)
 THEN RAISE EXCEPTION 'Readiness replacement unavailable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
 END IF;
 NEW.logical_booking_id := coalesce(NEW.logical_booking_id,NEW.id);
 IF NEW.replaces_booking_id IS NOT NULL THEN
  SELECT * INTO prior FROM public.bookings WHERE id=NEW.replaces_booking_id FOR NO KEY UPDATE;
  IF prior.id IS NULL OR prior.state<>'demo_replaced' OR NEW.logical_booking_id<>prior.logical_booking_id OR NEW.revision<>prior.revision+1 OR
    (NEW.tutor_id,NEW.learner_id,NEW.subject_id,NEW.booked_by_user_id,NEW.source,NEW.expires_at) IS DISTINCT FROM (prior.tutor_id,prior.learner_id,prior.subject_id,prior.booked_by_user_id,prior.source,prior.expires_at) OR NEW.created_at>=NEW.expires_at THEN
   RAISE EXCEPTION 'Synthetic replacement is unavailable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF current_user='learli_app' AND NEW.state<>'demo_reserved' THEN
  RAISE EXCEPTION 'Fixture promotion is owner controlled' USING ERRCODE='23514';
 END IF;
 IF NEW.state='demo_completed' AND NEW.end_at_utc>clock_timestamp() THEN
  RAISE EXCEPTION 'Historical fixture end required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
-- Extend the existing preserve_demo_booking contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.preserve_demo_booking() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF OLD.source IN ('synthetic_readiness','local_operation') THEN
 IF current_user='learli_app' THEN RAISE EXCEPTION 'Readiness writes require the scoped function' USING ERRCODE='42501';END IF;
 IF (to_jsonb(NEW)-'state'-'workflow_revision') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'workflow_revision') OR NEW.workflow_revision<>OLD.workflow_revision+1 OR NOT (
 (OLD.state='provisional' AND NEW.state='expired' AND OLD.expires_at<=clock_timestamp()) OR
 (OLD.state='provisional' AND NEW.state='confirmed' AND OLD.expires_at>clock_timestamp()) OR
 (OLD.state IN('provisional','confirmed') AND NEW.state IN('cancelled','replaced') AND OLD.start_at_utc>clock_timestamp() AND (OLD.state='confirmed' OR OLD.expires_at>clock_timestamp())) OR
 (OLD.state='confirmed' AND NEW.state IN('completed','no_show') AND OLD.end_at_utc<=clock_timestamp()))
 THEN RAISE EXCEPTION 'Readiness transition unavailable' USING ERRCODE='23514';END IF; RETURN NEW; END IF;
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') THEN
  RAISE EXCEPTION 'Synthetic booking fields are immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
  (OLD.state IN('demo_reserved','demo_confirmed') AND NEW.state='demo_expired' AND OLD.expires_at<=clock_timestamp()) OR
  (OLD.state IN('demo_reserved','demo_confirmed') AND NEW.state IN('demo_cancelled','demo_replaced') AND OLD.expires_at>clock_timestamp() AND OLD.start_at_utc>clock_timestamp()) OR
  (current_user<>'learli_app' AND OLD.state='demo_reserved' AND NEW.state='demo_confirmed') OR
  (current_user<>'learli_app' AND OLD.state='demo_confirmed' AND NEW.state='demo_completed' AND OLD.end_at_utc<=clock_timestamp())
 ) THEN RAISE EXCEPTION 'Synthetic booking transition is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
-- Extend the existing require_booking_lifecycle_event contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.require_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.source IN ('synthetic_readiness','local_operation') THEN
 IF NOT EXISTS(SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=NEW.id AND e.workflow_revision=NEW.workflow_revision AND e.workflow_policy_id=NEW.workflow_policy_id AND e.event=CASE NEW.state WHEN 'replaced' THEN 'workflow_rescheduled' ELSE 'workflow_'||NEW.state END)
 THEN RAISE EXCEPTION 'Readiness transition requires history' USING ERRCODE='23514'; END IF;RETURN NULL;END IF;
 IF TG_OP='INSERT' THEN RETURN NULL;END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NEW.state IN('demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND NOT EXISTS (
  SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=NEW.id AND e.event=CASE NEW.state WHEN 'demo_replaced' THEN 'demo_rescheduled' ELSE NEW.state END
 ) THEN RAISE EXCEPTION 'Synthetic transition requires history' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
--> statement-breakpoint
-- Extend the existing guard_booking_lifecycle_event contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.guard_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE b public.bookings; replacement public.bookings;
BEGIN
 IF NEW.workflow_policy_id IS NOT NULL THEN
 IF TG_OP<>'INSERT' OR current_user='learli_app' THEN RAISE EXCEPTION 'Readiness history is scoped and immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;
 IF b.id IS NULL OR b.source NOT IN ('synthetic_readiness','local_operation') OR b.logical_booking_id<>NEW.logical_booking_id OR b.workflow_policy_id<>NEW.workflow_policy_id OR b.workflow_revision<>NEW.workflow_revision OR NEW.event<>(CASE b.state WHEN 'replaced' THEN 'workflow_rescheduled' ELSE 'workflow_'||b.state END)
 THEN RAISE EXCEPTION 'Readiness history provenance unavailable' USING ERRCODE='23514';END IF;
 IF (b.source='local_operation' AND NEW.reason_code NOT LIKE 'local_%') OR (b.source='synthetic_readiness' AND NEW.reason_code NOT LIKE 'synthetic_%') THEN RAISE EXCEPTION 'Workflow reason source mismatch' USING ERRCODE='23514'; END IF;
 IF NEW.event='workflow_rescheduled' THEN SELECT * INTO replacement FROM public.bookings WHERE id=NEW.replacement_booking_id;
 IF replacement.id IS NULL OR replacement.replaces_booking_id<>b.id OR replacement.logical_booking_id<>b.logical_booking_id THEN RAISE EXCEPTION 'Readiness replacement history unavailable' USING ERRCODE='23514';END IF;END IF;
 RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Synthetic history is immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;
 IF b.logical_booking_id<>NEW.logical_booking_id OR
   (NEW.event='demo_cancelled' AND b.state<>'demo_cancelled') OR
   (NEW.event='demo_rescheduled' AND b.state<>'demo_replaced') OR
   (NEW.event='demo_confirmed' AND (current_user='learli_app' OR b.state NOT IN('demo_confirmed','demo_completed'))) OR
   (NEW.event='demo_completed' AND (current_user='learli_app' OR b.state<>'demo_completed' OR b.end_at_utc>clock_timestamp())) THEN
  RAISE EXCEPTION 'Synthetic event provenance unavailable' USING ERRCODE='23514';
 END IF;
 IF NEW.event='demo_rescheduled' THEN
  SELECT * INTO replacement FROM public.bookings WHERE id=NEW.replacement_booking_id;
  IF replacement.id IS NULL OR replacement.replaces_booking_id<>b.id OR replacement.logical_booking_id<>b.logical_booking_id THEN
   RAISE EXCEPTION 'Synthetic replacement event unavailable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
-- Extend the existing stamp_support_creation_transaction contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.stamp_support_creation_transaction() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.creation_transaction:=CASE WHEN NEW.source IN ('synthetic_readiness','local_operation') THEN pg_current_xact_id()::text ELSE NULL END;
 ELSIF NEW.creation_transaction IS DISTINCT FROM OLD.creation_transaction THEN RAISE EXCEPTION 'Support creation identity is immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
-- Extend the existing guard_support_booking_records contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.guard_support_booking_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Support booking records are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME='support_case_bookings' AND EXISTS(SELECT 1 FROM public.support_cases c WHERE c.id=NEW.case_id AND c.source='synthetic_readiness') THEN
    IF current_user='learli_app' OR NOT EXISTS(SELECT 1 FROM public.support_cases c JOIN public.support_case_events e ON e.case_id=c.id JOIN public.support_case_responses r ON r.case_id=c.id JOIN public.bookings b ON b.id=NEW.booking_id
      WHERE c.id=NEW.case_id AND c.source='synthetic_readiness' AND b.source=c.source AND r.provenance=c.source AND c.status='open' AND c.revision=0 AND e.action='created' AND e.revision=0 AND c.creation_transaction=pg_current_xact_id()::text AND c.xmin=e.xmin) THEN
      RAISE EXCEPTION 'Association requires atomic readiness case creation' USING ERRCODE='23514';END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'support_case_bookings' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.support_cases c JOIN public.support_case_events e ON e.case_id=c.id
      JOIN public.bookings b ON b.id=NEW.booking_id
      WHERE c.id=NEW.case_id AND c.source IN ('local_synthetic','local_operation') AND c.revision=0 AND c.status='open'
        AND e.action='created' AND e.revision=0 AND b.source=CASE c.source WHEN 'local_operation' THEN 'local_operation' ELSE 'local_simulation' END
        AND c.xmin = pg_current_xact_id()::text::xid
        AND e.xmin = pg_current_xact_id()::text::xid
    ) THEN
      RAISE EXCEPTION 'Association requires atomic case creation' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.support_case_bookings l WHERE l.case_id=NEW.case_id AND l.booking_id=NEW.booking_id) THEN
    RAISE EXCEPTION 'Audit association mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Extend the existing guard_readiness_source contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.guard_readiness_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
 IF NOT ((NEW.source='local_fixture' AND v_source='local_synthetic') OR (NEW.source='synthetic_readiness' AND v_source='synthetic_readiness') OR (NEW.source='local_operation' AND v_source='local_operation')) THEN RAISE EXCEPTION 'Authority source mismatch.' USING ERRCODE='23514'; END IF;
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
-- Extend the existing change_local_account_access contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.change_local_account_access(
  p_actor text, p_session text, p_target text, p_expected integer,
  p_next text, p_reason text, p_key uuid
) RETURNS TABLE(outcome text, revision integer, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_revision integer; v_source text;
  v_status text;
  v_previous public.account_restriction_events%ROWTYPE;
  v_now timestamptz;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Local account access changes require read committed' USING ERRCODE='25001';END IF;
  SELECT source INTO v_source FROM public.account_restriction_targets WHERE user_id=p_target;
  IF p_expected IS NULL OR p_expected < 0 OR p_expected >= 2147483647 OR p_key IS NULL
     OR NOT ((p_next = 'suspended' AND p_reason IN ('local_access_test','local_review_test','local_restrict'))
          OR (p_next = 'active' AND p_reason IN ('local_restore_test','local_restore'))) IS TRUE THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp()
      AND u.email_verified AND (v_source='local_operation' OR u.email LIKE '%.test') AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  IF (v_source='local_operation' AND p_reason NOT IN ('local_restrict','local_restore')) OR (v_source='local_fixture' AND p_reason IN ('local_restrict','local_restore')) THEN RETURN QUERY SELECT 'invalid'::text,NULL::integer,NULL::text;RETURN;END IF;
  SELECT t.revision INTO v_revision FROM public.account_restriction_targets t
    WHERE t.user_id=p_target AND t.source IN ('local_fixture','local_operation') FOR UPDATE;
  IF NOT FOUND OR p_actor=p_target THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT a.status INTO v_status FROM public.user_access a
    WHERE a.user_id=p_target FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  -- Serialize a replay key even when two requests name different targets.
  PERFORM pg_advisory_xact_lock(hashtextextended('restriction-request:' || p_actor || ':' || p_key::text,0));
  PERFORM 1 FROM public.account_restriction_grants g
    WHERE g.staff_user_id=p_actor AND g.target_user_id=p_target AND g.status='authorized' AND g.source=v_source AND (v_source<>'local_operation' OR (g.valid_until IS NULL AND public.has_local_workflow_staff(p_actor,p_session,'account') AND CASE p_next WHEN 'active' THEN 'restore' ELSE 'restrict' END=ANY(g.permitted_actions))) FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public."user" u WHERE u.id=p_target AND (v_source='local_operation' OR u.email LIKE '%.test'))
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_target AND r.role='admin') THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  v_now := clock_timestamp();
  -- Fresh READ COMMITTED command snapshot after every domain/grant wait.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
      AND u.email_verified AND (v_source='local_operation' OR u.email LIKE '%.test') AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT e.* INTO v_previous FROM public.account_restriction_events e
    WHERE e.actor_user_id=p_actor AND e.request_key=p_key;
  IF FOUND THEN
    IF v_previous.target_user_id<>p_target OR v_previous.expected_revision<>p_expected
      OR v_previous.next_status<>p_next OR v_previous.reason<>p_reason THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::integer, NULL::text;
    ELSE
      RETURN QUERY SELECT 'replayed'::text, v_previous.revision, v_previous.next_status;
    END IF;
    RETURN;
  END IF;
  IF v_revision<>p_expected OR v_status=p_next THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  UPDATE public.user_access SET status=p_next, updated_at=v_now WHERE user_id=p_target;
  UPDATE public.account_restriction_targets SET revision=v_revision+1 WHERE user_id=p_target;
  INSERT INTO public.account_restriction_events(actor_user_id,target_user_id,request_key,expected_revision,revision,previous_status,next_status,reason,created_at)
    VALUES(p_actor,p_target,p_key,p_expected,v_revision+1,v_status,p_next,p_reason,v_now);
  IF v_source='local_operation' AND NOT public.has_local_workflow_staff(p_actor,p_session,'account') THEN RAISE EXCEPTION 'Current staff authority unavailable' USING ERRCODE='42501';END IF;
  RETURN QUERY SELECT 'saved'::text, v_revision+1, p_next;
END;
$$;
--> statement-breakpoint
-- Extend the existing change_local_support_assignment contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.change_local_support_assignment(
  p_actor text,p_session text,p_case uuid,p_expected integer,p_reviewer text,p_kind text,p_key uuid
) RETURNS TABLE(outcome text,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_case public.support_cases%ROWTYPE;
  v_previous text;
  v_receipt public.support_assignment_events%ROWTYPE;
  v_now timestamptz;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Local support assignment changes require read committed' USING ERRCODE='25001';END IF;
  IF p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR p_key IS NULL OR p_case IS NULL
    OR p_reviewer IS NULL OR char_length(p_reviewer) NOT BETWEEN 1 AND 128
    OR NOT (p_kind IN ('assign','reassign','escalate')) IS TRUE THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN;
  END IF;
  -- Case lock is shared with reviewer status and owner assignment tooling.
  SELECT c.* INTO v_case FROM public.support_cases c WHERE c.id=p_case AND c.source IN ('local_synthetic','local_operation') FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('support-assignment-request:' || p_actor || ':' || p_key::text,0));
  v_now:=clock_timestamp();
  -- Separate commands acquire fresh READ COMMITTED snapshots after all domain waits.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now AND u.email_verified
      AND (v_case.source='local_operation' OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') AND a.status='active'
      AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
  IF p_actor=v_case.requester_user_id OR NOT ((v_case.source='local_operation' AND public.has_local_workflow_staff(p_actor,p_session,'support') AND EXISTS(SELECT 1 FROM public.support_case_assignments claimed WHERE claimed.case_id=p_case AND claimed.reviewer_user_id=p_actor)) OR EXISTS (
    SELECT 1 FROM public.support_dispatch_grants g WHERE g.dispatcher_user_id=p_actor AND g.case_id=p_case AND g.source='local_fixture' AND g.status='authorized'
  )) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  IF p_reviewer IN (p_actor,v_case.requester_user_id) OR NOT ((v_case.source='local_operation' AND EXISTS(SELECT 1 FROM public.local_workflow_staff st JOIN public.support_reviewers sr ON sr.user_id=st.user_id JOIN public."user" su ON su.id=st.user_id JOIN public.user_access sa ON sa.user_id=st.user_id WHERE st.user_id=p_reviewer AND st.status='active' AND 'support'=ANY(st.capabilities) AND sr.source='local_operation' AND sr.status='authorized' AND su.email_verified AND sa.status='active' AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=st.user_id AND role='admin'))) OR EXISTS (
    SELECT 1 FROM public.support_reviewer_choices choice JOIN public.support_reviewers r ON r.user_id=choice.reviewer_user_id
    JOIN public."user" u ON u.id=r.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE choice.case_id=p_case AND choice.reviewer_user_id=p_reviewer AND choice.source='local_fixture' AND choice.status='authorized'
      AND r.source='local_fixture' AND r.status='authorized' AND u.email_verified AND a.status='active'
      AND (v_case.source='local_operation' OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')
      AND EXISTS(SELECT 1 FROM public.user_roles g WHERE g.user_id=u.id AND g.role='admin')
  )) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  SELECT e.* INTO v_receipt FROM public.support_assignment_events e WHERE e.actor_user_id=p_actor AND e.request_key=p_key;
  IF FOUND THEN
    IF v_receipt.case_id<>p_case OR v_receipt.expected_revision<>p_expected OR v_receipt.next_reviewer_id<>p_reviewer OR v_receipt.kind<>p_kind THEN
      RETURN QUERY SELECT 'conflict'::text,NULL::integer;
    ELSE RETURN QUERY SELECT 'replayed'::text,v_receipt.revision; END IF;
    RETURN;
  END IF;
  SELECT a.reviewer_user_id INTO v_previous FROM public.support_case_assignments a WHERE a.case_id=p_case;
  IF v_case.revision<>p_expected OR v_case.status='closed' OR v_previous=p_reviewer
    OR NOT ((p_kind='assign' AND v_previous IS NULL) OR (p_kind IN ('reassign','escalate') AND v_previous IS NOT NULL)) IS TRUE THEN
    RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN;
  END IF;
  INSERT INTO public.support_case_assignments(case_id,reviewer_user_id,updated_at) VALUES(p_case,p_reviewer,v_now)
    ON CONFLICT(case_id) DO UPDATE SET reviewer_user_id=p_reviewer,updated_at=v_now;
  UPDATE public.support_cases SET revision=v_case.revision+1,updated_at=v_now WHERE id=p_case;
  INSERT INTO public.support_case_events(case_id,action,previous_reviewer_id,next_reviewer_id,revision,created_at)
    VALUES(p_case,CASE WHEN v_previous IS NULL THEN 'assigned' ELSE 'reassigned' END,v_previous,p_reviewer,v_case.revision+1,v_now);
  INSERT INTO public.support_assignment_events(case_id,actor_user_id,request_key,expected_revision,revision,kind,previous_reviewer_id,next_reviewer_id,created_at)
    VALUES(p_case,p_actor,p_key,p_expected,v_case.revision+1,p_kind,v_previous,p_reviewer,v_now);
  IF v_case.source='local_operation' AND NOT public.has_local_workflow_staff(p_actor,p_session,'support') THEN RAISE EXCEPTION 'Current support staff unavailable' USING ERRCODE='42501';END IF;
  RETURN QUERY SELECT 'saved'::text,v_case.revision+1;
END;
$$;
--> statement-breakpoint
-- Extend the existing preserve_transactional_delivery contract; historical source semantics remain.
CREATE OR REPLACE FUNCTION public.preserve_transactional_delivery() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'delivery history is immutable' USING ERRCODE='23514'; END IF;
 IF ROW(OLD.id,OLD.event_id,OLD.recipient_user_id,OLD.kind,OLD.created_at) IS DISTINCT FROM ROW(NEW.id,NEW.event_id,NEW.recipient_user_id,NEW.kind,NEW.created_at) THEN
  RAISE EXCEPTION 'delivery identity is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.payload IS NOT NULL AND ROW(OLD.payload,OLD.idempotency_key,OLD.payload_fingerprint,OLD.configuration_fingerprint,OLD.first_attempt_at) IS DISTINCT FROM ROW(NEW.payload,NEW.idempotency_key,NEW.payload_fingerprint,NEW.configuration_fingerprint,NEW.first_attempt_at) THEN
  RAISE EXCEPTION 'prepared delivery is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.state IN('provider_accepted','suppressed','blocked') THEN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'closed delivery is immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.state IN('pending','retryable','uncertain') OR (OLD.state='claimed' AND NEW.claim_token IS DISTINCT FROM OLD.claim_token AND NEW.state='claimed') THEN
  IF NEW.state<>'claimed' OR NEW.claim_token IS NULL OR (OLD.state='claimed' AND OLD.claim_until>clock_timestamp()) OR (OLD.state IN('retryable','uncertain') AND OLD.next_attempt_at>clock_timestamp())
    OR NEW.attempts<>OLD.attempts OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at
    OR NEW.claim_until<=clock_timestamp() OR NEW.claim_until>clock_timestamp()+interval '60 seconds' THEN
   RAISE EXCEPTION 'invalid delivery claim' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.state<>'claimed' OR OLD.claim_until<=clock_timestamp() OR (NEW.state='claimed' AND (NEW.claim_token IS DISTINCT FROM OLD.claim_token OR NEW.claim_until IS DISTINCT FROM OLD.claim_until)) THEN
  RAISE EXCEPTION 'stale delivery claim' USING ERRCODE='23514';
 END IF;
 IF NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 OR (NEW.state<>'claimed' AND NEW.attempts<>OLD.attempts)
  OR NEW.state='pending' THEN RAISE EXCEPTION 'invalid delivery transition' USING ERRCODE='23514'; END IF;
 IF NEW.payload IS NOT NULL THEN
  IF (jsonb_typeof(NEW.payload)<>'object'
    OR NEW.payload - ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath'] <> '{}'::jsonb
    OR NOT NEW.payload ?& ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath']
    OR EXISTS(SELECT 1 FROM jsonb_each(NEW.payload) item WHERE (item.key='firstAttemptAt' AND jsonb_typeof(item.value)<>'number') OR (item.key<>'firstAttemptAt' AND jsonb_typeof(item.value)<>'string'))
    OR NEW.payload->>'eventId' <> NEW.event_id::text
    OR NOT EXISTS(SELECT 1 FROM public.booking_lifecycle_events source_event JOIN public.bookings source_booking ON source_booking.id=source_event.booking_id WHERE source_event.id=NEW.event_id AND source_booking.source IN ('synthetic_readiness','local_operation') AND source_booking.source=NEW.payload->>'source')
    OR NEW.payload->>'kind' <> substring(NEW.kind from 10)
    OR (NEW.payload->>'firstAttemptAt')::numeric <> floor(extract(epoch from NEW.first_attempt_at)*1000)
    OR length(NEW.payload->>'subject') NOT BETWEEN 1 AND 60
    OR length(NEW.payload->>'recipientEmail') NOT BETWEEN 3 AND 254
    OR NEW.payload->>'detailPath' !~ '^/bookings/[a-f0-9-]{36}[?]scope=(student|guardian|tutor)$') IS DISTINCT FROM FALSE THEN
   RAISE EXCEPTION 'invalid delivery material' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;

--> statement-breakpoint
CREATE FUNCTION public.claim_local_workflow_task(p_actor text,p_session text,p_kind text,p_target text,p_request uuid)
RETURNS TABLE(outcome text,target_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior public.local_workflow_claims; a public.learner_admissions; c public.tutor_screening_cases; b public.bookings; s public.support_cases; target_user text; target_source text;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Local claims require read committed' USING ERRCODE='25001';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_request IS NULL OR p_target IS NULL OR char_length(p_target) NOT BETWEEN 1 AND 128 OR p_kind NOT IN('admission','screening','booking','support','account') OR p_kind IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::text;RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('local-claim-request:'||p_actor||':'||p_request::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('local-claim-target:'||p_kind||':'||p_target,0));
 PERFORM 1 FROM public.local_workflow_staff WHERE user_id=p_actor FOR SHARE;
 IF NOT public.has_local_workflow_staff(p_actor,p_session,p_kind) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text;RETURN;END IF;
 SELECT * INTO prior FROM public.local_workflow_claims WHERE actor_user_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF prior.kind=p_kind AND prior.target_id=p_target THEN RETURN QUERY SELECT 'replayed'::text,p_target;ELSE RETURN QUERY SELECT 'conflict'::text,NULL::text;END IF;RETURN;
 END IF;
 IF p_kind='admission' THEN
  SELECT * INTO a FROM public.learner_admissions WHERE id=p_target::uuid AND source='local_operation' FOR NO KEY UPDATE;
  IF NOT FOUND OR a.requester_user_id=p_actor OR a.state<>'pending' OR NOT public.admission_policy_current(a.policy_id) THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;RETURN;END IF;
  IF EXISTS(SELECT 1 FROM public.learner_admission_assignments WHERE admission_id=a.id) THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.learner_admission_reviewers WHERE user_id=p_actor AND source='local_operation' AND capability_code='learner_admission_review' AND active) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text;RETURN;END IF;
  INSERT INTO public.learner_admission_assignments(admission_id,reviewer_user_id,source,capability_code) VALUES(a.id,p_actor,'local_operation','learner_admission_review');
 ELSIF p_kind='screening' THEN
  PERFORM 1 FROM public.tutor_profiles WHERE id=p_target::uuid FOR UPDATE;
  SELECT * INTO c FROM public.tutor_screening_cases WHERE tutor_id=p_target::uuid AND provenance='local_operation' FOR UPDATE;
  SELECT user_id INTO target_user FROM public.tutor_profiles WHERE id=p_target::uuid;
  IF c.tutor_id IS NULL OR target_user=p_actor OR c.state<>'pending' OR NOT EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies pol ON pol.provenance=h.provenance AND pol.version=h.version WHERE h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled' AND pol.valid_from<=clock_timestamp() AND (pol.valid_until IS NULL OR pol.valid_until>clock_timestamp())) THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;RETURN;END IF;
  IF EXISTS(SELECT 1 FROM public.tutor_screening_assignments WHERE tutor_id=c.tutor_id) THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tutor_screening_staff WHERE user_id=p_actor AND provenance='local_operation' AND status='authorized' AND valid_until IS NULL) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text;RETURN;END IF;
  INSERT INTO public.tutor_screening_assignments(tutor_id,reviewer_user_id,provenance,status) VALUES(c.tutor_id,p_actor,'local_operation','authorized');
  INSERT INTO public.tutor_screening_events(tutor_id,kind,actor_user_id,request_key,assignment_revision) VALUES(c.tutor_id,'assignment',p_actor,p_request,0);
 ELSIF p_kind='booking' THEN
  PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings booked ON booked.tutor_id=t.id WHERE booked.id=p_target::uuid FOR UPDATE OF t;
  SELECT * INTO b FROM public.bookings WHERE id=p_target::uuid AND source='local_operation' FOR NO KEY UPDATE;
  SELECT user_id INTO target_user FROM public.tutor_profiles WHERE id=b.tutor_id;
  IF b.id IS NULL OR b.booked_by_user_id=p_actor OR target_user=p_actor OR b.state<>'provisional' OR b.expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM public.learner_profiles WHERE id=b.learner_id AND user_id=p_actor) OR NOT public.booking_workflow_policy_current(b.workflow_policy_id) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true) THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;RETURN;END IF;
  IF EXISTS(SELECT 1 FROM public.booking_workflow_grants WHERE logical_booking_id=b.logical_booking_id AND action='confirm') THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  INSERT INTO public.booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES(b.logical_booking_id,p_actor,'confirm',true,NULL,'local:'||p_request::text);
 ELSIF p_kind='support' THEN
  SELECT * INTO s FROM public.support_cases WHERE id=p_target::uuid AND source='local_operation' FOR UPDATE;
  IF NOT FOUND OR s.requester_user_id=p_actor OR s.status='closed' THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;RETURN;END IF;
  IF EXISTS(SELECT 1 FROM public.support_case_assignments WHERE case_id=s.id) THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.support_reviewers WHERE user_id=p_actor AND source='local_operation' AND status='authorized') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::text;RETURN;END IF;
  INSERT INTO public.support_case_assignments(case_id,reviewer_user_id) VALUES(s.id,p_actor);
  UPDATE public.support_cases SET revision=revision+1,updated_at=clock_timestamp() WHERE id=s.id;
  INSERT INTO public.support_case_events(case_id,action,next_reviewer_id,revision) VALUES(s.id,'assigned',p_actor,s.revision+1);
 ELSIF p_kind='account' THEN
  PERFORM 1 FROM public."user" WHERE id=p_target FOR NO KEY UPDATE;
  IF NOT FOUND OR p_target=p_actor OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target AND role='admin') THEN RETURN QUERY SELECT 'not_found'::text,NULL::text;RETURN;END IF;
  SELECT source INTO target_source FROM public.account_restriction_targets WHERE user_id=p_target FOR UPDATE;
  IF FOUND AND target_source<>'local_operation' THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  IF EXISTS(SELECT 1 FROM public.account_restriction_grants WHERE staff_user_id=p_actor AND target_user_id=p_target) THEN RETURN QUERY SELECT 'conflict'::text,NULL::text;RETURN;END IF;
  INSERT INTO public.account_restriction_targets(user_id,source) VALUES(p_target,'local_operation') ON CONFLICT DO NOTHING;
  INSERT INTO public.account_restriction_grants(staff_user_id,target_user_id,source,status,permitted_actions) VALUES(p_actor,p_target,'local_operation','authorized',ARRAY['restrict','restore']);
 END IF;
 INSERT INTO public.local_workflow_claims(actor_user_id,request_id,kind,target_id) VALUES(p_actor,p_request,p_kind,p_target);
 -- All assignment/event/receipt FK waits have completed. Each following command
 -- observes current READ COMMITTED policy, capability, identity and task scope.
 IF NOT public.has_local_workflow_staff(p_actor,p_session,p_kind) THEN RAISE EXCEPTION 'Current local staff unavailable' USING ERRCODE='42501';END IF;
 IF p_kind='admission' AND (NOT public.admission_reviewer_allowed(p_actor,p_session,a.id) OR NOT public.admission_policy_current(a.policy_id)) THEN RAISE EXCEPTION 'Current admission assignment unavailable' USING ERRCODE='42501';END IF;
 IF p_kind='screening' AND (NOT public.has_tutor_screening_authority(p_actor,p_session,c.tutor_id,'local_operation') OR NOT EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies pol ON pol.provenance=h.provenance AND pol.version=h.version WHERE h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled' AND pol.valid_from<=clock_timestamp() AND (pol.valid_until IS NULL OR pol.valid_until>clock_timestamp()))) THEN RAISE EXCEPTION 'Current screening assignment unavailable' USING ERRCODE='42501';END IF;
 IF p_kind='booking' AND (b.expires_at<=clock_timestamp() OR NOT public.has_booking_workflow_task(p_actor,p_session,b.id,'confirm') OR NOT public.booking_workflow_policy_current(b.workflow_policy_id) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true)) THEN RAISE EXCEPTION 'Current booking assignment unavailable' USING ERRCODE='42501';END IF;
 IF p_kind='support' AND NOT EXISTS(SELECT 1 FROM public.support_case_assignments assignment JOIN public.support_reviewers reviewer ON reviewer.user_id=assignment.reviewer_user_id JOIN public.support_cases report ON report.id=assignment.case_id WHERE assignment.case_id=s.id AND assignment.reviewer_user_id=p_actor AND reviewer.source='local_operation' AND reviewer.status='authorized' AND reviewer.valid_until IS NULL AND report.source='local_operation' AND report.requester_user_id<>p_actor AND report.status<>'closed') THEN RAISE EXCEPTION 'Current support assignment unavailable' USING ERRCODE='42501';END IF;
 IF p_kind='account' AND (NOT EXISTS(SELECT 1 FROM public.account_restriction_grants g JOIN public.account_restriction_targets target ON target.user_id=g.target_user_id WHERE g.staff_user_id=p_actor AND g.target_user_id=p_target AND g.source='local_operation' AND target.source=g.source AND g.status='authorized' AND g.valid_until IS NULL AND g.permitted_actions=ARRAY['restrict','restore']) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target AND role='admin')) THEN RAISE EXCEPTION 'Current account assignment unavailable' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'saved'::text,p_target;
EXCEPTION WHEN invalid_text_representation THEN RETURN QUERY SELECT 'invalid'::text,NULL::text;
END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_local_workflow_claim BEFORE UPDATE OR DELETE ON public.local_workflow_claims FOR EACH ROW EXECUTE FUNCTION public.preserve_booking_workflow_policy();

--> statement-breakpoint
REVOKE ALL ON FUNCTION public.local_workflow_identity(text,text),public.workflow_identity(text,text,text),public.has_local_workflow_staff(text,text,text),public.claim_local_workflow_task(text,text,text,text,uuid) FROM PUBLIC;
