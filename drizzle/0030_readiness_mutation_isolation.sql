-- Current administrative authority requires fresh statement snapshots after waits.
-- Preserve existing function ownership and execute ACLs through CREATE OR REPLACE.
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
CREATE OR REPLACE FUNCTION public.change_safeguarding_response(p_actor text,p_session text,p_case uuid,p_expected integer,p_key uuid,p_action text,p_target text DEFAULT NULL)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.support_cases%ROWTYPE;r public.support_case_responses%ROWTYPE;p public.support_response_policies%ROWTYPE;prior public.support_response_events%ROWTYPE;v_previous text;v_scope text;v_now timestamptz;v_status text;v_cycle integer;v_assignment integer;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Safeguarding response changes require read committed' USING ERRCODE='25001';END IF;
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
CREATE OR REPLACE FUNCTION public.change_safeguarding_access(p_actor text,p_session text,p_target text,p_expected integer,p_action text,p_reason text,p_key uuid)
RETURNS TABLE(outcome text,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t public.account_restriction_targets%ROWTYPE;g public.account_restriction_grants%ROWTYPE;p public.support_response_policies%ROWTYPE;prior public.account_restriction_events%ROWTYPE;v_status text;v_next text;v_now timestamptz;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Safeguarding access changes require read committed' USING ERRCODE='25001';END IF;
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
