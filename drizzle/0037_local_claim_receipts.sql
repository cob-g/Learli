-- Replays and post-write receipts share exact current source/task authority.
CREATE FUNCTION public.local_workflow_claim_current(p_actor text,p_session text,p_kind text,p_target text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.has_local_workflow_staff(p_actor,p_session,p_kind) THEN RETURN false;END IF;
 IF p_kind='admission' THEN RETURN EXISTS(SELECT 1 FROM public.learner_admissions a WHERE a.id=p_target::uuid AND a.source='local_operation' AND public.admission_policy_current(a.policy_id) AND public.admission_reviewer_allowed(p_actor,p_session,a.id));
 ELSIF p_kind='screening' THEN RETURN EXISTS(SELECT 1 FROM public.tutor_screening_cases c JOIN public.tutor_screening_policy_heads h ON h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled' JOIN public.tutor_screening_policies p ON p.provenance=c.provenance AND p.version=c.policy_version WHERE c.tutor_id=p_target::uuid AND c.provenance='local_operation' AND p.valid_from<=clock_timestamp() AND (p.valid_until IS NULL OR p.valid_until>clock_timestamp()) AND public.has_tutor_screening_authority(p_actor,p_session,c.tutor_id,c.provenance));
 ELSIF p_kind='booking' THEN RETURN EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=p_target::uuid AND b.source='local_operation' AND (b.state<>'provisional' OR b.expires_at>clock_timestamp()) AND public.has_booking_workflow_task(p_actor,p_session,b.id,'confirm') AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true));
 ELSIF p_kind='support' THEN RETURN EXISTS(SELECT 1 FROM public.support_case_assignments assignment JOIN public.support_reviewers reviewer ON reviewer.user_id=assignment.reviewer_user_id JOIN public.support_cases report ON report.id=assignment.case_id WHERE assignment.case_id=p_target::uuid AND assignment.reviewer_user_id=p_actor AND reviewer.source='local_operation' AND reviewer.status='authorized' AND reviewer.valid_until IS NULL AND report.source='local_operation' AND report.requester_user_id<>p_actor);
 ELSIF p_kind='account' THEN RETURN p_target<>p_actor AND EXISTS(SELECT 1 FROM public.account_restriction_grants g JOIN public.account_restriction_targets target ON target.user_id=g.target_user_id WHERE g.staff_user_id=p_actor AND g.target_user_id=p_target AND g.source='local_operation' AND target.source=g.source AND g.status='authorized' AND g.valid_until IS NULL AND g.permitted_actions=ARRAY['restrict','restore']) AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_target AND role='admin');
 END IF;
 RETURN false;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.local_workflow_claim_current(text,text,text,text) FROM PUBLIC;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.claim_local_workflow_task(p_actor text,p_session text,p_kind text,p_target text,p_request uuid)
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
  IF prior.kind=p_kind AND prior.target_id=p_target THEN IF public.local_workflow_claim_current(p_actor,p_session,p_kind,p_target) THEN RETURN QUERY SELECT 'replayed'::text,p_target;ELSE RETURN QUERY SELECT 'forbidden'::text,NULL::text;END IF;ELSE RETURN QUERY SELECT 'conflict'::text,NULL::text;END IF;RETURN;
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
 -- All assignment/event/receipt FK waits have completed; the volatile helper
 -- rechecks current identity, policy, nested capability and exact assignment.
 IF NOT public.local_workflow_claim_current(p_actor,p_session,p_kind,p_target) THEN RAISE EXCEPTION 'Current local claim authority unavailable' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT 'saved'::text,p_target;
EXCEPTION WHEN invalid_text_representation THEN RETURN QUERY SELECT 'invalid'::text,NULL::text;
END; $$;
