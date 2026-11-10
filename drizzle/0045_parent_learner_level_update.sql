CREATE TABLE "parent_learner_level_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"old_level" text NOT NULL,
	"new_level" text NOT NULL,
	"transaction_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_level_event_levels" CHECK ("parent_learner_level_events"."old_level" IN ('elementary','middle_school','high_school','college_support') AND "parent_learner_level_events"."new_level" IN ('elementary','middle_school','high_school','college_support') AND "parent_learner_level_events"."old_level" <> "parent_learner_level_events"."new_level")
);
--> statement-breakpoint
ALTER TABLE "parent_learner_level_events" ADD CONSTRAINT "parent_learner_level_events_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learner_level_events" ADD CONSTRAINT "parent_learner_level_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_level_event_learner_idx" ON "parent_learner_level_events" USING btree ("learner_id","created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_learner_admission_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Admission records are retained.' USING ERRCODE='55000';END IF;
 IF TG_TABLE_NAME IN('learner_admission_events','learner_admission_policies','learner_guardian_attestations','learner_independent_attestations','parent_learner_level_events') THEN
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
   OR(OLD.source IN ('synthetic_readiness','local_operation') AND (current_user='learli_app' OR (NEW.level<>OLD.level AND NOT (
    OLD.source='local_operation' AND OLD.management='guardian' AND EXISTS (
      SELECT 1 FROM public.parent_learner_level_events ev WHERE ev.learner_id=OLD.id
        AND ev.old_level=OLD.level AND ev.new_level=NEW.level AND ev.transaction_id=txid_current()
    )
  ))))
  THEN RAISE EXCEPTION 'Learner provenance is protected.' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='guardian_learner_links' THEN
  IF(OLD.guardian_user_id,OLD.learner_id,OLD.management,OLD.source) IS DISTINCT FROM(NEW.guardian_user_id,NEW.learner_id,NEW.management,NEW.source)
  THEN RAISE EXCEPTION 'Guardian provenance is protected.' USING ERRCODE='55000';END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER parent_level_events_immutable BEFORE UPDATE OR DELETE ON public.parent_learner_level_events
FOR EACH ROW EXECUTE FUNCTION public.protect_learner_admission_records();
--> statement-breakpoint
CREATE FUNCTION public.update_parent_learner_level(p_actor text,p_session text,p_learner uuid,p_policy uuid,p_expected text,p_level text,p_name text,p_zone text,p_grade_set boolean,p_grade integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE admission uuid; previous public.learner_profiles%ROWTYPE; next_grade integer; affected_tutor uuid;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RETURN 'invalid'; END IF;
 SELECT a.id INTO admission FROM public.learner_admissions a WHERE a.learner_id=p_learner AND a.policy_id=p_policy;
 IF admission IS NULL THEN RETURN 'forbidden'; END IF;
 PERFORM public.lock_learner_admission(p_actor,p_session,admission);
 SELECT * INTO previous FROM public.learner_profiles WHERE id=p_learner;
 IF previous.id IS NULL OR previous.source<>'local_operation' OR previous.management<>'guardian' OR previous.user_id IS NOT NULL
   OR NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RETURN 'forbidden'; END IF;
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
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,p_policy) THEN RAISE EXCEPTION 'Admission authority changed.' USING ERRCODE='42501'; END IF;
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
REVOKE ALL ON FUNCTION public.update_parent_learner_level(text,text,uuid,uuid,text,text,text,text,boolean,integer) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.guard_parent_booking_level() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE management text;
BEGIN
 IF NEW.source='local_operation' AND NEW.state IN ('provisional','confirmed') AND NEW.start_at_utc>clock_timestamp() THEN
  SELECT l.management INTO management FROM public.learner_profiles l WHERE l.id=NEW.learner_id FOR SHARE;
  IF management='guardian' AND NOT public.booking_workflow_tutor_current(NEW.tutor_id,NEW.learner_id,NEW.subject_id,true) THEN
   RAISE EXCEPTION 'Current learner level is not supported.' USING ERRCODE='P4091';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_parent_booking_level() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER require_parent_booking_level BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_parent_booking_level();
