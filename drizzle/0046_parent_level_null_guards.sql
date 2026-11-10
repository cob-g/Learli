-- Explicitly deny unknown authorization and tutor eligibility results.
CREATE OR REPLACE FUNCTION public.update_parent_learner_level(p_actor text,p_session text,p_learner uuid,p_policy uuid,p_expected text,p_level text,p_name text,p_zone text,p_grade_set boolean,p_grade integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE admission uuid; previous public.learner_profiles%ROWTYPE; next_grade integer; affected_tutor uuid;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RETURN 'invalid'; END IF;
 SELECT a.id INTO admission FROM public.learner_admissions a WHERE a.learner_id=p_learner AND a.policy_id=p_policy;
 IF admission IS NULL THEN RETURN 'forbidden'; END IF;
 PERFORM public.lock_learner_admission(p_actor,p_session,admission);
 SELECT * INTO previous FROM public.learner_profiles WHERE id=p_learner;
 IF previous.id IS NULL OR previous.source<>'local_operation' OR previous.management<>'guardian' OR previous.user_id IS NOT NULL
   OR public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) IS NOT TRUE THEN RETURN 'forbidden'; END IF;
 IF p_expected IS NULL OR previous.level<>p_expected THEN RETURN 'stale'; END IF;
 IF p_grade_set IS NULL OR p_level IS NULL OR p_level NOT IN ('elementary','middle_school','high_school','college_support')
   OR p_name IS NULL OR p_name<>btrim(p_name) OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
   OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
   OR NOT(p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$') THEN RETURN 'invalid'; END IF;
 next_grade:=CASE WHEN p_grade_set THEN p_grade ELSE previous.grade END;
 IF next_grade IS NOT NULL AND (next_grade NOT BETWEEN 1 AND 12 OR p_level='college_support') THEN RETURN 'invalid'; END IF;
 IF previous.level<>p_level THEN
  INSERT INTO public.parent_learner_level_events(learner_id,actor_user_id,old_level,new_level,transaction_id)
  VALUES(p_learner,p_actor,previous.level,p_level,txid_current());
 END IF;
 UPDATE public.learner_profiles SET display_name=p_name,timezone=p_zone,grade=next_grade,level=p_level,updated_at=clock_timestamp() WHERE id=p_learner;
 IF public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) IS NOT TRUE THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501'; END IF;
 IF previous.level<>p_level THEN
  PERFORM pg_catalog.pg_notify('learli_student_booking',p_learner::text);
  FOR affected_tutor IN SELECT DISTINCT b.tutor_id FROM public.bookings b WHERE b.learner_id=p_learner AND b.source='local_operation' LOOP
   PERFORM pg_catalog.pg_notify('learli_tutor_booking',affected_tutor::text);
  END LOOP;
 END IF;
 RETURN 'saved';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_parent_booking_level() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE management text;
BEGIN
 IF NEW.source='local_operation' AND NEW.state IN ('provisional','confirmed') AND NEW.start_at_utc>clock_timestamp() THEN
  SELECT l.management INTO management FROM public.learner_profiles l WHERE l.id=NEW.learner_id FOR SHARE;
  IF management='guardian' AND public.booking_workflow_tutor_current(NEW.tutor_id,NEW.learner_id,NEW.subject_id,true) IS NOT TRUE THEN
   RAISE EXCEPTION 'Current learner level is not supported.' USING ERRCODE='P4091';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
