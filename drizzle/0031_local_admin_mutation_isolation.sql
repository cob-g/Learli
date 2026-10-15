-- Local administrative mutations require fresh READ COMMITTED command snapshots after waits.
CREATE OR REPLACE FUNCTION public.change_local_account_access(
  p_actor text, p_session text, p_target text, p_expected integer,
  p_next text, p_reason text, p_key uuid
) RETURNS TABLE(outcome text, revision integer, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_revision integer;
  v_status text;
  v_previous public.account_restriction_events%ROWTYPE;
  v_now timestamptz;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Local account access changes require read committed' USING ERRCODE='25001';END IF;
  IF p_expected IS NULL OR p_expected < 0 OR p_expected >= 2147483647 OR p_key IS NULL
     OR NOT ((p_next = 'suspended' AND p_reason IN ('local_access_test','local_review_test'))
          OR (p_next = 'active' AND p_reason = 'local_restore_test')) IS TRUE THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp()
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT t.revision INTO v_revision FROM public.account_restriction_targets t
    WHERE t.user_id=p_target AND t.source='local_fixture' FOR UPDATE;
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
    WHERE g.staff_user_id=p_actor AND g.target_user_id=p_target AND g.status='authorized' FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public."user" u WHERE u.id=p_target AND u.email LIKE '%.test')
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_target AND r.role='admin') THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  v_now := clock_timestamp();
  -- Fresh READ COMMITTED command snapshot after every domain/grant wait.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
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
  RETURN QUERY SELECT 'saved'::text, v_revision+1, p_next;
END;
$$;
--> statement-breakpoint
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
  SELECT c.* INTO v_case FROM public.support_cases c WHERE c.id=p_case AND c.source='local_synthetic' FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('support-assignment-request:' || p_actor || ':' || p_key::text,0));
  v_now:=clock_timestamp();
  -- Separate commands acquire fresh READ COMMITTED snapshots after all domain waits.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now AND u.email_verified
      AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' AND a.status='active'
      AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
  IF p_actor=v_case.requester_user_id OR NOT EXISTS (
    SELECT 1 FROM public.support_dispatch_grants g WHERE g.dispatcher_user_id=p_actor AND g.case_id=p_case AND g.source='local_fixture' AND g.status='authorized'
  ) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  IF p_reviewer IN (p_actor,v_case.requester_user_id) OR NOT EXISTS (
    SELECT 1 FROM public.support_reviewer_choices choice JOIN public.support_reviewers r ON r.user_id=choice.reviewer_user_id
    JOIN public."user" u ON u.id=r.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE choice.case_id=p_case AND choice.reviewer_user_id=p_reviewer AND choice.source='local_fixture' AND choice.status='authorized'
      AND r.source='local_fixture' AND r.status='authorized' AND u.email_verified AND a.status='active'
      AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
      AND EXISTS(SELECT 1 FROM public.user_roles g WHERE g.user_id=u.id AND g.role='admin')
  ) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
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
  RETURN QUERY SELECT 'saved'::text,v_case.revision+1;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.review_local_tutor_application(p_actor text,p_session text,p_tutor uuid,p_action text)
RETURNS TABLE(outcome text,status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t public.tutor_profiles%ROWTYPE; v_from text;v_to text;v_audit text;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Local tutor application reviews require read committed' USING ERRCODE='25001';END IF;
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
