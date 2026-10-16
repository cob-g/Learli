ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'parent_role.self_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated', 'subject.renamed'));
--> statement-breakpoint
-- This grants only an account workspace, never guardian authority or admin access.
-- Keep identity lock order consistent with account/session mutations. Recheck the
-- current session after acquiring locks; an earlier authentication read can expire.
CREATE FUNCTION public.enroll_parent_workspace(p_actor text,p_session text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_granted boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
  RAISE EXCEPTION 'Parent enrollment requires read committed' USING ERRCODE='25001';
 END IF;
 IF p_actor IS NULL OR p_session IS NULL THEN RETURN 'forbidden'; END IF;
 PERFORM u.id FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 IF NOT FOUND THEN RETURN 'forbidden'; END IF;
 PERFORM a.user_id FROM public.user_access a WHERE a.user_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RETURN 'forbidden'; END IF;
 PERFORM s.id FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RETURN 'forbidden'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public."user" u JOIN public.user_access a ON a.user_id=u.id
  JOIN public.session s ON s.user_id=u.id AND s.id=p_session
  WHERE u.id=p_actor AND u.email_verified AND a.status='active'
    AND s.expires_at>clock_timestamp()
 ) THEN RETURN 'forbidden'; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(p_actor,'parent')
 ON CONFLICT DO NOTHING RETURNING true INTO v_granted;
 IF v_granted IS TRUE THEN
  INSERT INTO public.audit_events(actor_user_id,target_user_id,action)
  VALUES(p_actor,p_actor,'parent_role.self_granted');
  RETURN 'granted';
 END IF;
 RETURN 'existing';
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enroll_parent_workspace(text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.enroll_parent_workspace(text,text) TO learli_app;
