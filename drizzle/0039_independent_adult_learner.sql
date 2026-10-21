CREATE TABLE "learner_independent_attestations" (
	"admission_id" uuid PRIMARY KEY NOT NULL,
	"learner_id" uuid NOT NULL,
	"requester_user_id" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"policy_digest" text NOT NULL,
	"notice_version" text NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"eligibility_declared" boolean NOT NULL,
	"verification_status" text NOT NULL,
	"source" text DEFAULT 'local_operation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_independent_attestations_learner_id_unique" UNIQUE("learner_id"),
	CONSTRAINT "learner_independent_attestations_requester_user_id_unique" UNIQUE("requester_user_id"),
	CONSTRAINT "learner_independent_attestations_request" UNIQUE("requester_user_id","request_id"),
	CONSTRAINT "learner_independent_attestations_shape" CHECK ("learner_independent_attestations"."source"='local_operation' AND "learner_independent_attestations"."policy_id"='8a3658c1-773a-4533-81c6-49ff79870216'::uuid AND "learner_independent_attestations"."policy_version"='local-independent-admission-v2' AND "learner_independent_attestations"."notice_version"='local-independent-notice-v2' AND "learner_independent_attestations"."policy_digest" ~ '^[a-f0-9]{64}$' AND "learner_independent_attestations"."request_fingerprint" ~ '^[a-f0-9]{64}$' AND "learner_independent_attestations"."eligibility_declared" IS TRUE AND "learner_independent_attestations"."verification_status"='self_attested_unverified')
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "booking_lifecycle_events" DROP CONSTRAINT "booking_lifecycle_events_event_check";--> statement-breakpoint
ALTER TABLE "learner_admission_events" DROP CONSTRAINT "learner_admission_events_shape";--> statement-breakpoint
ALTER TABLE "learner_admission_policies" DROP CONSTRAINT "learner_admission_policy_synthetic";--> statement-breakpoint
ALTER TABLE "booking_workflow_policies" DROP CONSTRAINT "booking_workflow_policy_shape";--> statement-breakpoint
ALTER TABLE "learner_independent_attestations" ADD CONSTRAINT "learner_independent_attestations_admission_id_learner_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."learner_admissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_independent_attestations" ADD CONSTRAINT "learner_independent_attestations_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_independent_attestations" ADD CONSTRAINT "learner_independent_attestations_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_independent_attestations" ADD CONSTRAINT "learner_independent_attestations_policy_id_learner_admission_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."learner_admission_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'parent_role.self_granted', 'student_role.self_granted', 'local_workflow.staff_authorized', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated', 'subject.renamed'));--> statement-breakpoint
ALTER TABLE "booking_lifecycle_events" ADD CONSTRAINT "booking_lifecycle_events_event_check" CHECK (("booking_lifecycle_events"."workflow_policy_id" IS NULL AND "booking_lifecycle_events"."event" IN ('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed') AND "booking_lifecycle_events"."workflow_revision" IS NULL AND "booking_lifecycle_events"."reason_code" IS NULL) OR ("booking_lifecycle_events"."workflow_policy_id" IS NOT NULL AND "booking_lifecycle_events"."event" IN ('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled') AND "booking_lifecycle_events"."workflow_revision">=0 AND "booking_lifecycle_events"."reason_code" IN ('synthetic_request','synthetic_prerequisite_review','synthetic_completed','synthetic_no_show','synthetic_participant_change','synthetic_expiry','local_parent_booking','local_independent_booking','local_request','local_prerequisite_review','local_completed','local_no_show','local_participant_change','local_expiry')));--> statement-breakpoint
ALTER TABLE "learner_admission_events" ADD CONSTRAINT "learner_admission_events_shape" CHECK ("learner_admission_events"."revision">=0 AND "learner_admission_events"."fingerprint" ~ '^[a-f0-9]{64}$' AND ("learner_admission_events"."event" IN ('guardian_profile_created','independent_profile_created','requested','evidence_recorded','evidence_revoked','authorized','rejected','revoked','assigned')) AND ("learner_admission_events"."to_state" IN ('pending','authorized','rejected','revoked')) AND (("learner_admission_events"."event"='requested' AND "learner_admission_events"."from_state" IS NULL AND "learner_admission_events"."to_state"='pending' AND "learner_admission_events"."revision"=0) OR ("learner_admission_events"."event" IN ('guardian_profile_created','independent_profile_created') AND "learner_admission_events"."from_state" IS NULL AND "learner_admission_events"."to_state"='authorized' AND "learner_admission_events"."revision"=0) OR ("learner_admission_events"."event" NOT IN ('requested','guardian_profile_created','independent_profile_created') AND "learner_admission_events"."from_state" IS NOT NULL AND "learner_admission_events"."revision">0)));--> statement-breakpoint
ALTER TABLE "learner_admission_policies" ADD CONSTRAINT "learner_admission_policy_synthetic" CHECK ((("learner_admission_policies"."source"='synthetic_readiness' AND "learner_admission_policies"."authority"='synthetic_test' AND "learner_admission_policies"."version"='synthetic-admission-v1' AND "learner_admission_policies"."reference"='synthetic:admission:v1' AND "learner_admission_policies"."market_code"='synthetic_test' AND "learner_admission_policies"."notice_version"='synthetic-notice-v1' AND "learner_admission_policies"."guardian_proof_method"='synthetic_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='synthetic_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$') OR ("learner_admission_policies"."source"='local_operation' AND "learner_admission_policies"."authority"='local_operation' AND "learner_admission_policies"."version"='local-admission-v1' AND "learner_admission_policies"."reference"='local:admission:v1' AND "learner_admission_policies"."market_code"='local_operation' AND "learner_admission_policies"."notice_version"='local-notice-v1' AND "learner_admission_policies"."guardian_proof_method"='local_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='local_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$') OR ("learner_admission_policies"."id"='8a3658c1-773a-4533-81c6-49ff79870214'::uuid AND "learner_admission_policies"."source"='local_operation' AND "learner_admission_policies"."authority"='local_operation' AND "learner_admission_policies"."version"='local-guardian-admission-v2' AND "learner_admission_policies"."reference"='local:guardian-admission:v2' AND "learner_admission_policies"."market_code"='local_guardian_creation' AND "learner_admission_policies"."notice_version"='local-guardian-notice-v2' AND "learner_admission_policies"."guardian_proof_method"='parent_guardian_attestation' AND "learner_admission_policies"."independent_eligibility_rule"='local_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$') OR ("learner_admission_policies"."id"='8a3658c1-773a-4533-81c6-49ff79870216'::uuid AND "learner_admission_policies"."source"='local_operation' AND "learner_admission_policies"."authority"='local_operation' AND "learner_admission_policies"."version"='local-independent-admission-v2' AND "learner_admission_policies"."reference"='local:independent-admission:v2' AND "learner_admission_policies"."market_code"='local_independent_creation' AND "learner_admission_policies"."notice_version"='local-independent-notice-v2' AND "learner_admission_policies"."guardian_proof_method"='local_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='adult_independent_self_attestation' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$')));--> statement-breakpoint
ALTER TABLE "booking_workflow_policies" ADD CONSTRAINT "booking_workflow_policy_shape" CHECK ((("booking_workflow_policies"."version"='synthetic-booking-v1' AND "booking_workflow_policies"."reference"='synthetic:booking:v1') OR ("booking_workflow_policies"."version"='synthetic-booking-v2' AND "booking_workflow_policies"."reference"='synthetic:booking:v2') OR ("booking_workflow_policies"."version"='local-parent-booking-v2' AND "booking_workflow_policies"."reference"='local:parent-booking:v2') OR ("booking_workflow_policies"."version"='local-independent-booking-v2' AND "booking_workflow_policies"."reference"='local:independent-booking:v2') OR ("booking_workflow_policies"."version"='local-booking-v1' AND "booking_workflow_policies"."reference"='local:booking:v1')) AND "booking_workflow_policies"."content_digest" ~ '^[a-f0-9]{64}$');
--> statement-breakpoint
-- Independent-v2 is additive. Historical admission heads, receipts and evidence remain byte-for-byte unchanged.
CREATE FUNCTION public.local_independent_policy_current(p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_policy='8a3658c1-773a-4533-81c6-49ff79870216'::uuid
 AND public.admission_policy_current(p_policy)
 AND EXISTS(
  SELECT 1 FROM public.learner_admission_policies p
  WHERE p.id=p_policy AND p.source='local_operation' AND p.authority='local_operation'
   AND p.version='local-independent-admission-v2' AND p.reference='local:independent-admission:v2'
   AND p.market_code='local_independent_creation' AND p.notice_version='local-independent-notice-v2'
   AND p.guardian_proof_method='local_guardian_review'
   AND p.independent_eligibility_rule='adult_independent_self_attestation'
   AND p.reviewer_capability_code='learner_admission_review'
   AND p.revocation_effect='deny_current_learner_access'
   AND p.content_digest='d9cfd45e44e02811e7a9c58cb64d3f8bbb704069d9f9ef75175a0814d6398657'
 );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.admission_evidence_complete(p_admission uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT CASE
 WHEN EXISTS(SELECT 1 FROM public.learner_admissions a WHERE a.id=p_admission AND a.policy_id='8a3658c1-773a-4533-81c6-49ff79870214'::uuid) THEN
  EXISTS(
   SELECT 1 FROM public.learner_admissions a
   JOIN public.learner_guardian_attestations t ON t.admission_id=a.id
   JOIN public.learner_admission_policies p ON p.id=a.policy_id
   WHERE a.id=p_admission AND a.source='local_operation' AND a.management='guardian'
    AND t.learner_id=a.learner_id AND t.requester_user_id=a.requester_user_id
    AND t.policy_id=a.policy_id AND t.policy_version=a.policy_version
    AND t.policy_digest=a.policy_digest AND t.notice_version=p.notice_version
    AND t.request_id=a.request_id AND t.request_fingerprint=a.request_fingerprint
    AND t.created_at=a.created_at AND t.guardian_confirmed IS TRUE
    AND t.consent_confirmed IS TRUE AND t.source=a.source
  )
 WHEN EXISTS(SELECT 1 FROM public.learner_admissions a WHERE a.id=p_admission AND a.policy_id='8a3658c1-773a-4533-81c6-49ff79870216'::uuid) THEN
  EXISTS(
   SELECT 1 FROM public.learner_admissions a
   JOIN public.learner_independent_attestations t ON t.admission_id=a.id
   JOIN public.learner_admission_policies p ON p.id=a.policy_id
   WHERE a.id=p_admission AND a.source='local_operation' AND a.management='self'
    AND t.learner_id=a.learner_id AND t.requester_user_id=a.requester_user_id
    AND t.policy_id=a.policy_id AND t.policy_version=a.policy_version
    AND t.policy_digest=a.policy_digest AND t.notice_version=p.notice_version
    AND t.request_id=a.request_id AND t.request_fingerprint=a.request_fingerprint
    AND t.created_at=a.created_at AND t.eligibility_declared IS TRUE
    AND t.verification_status='self_attested_unverified' AND t.source=a.source
  )
 ELSE EXISTS(
  SELECT 1 FROM public.learner_admissions a
  JOIN public.learner_admission_policies p ON p.id=a.policy_id
  WHERE a.id=p_admission AND NOT EXISTS(
   SELECT 1 FROM
    (VALUES ('guardian','guardian_authority'),('guardian','guardian_notice'),('self','independent_eligibility')) needed(management,code)
   WHERE needed.management=a.management AND NOT EXISTS(
    SELECT 1 FROM public.learner_admission_evidence e
    WHERE e.admission_id=a.id AND e.policy_id=a.policy_id AND e.source=a.source
     AND e.subject_user_id=a.requester_user_id AND e.recorded_by_user_id<>a.requester_user_id
     AND e.check_code=needed.code AND e.revoked_at IS NULL
     AND e.method=CASE WHEN a.management='guardian' THEN p.guardian_proof_method ELSE p.independent_eligibility_rule END
     AND (CASE WHEN e.check_code='guardian_notice' THEN e.notice_version=p.notice_version ELSE e.notice_version IS NULL END) IS TRUE
   )
  )
 )
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.create_independent_learner(
 p_actor text,p_session text,p_request uuid,p_policy uuid,p_notice text,
 p_name text,p_zone text,p_selection text,p_eligibility boolean
) RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE pol public.learner_admission_policies;prior public.learner_admissions;
 fingerprint text;aid uuid;lid uuid;n timestamptz;role_created boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
  RAISE EXCEPTION 'Independent learner creation requires read committed' USING ERRCODE='25001';
 END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_request IS NULL OR p_policy IS NULL THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('independent-learner:'||p_actor,0));
 PERFORM 1 FROM public."user" WHERE id=p_actor FOR NO KEY UPDATE;
 PERFORM 1 FROM public.user_access WHERE user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.session WHERE id=p_session AND user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.learner_admission_policy_state
  WHERE source='local_operation' AND market_code='local_independent_creation' FOR SHARE;
 IF NOT public.local_workflow_identity(p_actor,p_session) THEN
  RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF public.local_independent_policy_current(p_policy) IS NOT TRUE THEN
  RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 SELECT * INTO pol FROM public.learner_admission_policies WHERE id=p_policy;
 IF p_notice IS DISTINCT FROM pol.notice_version OR p_eligibility IS NOT TRUE
  OR p_name IS NULL OR p_name<>btrim(p_name) OR char_length(p_name) NOT BETWEEN 1 AND 80
  OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
  OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone)
  OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$')
  OR public.valid_admission_selection(p_selection) IS NOT TRUE THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(
  p_policy,pol.version,pol.content_digest,p_notice,p_name,'college_support',p_zone,p_selection,p_eligibility
 )::text,'UTF8')),'hex');
 SELECT * INTO prior FROM public.learner_admissions
  WHERE requester_user_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF prior.request_fingerprint<>fingerprint OR prior.policy_id<>p_policy
   OR prior.management<>'self' OR prior.source<>'local_operation' THEN
   RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;
  ELSIF public.has_current_learner_authority(p_actor,p_session,prior.learner_id,p_policy) THEN
   RETURN QUERY SELECT 'replayed'::text,prior.id,prior.learner_id;
  ELSE
   RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;
  END IF;
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.learner_profiles l WHERE l.user_id=p_actor)
  OR EXISTS(SELECT 1 FROM public.learner_admissions a WHERE a.requester_user_id=p_actor AND a.management='self')
  OR EXISTS(SELECT 1 FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request) THEN
  RETURN QUERY SELECT 'exists'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 aid:=gen_random_uuid();lid:=gen_random_uuid();n:=clock_timestamp();
 INSERT INTO public.learner_profiles(
  id,fixture_key,source,management,user_id,display_name,level,grade,timezone,status,created_at,updated_at
 ) VALUES(
  lid,'local-independent:'||aid::text,'local_operation','self',p_actor,p_name,'college_support',NULL,p_zone,'active',n,n
 );
 INSERT INTO public.learner_admissions(
  id,requester_user_id,learner_id,management,source,policy_id,policy_version,policy_reference,
  policy_digest,request_id,request_fingerprint,state,selection_path,created_at,updated_at
 ) VALUES(
  aid,p_actor,lid,'self','local_operation',p_policy,pol.version,pol.reference,pol.content_digest,
  p_request,fingerprint,'authorized',p_selection,n,n
 );
 INSERT INTO public.learner_independent_attestations(
  admission_id,learner_id,requester_user_id,policy_id,policy_version,policy_digest,notice_version,
  request_id,request_fingerprint,eligibility_declared,verification_status,created_at
 ) VALUES(
  aid,lid,p_actor,p_policy,pol.version,pol.content_digest,p_notice,p_request,fingerprint,
  true,'self_attested_unverified',n
 );
 INSERT INTO public.learner_admission_events(
  admission_id,actor_user_id,request_id,fingerprint,event,to_state,revision,
  policy_id,policy_version,policy_reference,policy_digest,created_at
 ) VALUES(
  aid,p_actor,p_request,fingerprint,'independent_profile_created','authorized',0,
  p_policy,pol.version,pol.reference,pol.content_digest,n
 );
 INSERT INTO public.user_roles(user_id,role) VALUES(p_actor,'student') ON CONFLICT DO NOTHING;
 role_created:=FOUND;
 IF role_created THEN
  INSERT INTO public.audit_events(actor_user_id,target_user_id,action)
  VALUES(p_actor,p_actor,'student_role.self_granted');
 END IF;
 IF NOT public.local_independent_policy_current(p_policy)
  OR NOT public.has_current_learner_authority(p_actor,p_session,lid,p_policy) THEN
  RAISE EXCEPTION 'Current independent learner authority unavailable' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT 'created'::text,aid,lid;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_learner_admission_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Admission records are retained.' USING ERRCODE='55000';END IF;
 IF TG_TABLE_NAME IN('learner_admission_events','learner_admission_policies','learner_guardian_attestations','learner_independent_attestations') THEN
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
 IF NOT EXISTS(SELECT 1 FROM public.learner_admission_policies p WHERE p.id=v_a.policy_id AND p.source=v_a.source)
  OR v_l.source<>v_a.source OR v_l.management<>v_a.management
  OR (v_l.management='self' AND (v_l.user_id IS DISTINCT FROM v_a.requester_user_id OR v_l.level<>'college_support'))
  OR v_l.status<>(CASE WHEN v_a.state='authorized' THEN 'active' ELSE 'inactive' END)
  OR NOT EXISTS(
   SELECT 1 FROM public.learner_admission_events e
   WHERE e.admission_id=v_a.id AND e.revision=v_a.revision AND e.to_state=v_a.state
    AND e.policy_id=v_a.policy_id AND e.policy_version=v_a.policy_version
    AND e.policy_reference=v_a.policy_reference AND e.policy_digest=v_a.policy_digest
  )
  OR(v_a.state='authorized' AND NOT public.admission_evidence_complete(v_a.id))
  OR EXISTS(
   SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=v_l.id
    AND (v_l.management<>'guardian' OR g.guardian_user_id<>v_a.requester_user_id OR g.source<>v_a.source
     OR v_a.state IN('pending','rejected') OR g.status<>(CASE WHEN v_a.state='authorized' THEN 'authorized' ELSE 'revoked' END))
  )
  OR(v_a.management='guardian' AND v_a.state IN('authorized','revoked') AND NOT EXISTS(
   SELECT 1 FROM public.guardian_learner_links g
   WHERE g.learner_id=v_l.id AND g.guardian_user_id=v_a.requester_user_id AND g.source=v_a.source
  ))
 THEN RAISE EXCEPTION 'Admission relationship is inconsistent.' USING ERRCODE='23514';END IF;
 IF v_a.policy_id='8a3658c1-773a-4533-81c6-49ff79870214'::uuid AND (
  v_a.source<>'local_operation' OR v_a.management<>'guardian' OR NOT EXISTS(
   SELECT 1 FROM public.learner_admission_events e
   WHERE e.admission_id=v_a.id AND e.revision=0 AND e.event='guardian_profile_created'
    AND e.to_state='authorized' AND e.actor_user_id=v_a.requester_user_id
    AND e.request_id=v_a.request_id AND e.fingerprint=v_a.request_fingerprint
  )
 ) THEN RAISE EXCEPTION 'Guardian creation origin is inconsistent' USING ERRCODE='23514';END IF;
 IF v_a.policy_id='8a3658c1-773a-4533-81c6-49ff79870216'::uuid AND (
  v_a.source<>'local_operation' OR v_a.management<>'self'
  OR v_l.user_id IS DISTINCT FROM v_a.requester_user_id OR v_l.level<>'college_support'
  OR NOT EXISTS(
   SELECT 1 FROM public.learner_admission_events e
   WHERE e.admission_id=v_a.id AND e.revision=0 AND e.event='independent_profile_created'
    AND e.to_state='authorized' AND e.actor_user_id=v_a.requester_user_id
    AND e.request_id=v_a.request_id AND e.fingerprint=v_a.request_fingerprint
  )
 ) THEN RAISE EXCEPTION 'Independent creation origin is inconsistent' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='learner_guardian_attestations' AND NOT public.admission_evidence_complete(v_a.id) THEN
  RAISE EXCEPTION 'Guardian attestation is inconsistent' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='learner_independent_attestations' AND NOT public.admission_evidence_complete(v_a.id) THEN
  RAISE EXCEPTION 'Independent attestation is inconsistent' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='learner_admission_evidence' THEN
  IF NEW.policy_id<>v_a.policy_id OR NEW.source<>v_a.source OR NEW.subject_user_id<>v_a.requester_user_id
   OR NOT EXISTS(
    SELECT 1 FROM public.learner_admission_policies p WHERE p.id=NEW.policy_id
     AND NEW.method=CASE WHEN v_a.management='guardian' THEN p.guardian_proof_method ELSE p.independent_eligibility_rule END
     AND ((v_a.management='guardian' AND NEW.check_code IN('guardian_authority','guardian_notice')) OR(v_a.management='self' AND NEW.check_code='independent_eligibility'))
     AND(CASE WHEN NEW.check_code='guardian_notice' THEN NEW.notice_version=p.notice_version ELSE NEW.notice_version IS NULL END) IS TRUE
   )
   OR NOT EXISTS(
    SELECT 1 FROM public.learner_admission_events e
    WHERE e.admission_id=v_a.id AND e.evidence_id=NEW.id AND e.event='evidence_recorded'
     AND e.actor_user_id=NEW.recorded_by_user_id AND e.request_id=NEW.request_id AND e.fingerprint=NEW.fingerprint
   )
  THEN RAISE EXCEPTION 'Admission evidence is inconsistent.' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER learner_independent_attestations_immutable BEFORE UPDATE OR DELETE ON public.learner_independent_attestations
FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER learner_independent_attestations_integrity AFTER INSERT OR UPDATE ON public.learner_independent_attestations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_learner_admission_integrity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.booking_workflow_policy_current(p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT (
  EXISTS(
   SELECT 1 FROM public.booking_workflow_policies p
   WHERE p.id=p_policy AND p.id='8a3658c1-773a-4533-81c6-49ff79870215'::uuid
    AND p.version='local-parent-booking-v2' AND p.reference='local:parent-booking:v2'
    AND p.content_digest='78a74875f2039d75ac7cac6894c973e70bca9fbe0d09ca2ce669bdd61184ed8b'
    AND p.terms=jsonb_build_object(
     'authority','local_operation','source','local_operation','policyId',p.id::text,
     'contentDigest',p.content_digest,'version',p.version,'reference',p.reference,
     'admissionPolicyId','8a3658c1-773a-4533-81c6-49ff79870214',
     'acceptedGuardianPolicyIds',jsonb_build_array('8a3658c1-773a-4533-81c6-49ff79870211','8a3658c1-773a-4533-81c6-49ff79870214'),
     'durationMinutes',60,'stepMinutes',30,'noticeMinutes',60,'horizonDays',14,
     'provisionalMinutes',10,'cancelCutoffMinutes',60,'moveCutoffMinutes',60,
     'confirmationPrerequisite','local_parent_booking','confirmationActor','authorized_parent',
     'outcomeActor','assigned_mfa_admin','completionActor','assigned_tutor',
     'disputePath','/support','meetingAccess','confirmed_until_end'
    )
    AND public.local_guardian_policy_current('8a3658c1-773a-4533-81c6-49ff79870214'::uuid)
    AND EXISTS(
     SELECT 1 FROM public.booking_workflow_policy_head h
     JOIN public.booking_workflow_policies old ON old.id=h.policy_id
     WHERE h.source='local_operation' AND h.enabled
      AND old.id='8a3658c1-773a-4533-81c6-49ff79870212'::uuid
      AND old.version='local-booking-v1'
      AND old.content_digest='0a4e0f3b646a7bc5827a2b22ae20cf7f096d131cf85cec8f37ba20363d2e86a7'
    )
  )
  OR EXISTS(
   SELECT 1 FROM public.booking_workflow_policies p
   WHERE p.id=p_policy AND p.id='8a3658c1-773a-4533-81c6-49ff79870217'::uuid
    AND p.version='local-independent-booking-v2' AND p.reference='local:independent-booking:v2'
    AND p.content_digest='20d4a54f04556df4f2ecbbbdf7bf1cb5408e154022914d5c50f347ddf82d072e'
    AND p.terms=jsonb_build_object(
     'authority','local_operation','source','local_operation','policyId',p.id::text,
     'contentDigest',p.content_digest,'version',p.version,'reference',p.reference,
     'admissionPolicyId','8a3658c1-773a-4533-81c6-49ff79870216',
     'durationMinutes',60,'stepMinutes',30,'noticeMinutes',60,'horizonDays',14,
     'provisionalMinutes',10,'cancelCutoffMinutes',60,'moveCutoffMinutes',60,
     'confirmationPrerequisite','local_independent_booking','confirmationActor','authorized_student',
     'outcomeActor','assigned_mfa_admin','completionActor','assigned_tutor',
     'disputePath','/support','meetingAccess','confirmed_until_end'
    )
    AND public.local_independent_policy_current('8a3658c1-773a-4533-81c6-49ff79870216'::uuid)
    AND EXISTS(
     SELECT 1 FROM public.booking_workflow_policy_head h
     JOIN public.booking_workflow_policies old ON old.id=h.policy_id
     WHERE h.source='local_operation' AND h.enabled
      AND old.id='8a3658c1-773a-4533-81c6-49ff79870212'::uuid
      AND old.version='local-booking-v1'
      AND old.content_digest='0a4e0f3b646a7bc5827a2b22ae20cf7f096d131cf85cec8f37ba20363d2e86a7'
    )
  )
 ) OR EXISTS(
  SELECT 1 FROM public.booking_workflow_policy_head h
  JOIN public.booking_workflow_policies p ON p.id=h.policy_id
  WHERE h.source IN ('synthetic_readiness','local_operation')
   AND h.source=p.terms->>'source'
   AND ((h.source='local_operation' AND p.version='local-booking-v1') OR (h.source='synthetic_readiness' AND p.version IN ('synthetic-booking-v1','synthetic-booking-v2')))
   AND h.enabled AND p.id=p_policy
   AND ((h.source='synthetic_readiness' AND p.terms->>'authority'='synthetic_test') OR (h.source='local_operation' AND p.terms->>'authority'='local_operation'))
   AND p.terms->>'version'=p.version AND p.terms->>'reference'=p.reference
   AND p.terms->>'contentDigest'=p.content_digest AND p.terms->>'policyId'=p.id::text
   AND p.terms->>'durationMinutes'='60' AND p.terms->>'stepMinutes'='30'
   AND p.terms->>'noticeMinutes'='60' AND p.terms->>'horizonDays'='14'
   AND p.terms->>'provisionalMinutes'='10' AND p.terms->>'cancelCutoffMinutes'='60'
   AND p.terms->>'moveCutoffMinutes'='60'
   AND p.terms->>'confirmationPrerequisite'=CASE h.source WHEN 'local_operation' THEN 'local_prerequisite_review' ELSE 'synthetic_prerequisite_review' END
   AND p.terms->>'confirmationActor'='assigned_mfa_admin'
   AND p.terms->>'outcomeActor'='assigned_mfa_admin'
   AND (p.version='synthetic-booking-v1' OR (p.version IN ('synthetic-booking-v2','local-booking-v1') AND p.terms->>'completionActor'='assigned_tutor'))
   AND p.terms->>'disputePath'='/support' AND p.terms->>'meetingAccess'='confirmed_until_end'
 );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.create_policy_booking(
 p_actor text,p_session text,p_key uuid,p_policy uuid,p_learner uuid,p_tutor uuid,
 p_subject uuid,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text
) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;p public.booking_workflow_policies;n timestamptz;e uuid;ap uuid;direct boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
  RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';
 END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_key IS NULL OR p_policy IS NULL
  OR p_learner IS NULL OR p_tutor IS NULL OR p_subject IS NULL OR p_start IS NULL
  OR p_end IS NULL OR p_zone IS NULL OR p_fingerprint IS NULL THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 PERFORM u.id FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=p_policy;
 IF p.id IS NULL OR NOT public.booking_workflow_policy_current(p_policy) THEN
  RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 direct:=p.id IN('8a3658c1-773a-4533-81c6-49ff79870215'::uuid,'8a3658c1-773a-4533-81c6-49ff79870217'::uuid);
 ap:=(p.terms->>'admissionPolicyId')::uuid;
 IF p.id='8a3658c1-773a-4533-81c6-49ff79870215'::uuid THEN
  SELECT a.policy_id INTO ap
  FROM public.learner_admissions a JOIN public.learner_profiles l ON l.id=a.learner_id
  WHERE l.id=p_learner AND l.management='guardian' AND l.source='local_operation'
   AND a.requester_user_id=p_actor AND a.state='authorized'
   AND a.policy_id IN('8a3658c1-773a-4533-81c6-49ff79870211'::uuid,'8a3658c1-773a-4533-81c6-49ff79870214'::uuid);
  IF ap IS NULL THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 END IF;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,ap) THEN
  RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF NOT public.booking_workflow_tutor_current(p_tutor,p_learner,p_subject,true) THEN
  RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 SELECT * INTO b FROM public.bookings WHERE booked_by_user_id=p_actor AND idempotency_key=p_key;
 IF b.id IS NOT NULL THEN
  IF b.source IS DISTINCT FROM p.terms->>'source' OR b.request_fingerprint<>p_fingerprint OR b.workflow_policy_id<>p_policy THEN
   RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;
  END IF;
  SELECT id INTO e FROM public.booking_lifecycle_events
   WHERE booking_lifecycle_events.booking_id=b.id
    AND event=CASE WHEN direct THEN 'workflow_confirmed' ELSE 'workflow_provisional' END;
  RETURN QUERY SELECT 'replayed'::text,b.id,e;RETURN;
 END IF;
 n:=clock_timestamp();
 IF p_fingerprint !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF NOT public.booking_workflow_slot_valid(p_tutor,p_start,p_end,n,NULL) THEN
  RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF (SELECT count(*) FROM public.bookings WHERE booked_by_user_id=p_actor AND created_at>n-interval '1 minute')>=20 THEN
  RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 PERFORM public.expire_policy_bookings(p_tutor);
 INSERT INTO public.bookings(
  source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,
  display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,
  workflow_policy_id,admission_policy_id
 ) VALUES(
  p.terms->>'source',p_tutor,p_learner,p_actor,p_subject,p_start,p_end,p_zone,p_key,
  p_fingerprint,CASE WHEN direct THEN 'confirmed' ELSE 'provisional' END,n,n+interval '10 minutes',p_policy,ap
 ) RETURNING * INTO b;
 INSERT INTO public.booking_lifecycle_events(
  logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,
  created_at,workflow_policy_id,workflow_revision,reason_code
 ) VALUES(
  b.logical_booking_id,b.id,p_actor,'workflow_'||b.state,p_key,p_fingerprint,n,p_policy,0,
  CASE p.id
   WHEN '8a3658c1-773a-4533-81c6-49ff79870215'::uuid THEN 'local_parent_booking'
   WHEN '8a3658c1-773a-4533-81c6-49ff79870217'::uuid THEN 'local_independent_booking'
   ELSE CASE WHEN b.source='local_operation' THEN 'local_request' ELSE 'synthetic_request' END
  END
 ) RETURNING id INTO e;
 PERFORM public.assert_booking_workflow_authority(
  p_actor,p_session,b.id,'create',p_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc
 );
 RETURN QUERY SELECT 'created'::text,b.id,e;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.assert_booking_workflow_receipt(
 p_actor text,p_session text,p_booking uuid,p_event uuid,p_action text,p_policy uuid,
 p_replayed boolean,p_original_state text,p_expiry timestamptz,p_start timestamptz,p_end timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;e public.booking_lifecycle_events;family boolean;tutor boolean;expected text;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_event IS NULL
  OR p_policy IS NULL OR p_replayed IS NULL
  OR NOT (p_action IN('create','confirm','cancel','reschedule','complete','no_show')) IS TRUE
  OR public.workflow_identity(p_actor,p_session,(SELECT source FROM public.bookings WHERE id=p_booking)) IS NOT TRUE THEN
  RAISE EXCEPTION 'Receipt identity or action unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE id=p_event;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=EXISTS(
  SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor'
  WHERE t.id=b.tutor_id AND t.user_id=p_actor
 ) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false);
 IF b.id IS NULL OR b.source NOT IN ('synthetic_readiness','local_operation')
  OR b.workflow_policy_id IS DISTINCT FROM p_policy OR public.booking_workflow_policy_current(p_policy) IS NOT TRUE
  OR public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) IS NOT TRUE
  OR e.id IS NULL OR e.workflow_policy_id IS DISTINCT FROM p_policy OR e.logical_booking_id IS DISTINCT FROM b.logical_booking_id
  OR (p_action IN('create','cancel','reschedule') AND NOT (family OR (p_action<>'create' AND tutor)) IS TRUE)
  OR (p_action IN('confirm','complete','no_show') AND public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) IS NOT TRUE)
  OR (p_action IN('create','confirm','reschedule','complete','no_show') AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action IN('create','confirm','reschedule')) IS NOT TRUE) THEN
  RAISE EXCEPTION 'Receipt current authority unavailable' USING ERRCODE='42501';
 END IF;
 IF p_replayed THEN RETURN;END IF;
 IF p_original_state IS NULL OR p_expiry IS NULL OR p_start IS NULL OR p_end IS NULL THEN
  RAISE EXCEPTION 'Receipt transition context unavailable' USING ERRCODE='42501';
 END IF;
 expected:=CASE p_action
  WHEN 'create' THEN CASE WHEN b.workflow_policy_id IN(
   '8a3658c1-773a-4533-81c6-49ff79870215'::uuid,
   '8a3658c1-773a-4533-81c6-49ff79870217'::uuid
  ) THEN 'confirmed' ELSE 'provisional' END
  WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled'
  WHEN 'complete' THEN 'completed' WHEN 'no_show' THEN 'no_show' ELSE p_original_state END;
 IF b.state IS DISTINCT FROM expected
  OR (p_action<>'reschedule' AND (e.booking_id IS DISTINCT FROM b.id OR e.workflow_revision IS DISTINCT FROM b.workflow_revision OR e.event IS DISTINCT FROM 'workflow_'||expected))
  OR (p_action='reschedule' AND (e.replacement_booking_id IS DISTINCT FROM b.id OR e.event IS DISTINCT FROM 'workflow_rescheduled')) THEN
  RAISE EXCEPTION 'Receipt postcondition unavailable' USING ERRCODE='P4090';
 END IF;
 PERFORM public.assert_booking_workflow_authority(
  p_actor,p_session,b.id,p_action,p_policy,p_original_state,p_expiry,p_start,p_end
 );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_booking_workflow_task(
 p_actor text,p_session text,p_booking uuid,p_action text
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.bookings b
  JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id
  JOIN public.tutor_profiles t ON t.id=b.tutor_id
  WHERE b.id=p_booking AND b.source IN ('synthetic_readiness','local_operation') AND (
   (p_action='complete' AND p.version IN(
     'synthetic-booking-v2','local-booking-v1','local-parent-booking-v2','local-independent-booking-v2'
    )
    AND p.terms->>'completionActor'='assigned_tutor'
    AND b.state IN('confirmed','completed') AND t.user_id=p_actor
    AND public.workflow_identity(p_actor,p_session,b.source)
    AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor AND r.role='tutor')
    AND public.booking_workflow_policy_current(p.id)
    AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
    AND public.booking_workflow_tutor_current(t.id,b.learner_id,b.subject_id,false))
   OR
   ((p_action<>'complete' OR p.version='synthetic-booking-v1')
    AND (p.version NOT IN('local-parent-booking-v2','local-independent-booking-v2') OR p_action<>'confirm')
    AND public.has_admin_assurance(p_actor,p_session,28800)
    AND b.booked_by_user_id<>p_actor AND t.user_id<>p_actor
    AND EXISTS(
     SELECT 1 FROM public.booking_workflow_grants g
     WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=p_actor
      AND g.action=p_action AND g.active
      AND ((b.source='local_operation' AND g.valid_until IS NULL
        AND g.reference ~ '^local:[0-9a-f-]{36}$'
        AND public.has_local_workflow_staff(p_actor,p_session,'booking'))
       OR (b.source='synthetic_readiness' AND g.valid_until>clock_timestamp()))
    ))
  )
 );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.change_policy_booking(
 p_actor text,p_session text,p_booking uuid,p_request uuid,p_current_policy uuid,
 p_revision integer,p_action text,p_reason text,p_start timestamptz,p_end timestamptz,
 p_zone text,p_fingerprint text
) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r public.bookings;e public.booking_lifecycle_events;
 p public.booking_workflow_policies;n timestamptz;newstate text;family boolean;tutor boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
  RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';
 END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_request IS NULL
  OR p_current_policy IS NULL OR p_revision IS NULL OR p_revision<0
  OR NOT (p_action IN('confirm','complete','no_show','cancel','reschedule')) IS TRUE
  OR p_reason IS NULL OR p_fingerprint IS NULL
  OR (p_action='reschedule' AND (p_start IS NULL OR p_end IS NULL OR p_zone IS NULL)) THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings prior ON prior.tutor_id=t.id
  WHERE prior.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR NO KEY UPDATE;
 IF b.id IS NULL OR b.source NOT IN ('synthetic_readiness','local_operation') THEN
  RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF p_current_policy IS DISTINCT FROM b.workflow_policy_id
  OR NOT public.booking_workflow_policy_current(p_current_policy) THEN
  RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=b.workflow_policy_id;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.workflow_identity(p_actor,p_session,b.source)
  AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=b.tutor_id AND t.user_id=p_actor)
  AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false)
  AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id);
 IF (p_action IN('cancel','reschedule') AND NOT(family OR tutor))
  OR (p_action IN('confirm','complete','no_show') AND (
   NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action)
   OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
   OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action='confirm')
  )) OR p_action NOT IN('confirm','complete','no_show','cancel','reschedule') THEN
  RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE actor_user_id=p_actor AND request_id=p_request;
 IF e.id IS NOT NULL THEN
  IF e.booking_id<>b.id OR e.request_fingerprint<>p_fingerprint OR e.workflow_policy_id IS NULL THEN
   RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;
  END IF;
  RETURN QUERY SELECT 'replayed'::text,coalesce(e.replacement_booking_id,b.id),e.id;RETURN;
 END IF;
 IF p_fingerprint !~ '^[a-f0-9]{64}$'
  OR p_reason<>((CASE WHEN b.source='local_operation' THEN 'local_' ELSE 'synthetic_' END)||
   (CASE p_action WHEN 'confirm' THEN 'prerequisite_review' WHEN 'complete' THEN 'completed'
    WHEN 'no_show' THEN 'no_show' ELSE 'participant_change' END)) THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 n:=clock_timestamp();
 IF b.workflow_revision<>p_revision
  OR EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision)
  OR b.state NOT IN('provisional','confirmed') OR (b.state='provisional' AND b.expires_at<=n) THEN
  RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF (p_action='confirm' AND (b.state<>'provisional' OR b.start_at_utc<=n))
  OR (p_action IN('complete','no_show') AND (b.state<>'confirmed' OR b.end_at_utc>n))
  OR (p_action IN('cancel','reschedule') AND b.start_at_utc<=n+make_interval(
   mins=>CASE p_action WHEN 'cancel' THEN (p.terms->>'cancelCutoffMinutes')::integer
   ELSE (p.terms->>'moveCutoffMinutes')::integer END
  )) THEN
  RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;
 END IF;
 IF p_action='reschedule' AND (
  NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true)
  OR NOT public.booking_workflow_slot_valid(b.tutor_id,p_start,p_end,n,b.id)
  OR p_start=b.start_at_utc OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone)
 ) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 newstate:=CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled'
  WHEN 'reschedule' THEN 'replaced' WHEN 'complete' THEN 'completed' ELSE 'no_show' END;
 IF NOT public.booking_workflow_policy_current(p_current_policy)
  OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action))
  OR (family AND NOT public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id))
  OR (tutor AND NOT public.workflow_identity(p_actor,p_session,b.source)) THEN
  RAISE EXCEPTION 'Workflow authority changed' USING ERRCODE='42501';
 END IF;
 UPDATE public.bookings SET state=newstate,workflow_revision=workflow_revision+1 WHERE id=b.id;
 IF p_action='reschedule' THEN
  INSERT INTO public.bookings(
   logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,
   subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,
   state,created_at,expires_at,workflow_policy_id,admission_policy_id
  ) VALUES(
   b.logical_booking_id,b.id,b.revision+1,b.source,b.tutor_id,b.learner_id,b.booked_by_user_id,
   b.subject_id,p_start,p_end,p_zone,gen_random_uuid(),p_fingerprint,b.state,n,b.expires_at,
   b.workflow_policy_id,b.admission_policy_id
  ) RETURNING * INTO r;
  INSERT INTO public.booking_lifecycle_events(
   logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,
   created_at,workflow_policy_id,workflow_revision,reason_code
  ) VALUES(
   r.logical_booking_id,r.id,p_actor,'workflow_'||r.state,gen_random_uuid(),p_fingerprint,
   n,r.workflow_policy_id,0,
   CASE r.workflow_policy_id
    WHEN '8a3658c1-773a-4533-81c6-49ff79870215'::uuid THEN 'local_parent_booking'
    WHEN '8a3658c1-773a-4533-81c6-49ff79870217'::uuid THEN 'local_independent_booking'
    ELSE (CASE WHEN b.source='local_operation' THEN 'local_' ELSE 'synthetic_' END)||
     CASE r.state WHEN 'confirmed' THEN 'prerequisite_review' ELSE 'request' END
   END
  );
 END IF;
 INSERT INTO public.booking_lifecycle_events(
  logical_booking_id,booking_id,replacement_booking_id,actor_user_id,event,request_id,
  request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code
 ) VALUES(
  b.logical_booking_id,b.id,r.id,p_actor,
  CASE p_action WHEN 'reschedule' THEN 'workflow_rescheduled' ELSE 'workflow_'||newstate END,
  p_request,p_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,p_reason
 ) RETURNING * INTO e;
 PERFORM public.assert_booking_workflow_authority(
  p_actor,p_session,coalesce(r.id,b.id),p_action,p_current_policy,
  b.state,b.expires_at,b.start_at_utc,b.end_at_utc
 );
 RETURN QUERY SELECT 'saved'::text,coalesce(r.id,b.id),e.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.local_independent_policy_current(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_independent_learner(text,text,uuid,uuid,text,text,text,text,boolean) FROM PUBLIC;
