-- Current authority checks require a fresh statement snapshot after waits.
-- Retain existing ownership and execute ACLs through CREATE OR REPLACE.
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
