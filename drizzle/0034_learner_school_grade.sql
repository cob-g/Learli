-- Nullable self-declared school-year metadata; no inference, backfill or authority change.
ALTER TABLE "learner_profiles" ADD COLUMN "grade" integer;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_grade" CHECK ("learner_profiles"."grade" IS NULL OR ("learner_profiles"."grade" BETWEEN 1 AND 12 AND "learner_profiles"."management" = 'guardian' AND "learner_profiles"."level" <> 'college_support'));
--> statement-breakpoint
-- Keep all original entry points and null-grade receipt hashes intact.
CREATE FUNCTION public.create_local_learner_with_grade(
  p_actor text, p_session text, p_request uuid, p_management text,
  p_name text, p_level text, p_zone text, p_grade integer
) RETURNS TABLE(outcome text, learner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_previous public.learner_creation_events%ROWTYPE;
  v_fingerprint text;
  v_id uuid;
  v_now timestamptz;
BEGIN
  -- Actor lock bounds concurrent creation and capacity; compatible with FK checks.
  PERFORM 1 FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid; RETURN;
  END IF;
  PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
  -- New READ COMMITTED command snapshot after every identity/domain wait.
  v_now := clock_timestamp();
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor
        AND ((p_management='guardian' AND r.role='parent') OR (p_management='self' AND r.role='student')))
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid; RETURN;
  END IF;
  IF p_request IS NULL OR p_name IS NULL OR p_name<>btrim(p_name)
    OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
    OR NOT (p_level IN ('elementary','middle_school','high_school','college_support')) IS TRUE
    OR (p_management='self' AND p_level<>'college_support')
    OR (p_grade IS NOT NULL AND (p_grade NOT BETWEEN 1 AND 12 OR p_management<>'guardian' OR p_level='college_support'))
    OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
    OR NOT (p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$') THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;
  v_fingerprint := encode(sha256(convert_to((CASE WHEN p_grade IS NULL THEN jsonb_build_array(p_management,p_name,p_level,p_zone) ELSE jsonb_build_array(p_management,p_name,p_level,p_zone,p_grade) END)::text,'UTF8')),'hex');
  SELECT e.* INTO v_previous FROM public.learner_creation_events e
    WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
  IF FOUND THEN
    IF v_previous.fingerprint<>v_fingerprint THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
    ELSE
      RETURN QUERY SELECT 'replayed'::text, v_previous.learner_id;
    END IF;
    RETURN;
  END IF;
  IF p_management='self' AND EXISTS (SELECT 1 FROM public.learner_profiles l WHERE l.user_id=p_actor) THEN
    RETURN QUERY SELECT 'exists'::text, NULL::uuid; RETURN;
  END IF;
  IF p_management='guardian' AND (SELECT count(*) FROM public.learner_creation_events e
    WHERE e.actor_user_id=p_actor AND e.management='guardian')>=20 THEN
    RETURN QUERY SELECT 'capacity'::text, NULL::uuid; RETURN;
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO public.learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone,grade,created_at,updated_at)
    VALUES(v_id,'local-created:' || v_id::text,'local_fixture',p_management,
      CASE WHEN p_management='self' THEN p_actor ELSE NULL END,p_name,p_level,p_zone,p_grade,v_now,v_now);
  IF p_management='guardian' THEN
    INSERT INTO public.guardian_learner_links(guardian_user_id,learner_id,source,status,created_at,updated_at)
      VALUES(p_actor,v_id,'local_fixture','authorized',v_now,v_now);
  END IF;
  INSERT INTO public.learner_creation_events(actor_user_id,request_id,fingerprint,learner_id,management,created_at)
    VALUES(p_actor,p_request,v_fingerprint,v_id,p_management,v_now);
  RETURN QUERY SELECT 'created'::text, v_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_local_learner_with_grade(text,text,uuid,text,text,text,text,integer) FROM PUBLIC;

--> statement-breakpoint
CREATE FUNCTION public.create_learner_admission_with_grade(p_actor text,p_session text,p_request uuid,p_policy uuid,p_management text,p_name text,p_level text,p_zone text,p_selection text,p_grade integer)
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
 VALUES(v_l,'readiness-admission:'||v_a::text,'synthetic_readiness',p_management,CASE WHEN p_management='self' THEN p_actor END,p_name,p_level,p_zone,p_grade,'inactive',v_now,v_now);
 INSERT INTO public.learner_admissions(id,requester_user_id,learner_id,management,policy_id,policy_version,policy_reference,policy_digest,request_id,request_fingerprint,selection_path,created_at,updated_at)
 VALUES(v_a,p_actor,v_l,p_management,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,p_request,v_hash,p_selection,v_now,v_now);
 INSERT INTO public.learner_admission_events(admission_id,actor_user_id,request_id,fingerprint,event,to_state,revision,policy_id,policy_version,policy_reference,policy_digest,created_at)
 VALUES(v_a,p_actor,p_request,v_hash,'requested','pending',0,p_policy,v_policy.version,v_policy.reference,v_policy.content_digest,v_now);
 IF NOT public.admission_identity(p_actor,p_session) OR NOT public.admission_policy_current(p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'created'::text,v_a,v_l,0;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_learner_admission_with_grade(text,text,uuid,uuid,text,text,text,text,text,integer) FROM PUBLIC;

--> statement-breakpoint
CREATE FUNCTION public.update_admitted_learner_with_grade(p_actor text,p_session text,p_learner uuid,p_policy uuid,p_name text,p_zone text,p_grade integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_admission uuid;
BEGIN
 SELECT a.id INTO v_admission FROM public.learner_admissions a WHERE a.learner_id=p_learner;
 PERFORM public.lock_learner_admission(p_actor,p_session,v_admission);
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RETURN false;END IF;
 IF p_grade IS NOT NULL AND (p_grade NOT BETWEEN 1 AND 12 OR NOT EXISTS(SELECT 1 FROM public.learner_profiles l WHERE l.id=p_learner AND l.management='guardian' AND l.level<>'college_support')) THEN RETURN false;END IF;
 IF p_name IS NULL OR p_name<>btrim(p_name) OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
 OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
 OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$') THEN RETURN false;END IF;
 UPDATE public.learner_profiles SET display_name=p_name,timezone=p_zone,grade=p_grade,updated_at=clock_timestamp() WHERE id=p_learner;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501';END IF;
 RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.update_admitted_learner_with_grade(text,text,uuid,uuid,text,text,integer) FROM PUBLIC;
