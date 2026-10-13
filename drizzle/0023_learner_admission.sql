CREATE TABLE "learner_admission_assignments" (
	"admission_id" uuid PRIMARY KEY NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"capability_code" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admission_assignments_revision" CHECK ("learner_admission_assignments"."revision">=0)
);
--> statement-breakpoint
CREATE TABLE "learner_admission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"event" text NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"revision" integer NOT NULL,
	"policy_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"policy_reference" text NOT NULL,
	"policy_digest" text NOT NULL,
	"evidence_id" uuid,
	"assignment_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admission_events_revision" UNIQUE("admission_id","revision"),
	CONSTRAINT "learner_admission_events_request" UNIQUE("actor_user_id","request_id"),
	CONSTRAINT "learner_admission_events_shape" CHECK ("learner_admission_events"."revision">=0 AND "learner_admission_events"."fingerprint" ~ '^[a-f0-9]{64}$' AND ("learner_admission_events"."event" IN ('requested','evidence_recorded','evidence_revoked','authorized','rejected','revoked','assigned')) AND ("learner_admission_events"."to_state" IN ('pending','authorized','rejected','revoked')) AND (("learner_admission_events"."event"='requested' AND "learner_admission_events"."from_state" IS NULL AND "learner_admission_events"."to_state"='pending' AND "learner_admission_events"."revision"=0) OR ("learner_admission_events"."event"<>'requested' AND "learner_admission_events"."from_state" IS NOT NULL AND "learner_admission_events"."revision">0)))
);
--> statement-breakpoint
CREATE TABLE "learner_admission_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"check_code" text NOT NULL,
	"method" text NOT NULL,
	"notice_version" text,
	"reference" text NOT NULL,
	"subject_user_id" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "learner_admission_evidence_request" UNIQUE("recorded_by_user_id","request_id"),
	CONSTRAINT "learner_admission_evidence_reference" UNIQUE("source","reference"),
	CONSTRAINT "learner_admission_evidence_shape" CHECK ("learner_admission_evidence"."source"='synthetic_readiness' AND "learner_admission_evidence"."check_code" IN ('guardian_authority','guardian_notice','independent_eligibility') AND "learner_admission_evidence"."reference" ~ '^[A-Za-z0-9:_-]{1,128}$' AND "learner_admission_evidence"."fingerprint" ~ '^[a-f0-9]{64}$' AND "learner_admission_evidence"."subject_user_id"<>"learner_admission_evidence"."recorded_by_user_id" AND ("learner_admission_evidence"."revoked_at" IS NULL OR "learner_admission_evidence"."revoked_at">="learner_admission_evidence"."recorded_at"))
);
--> statement-breakpoint
CREATE TABLE "learner_admission_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"authority" text NOT NULL,
	"version" text NOT NULL,
	"reference" text NOT NULL,
	"market_code" text NOT NULL,
	"content_digest" text NOT NULL,
	"notice_version" text NOT NULL,
	"guardian_proof_method" text NOT NULL,
	"independent_eligibility_rule" text NOT NULL,
	"reviewer_capability_code" text NOT NULL,
	"revocation_effect" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admission_policy_identity" UNIQUE("id","source","market_code"),
	CONSTRAINT "learner_admission_policy_version" UNIQUE("source","market_code","version"),
	CONSTRAINT "learner_admission_policy_receipt" UNIQUE("id","version","reference","content_digest"),
	CONSTRAINT "learner_admission_policy_synthetic" CHECK ("learner_admission_policies"."source"='synthetic_readiness' AND "learner_admission_policies"."authority"='synthetic_test' AND "learner_admission_policies"."version"='synthetic-admission-v1' AND "learner_admission_policies"."reference"='synthetic:admission:v1' AND "learner_admission_policies"."market_code"='synthetic_test' AND "learner_admission_policies"."notice_version"='synthetic-notice-v1' AND "learner_admission_policies"."guardian_proof_method"='synthetic_guardian_review' AND "learner_admission_policies"."independent_eligibility_rule"='synthetic_independent_review' AND "learner_admission_policies"."reviewer_capability_code"='learner_admission_review' AND "learner_admission_policies"."revocation_effect"='deny_current_learner_access' AND "learner_admission_policies"."content_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "learner_admission_policy_state" (
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"market_code" text NOT NULL,
	"current_policy_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admission_policy_state_source_market_code_pk" PRIMARY KEY("source","market_code"),
	CONSTRAINT "learner_admission_policy_state_revision" CHECK ("learner_admission_policy_state"."revision">=0)
);
--> statement-breakpoint
CREATE TABLE "learner_admission_reviewers" (
	"user_id" text NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"capability_code" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admission_reviewers_user_id_source_capability_code_pk" PRIMARY KEY("user_id","source","capability_code"),
	CONSTRAINT "learner_admission_reviewers_scope" CHECK ("learner_admission_reviewers"."source"='synthetic_readiness' AND "learner_admission_reviewers"."capability_code"='learner_admission_review')
);
--> statement-breakpoint
CREATE TABLE "learner_admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" text NOT NULL,
	"learner_id" uuid NOT NULL,
	"management" text NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"policy_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"policy_reference" text NOT NULL,
	"policy_digest" text NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"selection_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_admissions_learner_id_unique" UNIQUE("learner_id"),
	CONSTRAINT "learner_admissions_request" UNIQUE("requester_user_id","request_id"),
	CONSTRAINT "learner_admissions_shape" CHECK ("learner_admissions"."source"='synthetic_readiness' AND "learner_admissions"."management" IN ('guardian','self') AND "learner_admissions"."state" IN ('pending','authorized','rejected','revoked') AND "learner_admissions"."revision">=0 AND "learner_admissions"."request_fingerprint" ~ '^[a-f0-9]{64}$' AND ("learner_admissions"."selection_path" IS NULL OR char_length("learner_admissions"."selection_path")<=2048))
);
--> statement-breakpoint
ALTER TABLE "guardian_learner_links" DROP CONSTRAINT "guardian_learner_links_source";--> statement-breakpoint
ALTER TABLE "learner_profiles" DROP CONSTRAINT "learner_profiles_source";--> statement-breakpoint
ALTER TABLE "learner_admission_assignments" ADD CONSTRAINT "learner_admission_assignments_admission_id_learner_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."learner_admissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_assignments" ADD CONSTRAINT "learner_admission_assignment_scope_fk" FOREIGN KEY ("reviewer_user_id","source","capability_code") REFERENCES "public"."learner_admission_reviewers"("user_id","source","capability_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_events" ADD CONSTRAINT "learner_admission_events_admission_id_learner_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."learner_admissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_events" ADD CONSTRAINT "learner_admission_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_events" ADD CONSTRAINT "learner_admission_events_evidence_id_learner_admission_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."learner_admission_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_events" ADD CONSTRAINT "learner_admission_events_policy_receipt_fk" FOREIGN KEY ("policy_id","policy_version","policy_reference","policy_digest") REFERENCES "public"."learner_admission_policies"("id","version","reference","content_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" ADD CONSTRAINT "learner_admission_evidence_admission_id_learner_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."learner_admissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" ADD CONSTRAINT "learner_admission_evidence_policy_id_learner_admission_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."learner_admission_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" ADD CONSTRAINT "learner_admission_evidence_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_evidence" ADD CONSTRAINT "learner_admission_evidence_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_policy_state" ADD CONSTRAINT "learner_admission_current_policy_fk" FOREIGN KEY ("current_policy_id","source","market_code") REFERENCES "public"."learner_admission_policies"("id","source","market_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admission_reviewers" ADD CONSTRAINT "learner_admission_reviewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_admissions" ADD CONSTRAINT "learner_admissions_policy_receipt_fk" FOREIGN KEY ("policy_id","policy_version","policy_reference","policy_digest") REFERENCES "public"."learner_admission_policies"("id","version","reference","content_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learner_admission_evidence_admission_idx" ON "learner_admission_evidence" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "learner_admissions_requester_idx" ON "learner_admissions" USING btree ("requester_user_id","created_at");--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_id_management_source_unique" UNIQUE("id","management","source");
--> statement-breakpoint
ALTER TABLE "guardian_learner_links" ADD CONSTRAINT "guardian_learner_links_source_fk" FOREIGN KEY ("learner_id","management","source") REFERENCES "public"."learner_profiles"("id","management","source") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_learner_links" ADD CONSTRAINT "guardian_learner_links_source" CHECK ("guardian_learner_links"."source" IN ('local_fixture', 'synthetic_readiness'));--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_source" CHECK ("learner_profiles"."source" IN ('local_fixture', 'synthetic_readiness'));
--> statement-breakpoint
CREATE FUNCTION public.admission_identity(p_actor text,p_session text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
 JOIN public.user_access x ON x.user_id=u.id WHERE s.id=p_session AND s.user_id=p_actor
 AND s.expires_at>clock_timestamp() AND u.email_verified AND u.email LIKE '%.test' AND x.status='active');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admission_identity(text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.admission_policy_current(p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public.learner_admission_policies p JOIN public.learner_admission_policy_state s
 ON s.current_policy_id=p.id AND s.source=p.source AND s.market_code=p.market_code
 WHERE p.id=p_policy AND p.source='synthetic_readiness' AND p.authority='synthetic_test' AND s.enabled);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admission_policy_current(uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.admission_evidence_complete(p_admission uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public.learner_admissions a JOIN public.learner_admission_policies p ON p.id=a.policy_id
 WHERE a.id=p_admission AND NOT EXISTS(SELECT 1 FROM
 (VALUES ('guardian','guardian_authority'),('guardian','guardian_notice'),('self','independent_eligibility')) needed(management,code)
 WHERE needed.management=a.management AND NOT EXISTS(SELECT 1 FROM public.learner_admission_evidence e
 WHERE e.admission_id=a.id AND e.policy_id=a.policy_id AND e.source=a.source AND e.subject_user_id=a.requester_user_id
 AND e.recorded_by_user_id<>a.requester_user_id AND e.check_code=needed.code AND e.revoked_at IS NULL
 AND e.method=CASE WHEN a.management='guardian' THEN p.guardian_proof_method ELSE p.independent_eligibility_rule END
 AND (CASE WHEN e.check_code='guardian_notice' THEN e.notice_version=p.notice_version ELSE e.notice_version IS NULL END) IS TRUE)));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admission_evidence_complete(uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.has_current_learner_authority(p_actor text,p_session text,p_learner uuid,p_policy uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT public.admission_identity(p_actor,p_session) AND public.admission_policy_current(p_policy) AND EXISTS(
 SELECT 1 FROM public.learner_profiles l JOIN public.learner_admissions a ON a.learner_id=l.id
 JOIN public.learner_admission_policies p ON p.id=a.policy_id
 WHERE l.id=p_learner AND l.source='synthetic_readiness' AND l.status='active' AND a.state='authorized'
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
REVOKE ALL ON FUNCTION public.has_current_learner_authority(text,text,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.admission_reviewer_allowed(p_actor text,p_session text,p_admission uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT public.admission_identity(p_actor,p_session) AND public.has_admin_assurance(p_actor,p_session,28800)
 AND EXISTS(SELECT 1 FROM public.learner_admissions a JOIN public.learner_admission_policies p ON p.id=a.policy_id
 JOIN public.learner_admission_assignments x ON x.admission_id=a.id
 JOIN public.learner_admission_reviewers r ON r.user_id=x.reviewer_user_id AND r.source=x.source AND r.capability_code=x.capability_code
 WHERE a.id=p_admission AND a.requester_user_id<>p_actor AND x.reviewer_user_id=p_actor
 AND x.source=a.source AND x.capability_code=p.reviewer_capability_code AND r.active);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admission_reviewer_allowed(text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.lock_learner_admission(p_actor text,p_session text,p_admission uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_requester text; v_learner uuid; v_policy uuid;
BEGIN
 SELECT a.requester_user_id,a.learner_id,a.policy_id INTO v_requester,v_learner,v_policy FROM public.learner_admissions a WHERE a.id=p_admission;
 PERFORM 1 FROM public."user" u WHERE u.id IN(p_actor,v_requester) ORDER BY u.id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.learner_admission_policy_state s JOIN public.learner_admission_policies p ON p.source=s.source AND p.market_code=s.market_code WHERE p.id=v_policy FOR SHARE OF s;
 PERFORM 1 FROM public.learner_admissions a WHERE a.id=p_admission FOR NO KEY UPDATE;
 PERFORM 1 FROM public.learner_profiles l WHERE l.id=v_learner FOR NO KEY UPDATE;
 PERFORM 1 FROM public.learner_admission_assignments x WHERE x.admission_id=p_admission FOR SHARE;
 PERFORM 1 FROM public.learner_admission_reviewers r JOIN public.learner_admission_assignments x
 ON x.reviewer_user_id=r.user_id AND x.source=r.source AND x.capability_code=r.capability_code WHERE x.admission_id=p_admission FOR SHARE OF r;
 PERFORM 1 FROM public.learner_admission_evidence e WHERE e.admission_id=p_admission ORDER BY e.id FOR SHARE;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lock_learner_admission(text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.valid_admission_selection(p_selection text) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_parts text[];v_zone text;v_start timestamptz;v_end timestamptz;
BEGIN
 IF p_selection IS NULL THEN RETURN true;END IF;
 IF char_length(p_selection)>2048 THEN RETURN false;END IF;
 v_parts:=string_to_array(p_selection,'&');
 IF cardinality(v_parts)<>6
 OR v_parts[1] !~ '^/bookings/demo[?]tutorSlug=[a-z0-9]+(-[a-z0-9]+)*$'
 OR v_parts[2] !~ '^subjectSlug=[a-z0-9]+(-[a-z0-9]+)*$'
 OR char_length(split_part(v_parts[1],'=',2))>80 OR char_length(split_part(v_parts[2],'=',2))>80
 OR v_parts[3] !~ '^level=(elementary|middle_school|high_school|college_support)$'
 OR v_parts[4] !~ '^displayTimezone=(UTC|[A-Za-z_]+%2F[A-Za-z_/%2FB0-9+-]+)$'
 OR v_parts[5] !~ '^startAtUtc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}%3A[0-9]{2}%3A[0-9]{2}[.][0-9]{3}Z$'
 OR v_parts[6] !~ '^endAtUtc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}%3A[0-9]{2}%3A[0-9]{2}[.][0-9]{3}Z$'
 THEN RETURN false;END IF;
 v_zone:=replace(replace(split_part(v_parts[4],'=',2),'%2F','/'),'%2B','+');
 IF v_zone ~* '^etc/' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=v_zone) THEN RETURN false;END IF;
 v_start:=replace(split_part(v_parts[5],'=',2),'%3A',':')::timestamptz;
 v_end:=replace(split_part(v_parts[6],'=',2),'%3A',':')::timestamptz;
 RETURN isfinite(v_start) AND isfinite(v_end) AND v_end-v_start=interval '1 hour';
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.valid_admission_selection(text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.create_learner_admission(p_actor text,p_session text,p_request uuid,p_policy uuid,p_management text,p_name text,p_level text,p_zone text,p_selection text)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_policy public.learner_admission_policies%ROWTYPE; v_prior public.learner_admissions%ROWTYPE; v_hash text; v_a uuid; v_l uuid; v_now timestamptz;
BEGIN
 PERFORM 1 FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
 PERFORM 1 FROM public.learner_admission_policy_state s JOIN public.learner_admission_policies p
 ON p.source=s.source AND p.market_code=s.market_code WHERE p.id=p_policy FOR SHARE OF s;
 IF NOT public.admission_identity(p_actor,p_session) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer; RETURN; END IF;
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
 VALUES(v_l,'readiness-admission:'||v_a::text,'synthetic_readiness',p_management,CASE WHEN p_management='self' THEN p_actor END,p_name,p_level,p_zone,'inactive',v_now,v_now);
 INSERT INTO public.learner_admissions(id,requester_user_id,learner_id,management,policy_id,policy_version,policy_reference,policy_digest,request_id,request_fingerprint,selection_path,created_at,updated_at)
 VALUES(v_a,p_actor,v_l,p_management,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,p_request,v_hash,p_selection,v_now,v_now);
 INSERT INTO public.learner_admission_events(admission_id,actor_user_id,request_id,fingerprint,event,to_state,revision,policy_id,policy_version,policy_reference,policy_digest,created_at)
 VALUES(v_a,p_actor,p_request,v_hash,'requested','pending',0,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,v_now);
 IF NOT public.admission_identity(p_actor,p_session) OR NOT public.admission_policy_current(p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'created'::text,v_a,v_l,0;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_learner_admission(text,text,uuid,uuid,text,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.append_learner_admission_event(p_admission uuid,p_actor text,p_request uuid,p_hash text,p_event text,p_to text,p_evidence uuid,p_now timestamptz,p_assignment integer DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_assignment integer;
BEGIN
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=p_admission;
 SELECT x.revision INTO v_assignment FROM public.learner_admission_assignments x WHERE x.admission_id=p_admission;
 UPDATE public.learner_admissions SET state=p_to,revision=v_a.revision+1,updated_at=p_now WHERE id=p_admission;
 INSERT INTO public.learner_admission_events(admission_id,actor_user_id,request_id,fingerprint,event,from_state,to_state,revision,policy_id,policy_version,policy_reference,policy_digest,evidence_id,assignment_revision,created_at)
 VALUES(p_admission,p_actor,p_request,p_hash,p_event,v_a.state,p_to,v_a.revision+1,v_a.policy_id,v_a.policy_version,v_a.policy_reference,v_a.policy_digest,p_evidence,coalesce(p_assignment,v_assignment),p_now);
 RETURN v_a.revision+1;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.append_learner_admission_event(uuid,text,uuid,text,text,text,uuid,timestamptz,integer) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.record_learner_admission_evidence(p_actor text,p_session text,p_admission uuid,p_revision integer,p_request uuid,p_check text,p_reference text)
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
 INSERT INTO public.learner_admission_evidence(id,admission_id,policy_id,check_code,method,notice_version,reference,subject_user_id,recorded_by_user_id,request_id,fingerprint,recorded_at)
 VALUES(v_id,p_admission,v_a.policy_id,p_check,CASE WHEN v_a.management='guardian' THEN v_p.guardian_proof_method ELSE v_p.independent_eligibility_rule END,
 CASE WHEN p_check='guardian_notice' THEN v_p.notice_version END,p_reference,v_a.requester_user_id,p_actor,p_request,v_hash,v_now);
 v_rev:=public.append_learner_admission_event(p_admission,p_actor,p_request,v_hash,'evidence_recorded',v_a.state,v_id,v_now);
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) OR NOT public.admission_policy_current(v_a.policy_id) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'recorded'::text,v_a.id,v_a.learner_id,v_rev;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_learner_admission_evidence(text,text,uuid,integer,uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.decide_learner_admission(p_actor text,p_session text,p_admission uuid,p_revision integer,p_request uuid,p_action text)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_prior public.learner_admission_events%ROWTYPE;v_hash text;v_to text;v_now timestamptz;v_rev integer;
BEGIN
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
    WHERE u.id=v_a.requester_user_id AND u.email_verified AND u.email LIKE '%.test' AND x.status='active')
  THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 END IF;
 v_now:=clock_timestamp();v_to:=CASE p_action WHEN 'authorize' THEN 'authorized' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END;
 UPDATE public.learner_profiles SET status=CASE WHEN p_action='authorize' THEN 'active' ELSE 'inactive' END,updated_at=v_now WHERE id=v_a.learner_id;
 IF p_action='authorize' THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(v_a.requester_user_id,CASE WHEN v_a.management='guardian' THEN 'parent' ELSE 'student' END) ON CONFLICT DO NOTHING;
  IF v_a.management='guardian' THEN
   INSERT INTO public.guardian_learner_links(guardian_user_id,learner_id,source,status,created_at,updated_at) VALUES(v_a.requester_user_id,v_a.learner_id,'synthetic_readiness','authorized',v_now,v_now);
  END IF;
 ELSIF p_action='revoke' AND v_a.management='guardian' THEN
  UPDATE public.guardian_learner_links g SET status='revoked',updated_at=v_now WHERE g.learner_id=v_a.learner_id AND g.guardian_user_id=v_a.requester_user_id;
 END IF;
 v_rev:=public.append_learner_admission_event(p_admission,p_actor,p_request,v_hash,v_to,v_to,NULL,v_now);
 IF p_action='authorize' AND (NOT public.admission_policy_current(v_a.policy_id) OR NOT public.admission_evidence_complete(p_admission) OR NOT EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access x ON x.user_id=u.id WHERE u.id=v_a.requester_user_id AND u.email_verified AND u.email LIKE '%.test' AND x.status='active')) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'decided'::text,v_a.id,v_a.learner_id,v_rev;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.decide_learner_admission(text,text,uuid,integer,uuid,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.revoke_learner_admission_evidence(p_actor text,p_session text,p_admission uuid,p_revision integer,p_request uuid,p_evidence uuid)
RETURNS TABLE(outcome text,admission_id uuid,learner_id uuid,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_prior public.learner_admission_events%ROWTYPE;v_hash text;v_now timestamptz;v_rev integer;
BEGIN
 PERFORM public.lock_learner_admission(p_actor,p_session,p_admission);
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=p_admission;
 v_hash:=encode(sha256(convert_to(jsonb_build_array(p_admission,p_revision,'evidence_revoked',p_evidence)::text,'UTF8')),'hex');
 SELECT e.* INTO v_prior FROM public.learner_admission_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
 IF FOUND THEN
  IF v_prior.fingerprint<>v_hash THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;
  ELSE RETURN QUERY SELECT 'replayed'::text,v_a.id,v_a.learner_id,v_prior.revision;END IF;RETURN;
 END IF;
 IF p_request IS NULL OR p_revision IS NULL OR p_evidence IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 IF v_a.revision<>p_revision OR NOT EXISTS(SELECT 1 FROM public.learner_admission_evidence e WHERE e.id=p_evidence AND e.admission_id=p_admission AND e.revoked_at IS NULL)
 THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid,NULL::integer;RETURN;END IF;
 v_now:=clock_timestamp();
 UPDATE public.learner_admission_evidence SET revoked_at=v_now WHERE id=p_evidence;
 v_rev:=public.append_learner_admission_event(p_admission,p_actor,p_request,v_hash,'evidence_revoked',v_a.state,p_evidence,v_now);
 IF v_a.state='authorized' THEN
  UPDATE public.learner_profiles SET status='inactive',updated_at=v_now WHERE id=v_a.learner_id;
  UPDATE public.guardian_learner_links g SET status='revoked',updated_at=v_now WHERE g.learner_id=v_a.learner_id AND g.source=v_a.source;
  PERFORM public.append_learner_admission_event(p_admission,p_actor,gen_random_uuid(),v_hash,'revoked','revoked',p_evidence,v_now);
 END IF;
 IF NOT public.admission_reviewer_allowed(p_actor,p_session,p_admission) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'decided'::text,v_a.id,v_a.learner_id,v_rev;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_learner_admission_evidence(text,text,uuid,integer,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.update_admitted_learner(p_actor text,p_session text,p_learner uuid,p_policy uuid,p_name text,p_zone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_admission uuid;
BEGIN
 SELECT a.id INTO v_admission FROM public.learner_admissions a WHERE a.learner_id=p_learner;
 PERFORM public.lock_learner_admission(p_actor,p_session,v_admission);
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RETURN false;END IF;
 IF p_name IS NULL OR p_name<>btrim(p_name) OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
 OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
 OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$') THEN RETURN false;END IF;
 UPDATE public.learner_profiles SET display_name=p_name,timezone=p_zone,updated_at=clock_timestamp() WHERE id=p_learner;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.update_admitted_learner(text,text,uuid,uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.protect_learner_admission_records() RETURNS trigger
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
   OR(OLD.source='synthetic_readiness' AND (current_user='learli_app' OR NEW.level<>OLD.level))
  THEN RAISE EXCEPTION 'Learner provenance is protected.' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='guardian_learner_links' THEN
  IF(OLD.guardian_user_id,OLD.learner_id,OLD.management,OLD.source) IS DISTINCT FROM(NEW.guardian_user_id,NEW.learner_id,NEW.management,NEW.source)
  THEN RAISE EXCEPTION 'Guardian provenance is protected.' USING ERRCODE='55000';END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_learner_admission_records() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER learner_admission_policies_immutable BEFORE UPDATE OR DELETE ON public.learner_admission_policies FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE TRIGGER learner_admission_events_immutable BEFORE UPDATE OR DELETE ON public.learner_admission_events FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE TRIGGER learner_admissions_protected BEFORE UPDATE OR DELETE ON public.learner_admissions FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE TRIGGER learner_admission_evidence_protected BEFORE UPDATE OR DELETE ON public.learner_admission_evidence FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE TRIGGER learner_admission_profile_protected BEFORE UPDATE ON public.learner_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE TRIGGER learner_admission_link_protected BEFORE UPDATE ON public.guardian_learner_links FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE FUNCTION public.audit_learner_admission_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_a public.learner_admissions%ROWTYPE;v_now timestamptz;v_revision integer;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment history is retained.' USING ERRCODE='55000';END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=NEW.admission_id FOR NO KEY UPDATE;
 IF NEW.reviewer_user_id=v_a.requester_user_id OR NEW.source<>v_a.source OR NEW.capability_code<>'learner_admission_review'
 OR(TG_OP='UPDATE' AND (NEW.admission_id<>OLD.admission_id OR NEW.source<>OLD.source OR NEW.capability_code<>OLD.capability_code))
 THEN RAISE EXCEPTION 'Assignment scope is invalid.' USING ERRCODE='55000';END IF;
 NEW.revision:=CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.revision+1 END;
 v_now:=clock_timestamp();NEW.updated_at:=v_now;
 v_revision:=public.append_learner_admission_event(NEW.admission_id,NEW.reviewer_user_id,gen_random_uuid(),
 encode(sha256(convert_to(jsonb_build_array(NEW.admission_id,NEW.reviewer_user_id,NEW.revision)::text,'UTF8')),'hex'),'assigned',v_a.state,NULL,v_now,NEW.revision);
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_learner_admission_assignment() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER learner_admission_assignment_audited BEFORE INSERT OR UPDATE OR DELETE ON public.learner_admission_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_learner_admission_assignment();
--> statement-breakpoint
CREATE FUNCTION public.check_learner_admission_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_id uuid;v_a public.learner_admissions%ROWTYPE;v_l public.learner_profiles%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='learner_profiles' THEN
  IF NEW.source<>'synthetic_readiness' THEN RETURN NULL;END IF;
  SELECT a.id INTO v_id FROM public.learner_admissions a WHERE a.learner_id=NEW.id;
 ELSIF TG_TABLE_NAME='guardian_learner_links' THEN
  IF NEW.source<>'synthetic_readiness' THEN RETURN NULL;END IF;
  SELECT a.id INTO v_id FROM public.learner_admissions a WHERE a.learner_id=NEW.learner_id;
 ELSIF TG_TABLE_NAME='learner_admissions' THEN v_id:=NEW.id;
 ELSE v_id:=NEW.admission_id;END IF;
 SELECT a.* INTO v_a FROM public.learner_admissions a WHERE a.id=v_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admission provenance is required.' USING ERRCODE='23514';END IF;
 SELECT l.* INTO v_l FROM public.learner_profiles l WHERE l.id=v_a.learner_id;
 IF v_l.source<>v_a.source OR v_l.management<>v_a.management
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
REVOKE ALL ON FUNCTION public.check_learner_admission_integrity() FROM PUBLIC;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER learner_admission_profile_integrity AFTER INSERT OR UPDATE ON public.learner_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_learner_admission_integrity();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER learner_admission_link_integrity AFTER INSERT OR UPDATE ON public.guardian_learner_links DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_learner_admission_integrity();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER learner_admission_state_integrity AFTER INSERT OR UPDATE ON public.learner_admissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_learner_admission_integrity();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER learner_admission_evidence_integrity AFTER INSERT OR UPDATE ON public.learner_admission_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_learner_admission_integrity();
