-- Private policy horizon. NULL means no currently eligible screening.
-- Infinity is reserved for the existing local-demo path, which has no checks.
CREATE FUNCTION public.tutor_screening_valid_through(p_tutor uuid, p_scope text)
RETURNS timestamp with time zone LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT CASE WHEN p_scope='local_demo' THEN
   CASE WHEN public.has_current_tutor_screening(p_tutor,p_scope) THEN 'infinity'::timestamptz END
 ELSE (
  SELECT LEAST(COALESCE(p.valid_until,'infinity'::timestamptz),(
    SELECT min(ck.expires_at)
    FROM public.tutor_screening_checks ck
    JOIN public.tutor_screening_decision_checks dc ON dc.check_id=ck.id AND dc.decision_id=d.id AND dc.check_code=ck.check_code
    WHERE ck.tutor_id=c.tutor_id AND ck.provenance=c.provenance
      AND ck.policy_version=c.policy_version AND ck.round=c.round
      AND ck.check_code=ANY(p.required_check_codes) AND ck.outcome='passed'
      AND NOT EXISTS(SELECT 1 FROM public.tutor_screening_checks newer
        WHERE newer.tutor_id=ck.tutor_id AND newer.round=ck.round
          AND newer.check_code=ck.check_code AND newer.revision>ck.revision)
  ))
  FROM public.tutor_screening_cases c
  JOIN public.tutor_screening_policies p ON p.provenance=c.provenance AND p.version=c.policy_version
  JOIN public.tutor_screening_decisions d ON d.id=c.current_decision_id
  WHERE c.tutor_id=p_tutor AND c.provenance=p_scope
    AND public.has_current_tutor_screening(p_tutor,p_scope)
 ) END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.tutor_screening_valid_through(uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.tutor_screening_valid_through(uuid,text) TO learli_app;
--> statement-breakpoint
-- New future policy bookings require current evidence through the lesson end.
-- Existing rows and historical fixture records are not rewritten.
CREATE FUNCTION public.require_booking_screening_coverage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.source IN ('synthetic_readiness','local_operation')
   AND NEW.state IN ('provisional','confirmed') AND NEW.start_at_utc>clock_timestamp() THEN
  -- Match the screening mutation lock order, including for direct inserts.
  PERFORM 1 FROM public.tutor_profiles WHERE id=NEW.tutor_id FOR UPDATE;
  PERFORM 1 FROM public.tutor_screening_policy_heads WHERE provenance=NEW.source FOR SHARE;
  IF COALESCE(public.tutor_screening_valid_through(NEW.tutor_id,NEW.source)>NEW.end_at_utc,false) IS NOT TRUE THEN
   RAISE EXCEPTION 'Tutor screening does not cover this lesson' USING ERRCODE='P4090';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.require_booking_screening_coverage() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER require_booking_screening_coverage BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.require_booking_screening_coverage();
--> statement-breakpoint
-- Opaque learner UUID only; notification is delivered only on transaction commit.
CREATE FUNCTION public.notify_student_booking_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE learner uuid;
BEGIN
 IF TG_TABLE_NAME='bookings' THEN
  IF TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state OR OLD.start_at_utc IS DISTINCT FROM NEW.start_at_utc OR OLD.end_at_utc IS DISTINCT FROM NEW.end_at_utc THEN
   learner:=NEW.learner_id;
  END IF;
 ELSE
  SELECT b.learner_id INTO learner FROM public.bookings b WHERE b.id=NEW.booking_id;
 END IF;
 IF learner IS NOT NULL AND EXISTS (SELECT 1 FROM public.learner_profiles l WHERE l.id=learner AND l.management='self') THEN
  PERFORM pg_catalog.pg_notify('learli_student_booking',learner::text);
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.notify_student_booking_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER notify_student_booking_insert AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_student_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_student_booking_update AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_student_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_student_meeting_insert AFTER INSERT ON public.booking_meeting_links
FOR EACH ROW EXECUTE FUNCTION public.notify_student_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_student_meeting_update AFTER UPDATE ON public.booking_meeting_links
FOR EACH ROW EXECUTE FUNCTION public.notify_student_booking_change();
