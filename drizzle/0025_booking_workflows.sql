CREATE TABLE public.booking_workflow_policies(id uuid PRIMARY KEY,version text NOT NULL,reference text NOT NULL,content_digest text NOT NULL,terms jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT booking_workflow_policy_shape CHECK(version='synthetic-booking-v1' AND reference='synthetic:booking:v1' AND content_digest ~ '^[a-f0-9]{64}$'));
--> statement-breakpoint
CREATE TABLE public.booking_workflow_policy_head(source text PRIMARY KEY CHECK(source='synthetic_readiness'),policy_id uuid NOT NULL REFERENCES public.booking_workflow_policies(id) ON DELETE RESTRICT,enabled boolean NOT NULL DEFAULT false);
--> statement-breakpoint
CREATE TABLE public.booking_workflow_grants(logical_booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,actor_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,action text NOT NULL,active boolean NOT NULL DEFAULT false,valid_until timestamptz NOT NULL,reference text NOT NULL,PRIMARY KEY(logical_booking_id,actor_user_id,action),CONSTRAINT booking_workflow_grant_shape CHECK(action IN ('confirm','complete','no_show') AND isfinite(valid_until) AND reference ~ '^synthetic:[0-9a-f-]{36}$'));
--> statement-breakpoint
ALTER TABLE public.bookings ADD COLUMN workflow_policy_id uuid REFERENCES public.booking_workflow_policies(id) ON DELETE RESTRICT, ADD COLUMN admission_policy_id uuid REFERENCES public.learner_admission_policies(id) ON DELETE RESTRICT, ADD COLUMN workflow_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.bookings DROP CONSTRAINT bookings_local_source, DROP CONSTRAINT bookings_demo_state, DROP CONSTRAINT bookings_tutor_no_overlap;
--> statement-breakpoint
ALTER TABLE public.bookings ADD CONSTRAINT bookings_local_source CHECK(source IN('local_simulation','synthetic_readiness')),ADD CONSTRAINT bookings_demo_state CHECK((source='local_simulation' AND state IN('demo_reserved','demo_expired','demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND workflow_policy_id IS NULL AND admission_policy_id IS NULL AND workflow_revision=0) OR (source='synthetic_readiness' AND state IN('provisional','confirmed','completed','no_show','expired','cancelled','replaced') AND workflow_policy_id IS NOT NULL AND admission_policy_id IS NOT NULL AND workflow_revision>=0)), ADD CONSTRAINT bookings_tutor_no_overlap EXCLUDE USING gist(tutor_id WITH =,tstzrange(start_at_utc,end_at_utc,'[)') WITH &&) WHERE(state IN('demo_reserved','demo_confirmed','provisional','confirmed'));
--> statement-breakpoint
DROP INDEX public.bookings_logical_live_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX bookings_logical_live_unique ON public.bookings(logical_booking_id) WHERE(state IN('demo_reserved','demo_confirmed','provisional','confirmed'));
--> statement-breakpoint
ALTER TABLE public.booking_lifecycle_events ADD COLUMN workflow_policy_id uuid REFERENCES public.booking_workflow_policies(id) ON DELETE RESTRICT,ADD COLUMN workflow_revision integer,ADD COLUMN reason_code text;
--> statement-breakpoint
ALTER TABLE public.booking_lifecycle_events DROP CONSTRAINT booking_lifecycle_events_event_check,DROP CONSTRAINT booking_lifecycle_shape;
--> statement-breakpoint
ALTER TABLE public.booking_lifecycle_events ADD CONSTRAINT booking_lifecycle_events_event_check CHECK((workflow_policy_id IS NULL AND event IN('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed') AND workflow_revision IS NULL AND reason_code IS NULL) OR (workflow_policy_id IS NOT NULL AND event IN('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled') AND workflow_revision>=0 AND reason_code IN('synthetic_request','synthetic_prerequisite_review','synthetic_completed','synthetic_no_show','synthetic_participant_change','synthetic_expiry'))), ADD CONSTRAINT booking_lifecycle_shape CHECK((event IN('demo_rescheduled','workflow_rescheduled') AND replacement_booking_id IS NOT NULL) OR (event NOT IN('demo_rescheduled','workflow_rescheduled') AND replacement_booking_id IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX booking_workflow_event_revision ON public.booking_lifecycle_events(booking_id,workflow_revision) WHERE workflow_policy_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_demo_booking_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE prior public.bookings;
BEGIN
 IF NEW.source='synthetic_readiness' THEN
 NEW.logical_booking_id:=coalesce(NEW.logical_booking_id,NEW.id);
 IF current_user='learli_app' THEN RAISE EXCEPTION 'Readiness writes require the scoped function' USING ERRCODE='42501'; END IF;
 IF NEW.replaces_booking_id IS NOT NULL THEN
 SELECT * INTO prior FROM public.bookings WHERE id=NEW.replaces_booking_id FOR NO KEY UPDATE;
 IF prior.id IS NULL OR prior.state<>'replaced' OR NEW.logical_booking_id<>prior.logical_booking_id OR NEW.revision<>prior.revision+1 OR NEW.workflow_revision<>0 OR
 (NEW.tutor_id,NEW.learner_id,NEW.subject_id,NEW.booked_by_user_id,NEW.source,NEW.expires_at,NEW.workflow_policy_id,NEW.admission_policy_id) IS DISTINCT FROM (prior.tutor_id,prior.learner_id,prior.subject_id,prior.booked_by_user_id,prior.source,prior.expires_at,prior.workflow_policy_id,prior.admission_policy_id)
 THEN RAISE EXCEPTION 'Readiness replacement unavailable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
 END IF;
 NEW.logical_booking_id := coalesce(NEW.logical_booking_id,NEW.id);
 IF NEW.replaces_booking_id IS NOT NULL THEN
  SELECT * INTO prior FROM public.bookings WHERE id=NEW.replaces_booking_id FOR NO KEY UPDATE;
  IF prior.id IS NULL OR prior.state<>'demo_replaced' OR NEW.logical_booking_id<>prior.logical_booking_id OR NEW.revision<>prior.revision+1 OR
    (NEW.tutor_id,NEW.learner_id,NEW.subject_id,NEW.booked_by_user_id,NEW.source,NEW.expires_at) IS DISTINCT FROM (prior.tutor_id,prior.learner_id,prior.subject_id,prior.booked_by_user_id,prior.source,prior.expires_at) OR NEW.created_at>=NEW.expires_at THEN
   RAISE EXCEPTION 'Synthetic replacement is unavailable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF current_user='learli_app' AND NEW.state<>'demo_reserved' THEN
  RAISE EXCEPTION 'Fixture promotion is owner controlled' USING ERRCODE='23514';
 END IF;
 IF NEW.state='demo_completed' AND NEW.end_at_utc>clock_timestamp() THEN
  RAISE EXCEPTION 'Historical fixture end required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.preserve_demo_booking() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF OLD.source='synthetic_readiness' THEN
 IF current_user='learli_app' THEN RAISE EXCEPTION 'Readiness writes require the scoped function' USING ERRCODE='42501';END IF;
 IF (to_jsonb(NEW)-'state'-'workflow_revision') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'workflow_revision') OR NEW.workflow_revision<>OLD.workflow_revision+1 OR NOT (
 (OLD.state='provisional' AND NEW.state='expired' AND OLD.expires_at<=clock_timestamp()) OR
 (OLD.state='provisional' AND NEW.state='confirmed' AND OLD.expires_at>clock_timestamp()) OR
 (OLD.state IN('provisional','confirmed') AND NEW.state IN('cancelled','replaced') AND OLD.start_at_utc>clock_timestamp() AND (OLD.state='confirmed' OR OLD.expires_at>clock_timestamp())) OR
 (OLD.state='confirmed' AND NEW.state IN('completed','no_show') AND OLD.end_at_utc<=clock_timestamp()))
 THEN RAISE EXCEPTION 'Readiness transition unavailable' USING ERRCODE='23514';END IF; RETURN NEW; END IF;
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') THEN
  RAISE EXCEPTION 'Synthetic booking fields are immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
  (OLD.state IN('demo_reserved','demo_confirmed') AND NEW.state='demo_expired' AND OLD.expires_at<=clock_timestamp()) OR
  (OLD.state IN('demo_reserved','demo_confirmed') AND NEW.state IN('demo_cancelled','demo_replaced') AND OLD.expires_at>clock_timestamp() AND OLD.start_at_utc>clock_timestamp()) OR
  (current_user<>'learli_app' AND OLD.state='demo_reserved' AND NEW.state='demo_confirmed') OR
  (current_user<>'learli_app' AND OLD.state='demo_confirmed' AND NEW.state='demo_completed' AND OLD.end_at_utc<=clock_timestamp())
 ) THEN RAISE EXCEPTION 'Synthetic booking transition is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE b public.bookings; replacement public.bookings;
BEGIN
 IF NEW.workflow_policy_id IS NOT NULL THEN
 IF TG_OP<>'INSERT' OR current_user='learli_app' THEN RAISE EXCEPTION 'Readiness history is scoped and immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;
 IF b.id IS NULL OR b.source<>'synthetic_readiness' OR b.logical_booking_id<>NEW.logical_booking_id OR b.workflow_policy_id<>NEW.workflow_policy_id OR b.workflow_revision<>NEW.workflow_revision OR NEW.event<>(CASE b.state WHEN 'replaced' THEN 'workflow_rescheduled' ELSE 'workflow_'||b.state END)
 THEN RAISE EXCEPTION 'Readiness history provenance unavailable' USING ERRCODE='23514';END IF;
 IF NEW.event='workflow_rescheduled' THEN SELECT * INTO replacement FROM public.bookings WHERE id=NEW.replacement_booking_id;
 IF replacement.id IS NULL OR replacement.replaces_booking_id<>b.id OR replacement.logical_booking_id<>b.logical_booking_id THEN RAISE EXCEPTION 'Readiness replacement history unavailable' USING ERRCODE='23514';END IF;END IF;
 RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Synthetic history is immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;
 IF b.logical_booking_id<>NEW.logical_booking_id OR
   (NEW.event='demo_cancelled' AND b.state<>'demo_cancelled') OR
   (NEW.event='demo_rescheduled' AND b.state<>'demo_replaced') OR
   (NEW.event='demo_confirmed' AND (current_user='learli_app' OR b.state NOT IN('demo_confirmed','demo_completed'))) OR
   (NEW.event='demo_completed' AND (current_user='learli_app' OR b.state<>'demo_completed' OR b.end_at_utc>clock_timestamp())) THEN
  RAISE EXCEPTION 'Synthetic event provenance unavailable' USING ERRCODE='23514';
 END IF;
 IF NEW.event='demo_rescheduled' THEN
  SELECT * INTO replacement FROM public.bookings WHERE id=NEW.replacement_booking_id;
  IF replacement.id IS NULL OR replacement.replaces_booking_id<>b.id OR replacement.logical_booking_id<>b.logical_booking_id THEN
   RAISE EXCEPTION 'Synthetic replacement event unavailable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.require_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.source='synthetic_readiness' THEN
 IF NOT EXISTS(SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=NEW.id AND e.workflow_revision=NEW.workflow_revision AND e.workflow_policy_id=NEW.workflow_policy_id AND e.event=CASE NEW.state WHEN 'replaced' THEN 'workflow_rescheduled' ELSE 'workflow_'||NEW.state END)
 THEN RAISE EXCEPTION 'Readiness transition requires history' USING ERRCODE='23514'; END IF;RETURN NULL;END IF;
 IF TG_OP='INSERT' THEN RETURN NULL;END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NEW.state IN('demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND NOT EXISTS (
  SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=NEW.id AND e.event=CASE NEW.state WHEN 'demo_replaced' THEN 'demo_rescheduled' ELSE NEW.state END
 ) THEN RAISE EXCEPTION 'Synthetic transition requires history' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER require_booking_workflow_creation AFTER INSERT ON public.bookings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_booking_lifecycle_event();
--> statement-breakpoint
CREATE FUNCTION public.preserve_booking_workflow_policy() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Booking policy receipts are immutable' USING ERRCODE='23514'; END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_booking_workflow_policy BEFORE UPDATE OR DELETE ON public.booking_workflow_policies FOR EACH ROW EXECUTE FUNCTION public.preserve_booking_workflow_policy();
--> statement-breakpoint
CREATE FUNCTION public.booking_workflow_policy_current(p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.booking_workflow_policy_head h JOIN public.booking_workflow_policies p ON p.id=h.policy_id WHERE h.source='synthetic_readiness' AND h.enabled AND p.id=p_policy AND p.terms->>'authority'='synthetic_test' AND p.terms->>'source'='synthetic_readiness' AND p.terms->>'version'=p.version AND p.terms->>'reference'=p.reference AND p.terms->>'contentDigest'=p.content_digest AND p.terms->>'policyId'=p.id::text AND p.terms->>'durationMinutes'='60' AND p.terms->>'stepMinutes'='30' AND p.terms->>'noticeMinutes'='60' AND p.terms->>'horizonDays'='14' AND p.terms->>'provisionalMinutes'='10' AND p.terms->>'cancelCutoffMinutes'='60' AND p.terms->>'moveCutoffMinutes'='60' AND p.terms->>'confirmationPrerequisite'='synthetic_prerequisite_review' AND p.terms->>'confirmationActor'='assigned_mfa_admin' AND p.terms->>'outcomeActor'='assigned_mfa_admin' AND p.terms->>'disputePath'='/support' AND p.terms->>'meetingAccess'='confirmed_until_end'); $$;
--> statement-breakpoint
CREATE FUNCTION public.booking_workflow_slot_valid(p_tutor uuid,p_start timestamptz,p_end timestamptz,p_now timestamptz,p_exclude uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT isfinite(p_start) AND isfinite(p_end) AND p_start>=p_now+interval '60 minutes' AND p_start<p_now+interval '14 days' AND p_end=p_start+interval '60 minutes' AND date_trunc('minute',p_start)=p_start
 AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=p_tutor AND NOT EXISTS(
 SELECT 1 FROM generate_series(p_start,p_end-interval '1 minute',interval '1 minute') tick WHERE NOT EXISTS(
 SELECT 1 FROM public.tutor_availability a WHERE a.tutor_id=p_tutor AND
 ((a.iso_weekday=extract(isodow FROM tick AT TIME ZONE t.timezone) AND extract(hour FROM tick AT TIME ZONE t.timezone)*60+extract(minute FROM tick AT TIME ZONE t.timezone)>=a.start_minute AND extract(hour FROM tick AT TIME ZONE t.timezone)*60+extract(minute FROM tick AT TIME ZONE t.timezone)<a.end_minute) OR
 (a.end_minute>1440 AND ((a.iso_weekday%7)+1)=extract(isodow FROM tick AT TIME ZONE t.timezone) AND extract(hour FROM tick AT TIME ZONE t.timezone)*60+extract(minute FROM tick AT TIME ZONE t.timezone)<a.end_minute-1440)))))

 -- Match generateSlots: restart a 30-minute grid at each window/date start
 -- and again at a UTC-offset change inside the window. Inspect four days
 -- before this minute: every <=24h wall window/date and offset is inside it.
 AND EXISTS(WITH zone AS (SELECT timezone FROM public.tutor_profiles WHERE id=p_tutor),
 samples AS MATERIALIZED (SELECT tick,extract(epoch FROM ((tick AT TIME ZONE z.timezone)-(tick AT TIME ZONE 'UTC'))) AS off FROM zone z CROSS JOIN generate_series(p_start-interval '4 days',p_start,interval '1 minute') tick),
 transitions AS (SELECT max(tick) AS anchor FROM (SELECT tick,off,lag(off) OVER(ORDER BY tick) AS prior FROM samples) q WHERE prior IS NOT NULL AND off<>prior),
 days AS (SELECT z.timezone,((p_start AT TIME ZONE z.timezone)::date+i)::timestamp AS midnight,extract(epoch FROM ((p_start AT TIME ZONE z.timezone)-(p_start AT TIME ZONE 'UTC'))) AS off FROM zone z CROSS JOIN generate_series(-2,2) i),
 anchors AS (SELECT greatest(((d.midnight+make_interval(mins=>a.start_minute)-make_interval(secs=>d.off::double precision)) AT TIME ZONE 'UTC'),coalesce(t.anchor,'-infinity'::timestamptz)) AS anchor FROM days d JOIN public.tutor_availability a ON a.tutor_id=p_tutor AND a.iso_weekday=extract(isodow FROM d.midnight) CROSS JOIN transitions t WHERE (p_start AT TIME ZONE d.timezone)>=d.midnight+make_interval(mins=>a.start_minute) AND (p_start AT TIME ZONE d.timezone)<d.midnight+make_interval(mins=>a.end_minute))
 SELECT 1 FROM anchors WHERE p_start>=anchor AND mod(extract(epoch FROM(p_start-anchor)),1800)=0)
 AND NOT EXISTS(SELECT 1 FROM public.tutor_availability_exceptions x WHERE x.tutor_id=p_tutor AND x.start_at_utc<p_end AND x.end_at_utc>p_start)
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.tutor_id=p_tutor AND (p_exclude IS NULL OR b.id<>p_exclude) AND b.start_at_utc<p_end AND b.end_at_utc>p_start AND (b.state IN('demo_reserved','demo_confirmed','provisional','confirmed')) AND (b.state='confirmed' OR b.expires_at>p_now)); $$;
--> statement-breakpoint
CREATE FUNCTION public.booking_workflow_tutor_current(p_tutor uuid,p_learner uuid,p_subject uuid,p_offering boolean) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.has_current_tutor_screening(p_tutor,'synthetic_readiness') AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public."user" u ON u.id=t.user_id JOIN public.user_access a ON a.user_id=u.id AND a.status='active' WHERE t.id=p_tutor AND t.review_status='approved' AND u.email_verified AND u.email LIKE '%.test' AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tutor') AND (NOT p_offering OR EXISTS(SELECT 1 FROM public.tutor_subjects ts JOIN public.subjects s ON s.id=ts.subject_id AND s.is_active JOIN public.learner_profiles l ON l.id=p_learner WHERE ts.tutor_id=t.id AND s.id=p_subject AND l.level=ANY(ts.levels)))); $$;
--> statement-breakpoint
CREATE FUNCTION public.expire_policy_bookings(p_tutor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;n timestamptz;
BEGIN
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 n:=clock_timestamp();
 FOR b IN SELECT * FROM public.bookings WHERE tutor_id=p_tutor AND source='synthetic_readiness' AND state='provisional' AND expires_at<=n FOR NO KEY UPDATE LOOP
 UPDATE public.bookings SET state='expired',workflow_revision=workflow_revision+1 WHERE id=b.id;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES(b.logical_booking_id,b.id,b.booked_by_user_id,'workflow_expired',gen_random_uuid(),b.request_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,'synthetic_expiry');END LOOP;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.assert_booking_workflow_authority(p_actor text,p_session text,p_booking uuid,p_action text,p_policy uuid,p_original_state text,p_expiry timestamptz,p_start timestamptz,p_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;n timestamptz;family boolean;tutor boolean;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_policy IS NULL OR p_original_state IS NULL OR p_expiry IS NULL OR p_start IS NULL OR p_end IS NULL OR NOT (p_action IN('create','confirm','cancel','reschedule','complete','no_show')) IS TRUE OR public.admission_identity(p_actor,p_session) IS NOT TRUE THEN RAISE EXCEPTION 'Workflow identity or action unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 n:=clock_timestamp();
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.admission_identity(p_actor,p_session) AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false);
 IF b.id IS NULL OR b.workflow_policy_id IS DISTINCT FROM p_policy OR NOT public.booking_workflow_policy_current(p_policy) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
 OR (p_action IN('create','cancel','reschedule') AND NOT(family OR (p_action<>'create' AND tutor)))
 OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action))
 OR (p_action IN('create','confirm','reschedule','complete','no_show') AND NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action IN('create','confirm','reschedule')))
 THEN RAISE EXCEPTION 'Workflow authority changed after writes' USING ERRCODE='42501';END IF;
 IF p_action IN('create','reschedule') AND public.booking_workflow_slot_valid(b.tutor_id,b.start_at_utc,b.end_at_utc,n,b.id) IS NOT TRUE THEN RAISE EXCEPTION 'Workflow slot changed after writes' USING ERRCODE='P4090';END IF;
 IF (p_original_state='provisional' AND p_expiry<=n) OR (p_action='confirm' AND p_start<=n) OR (p_action IN('cancel','reschedule') AND p_start<=n+interval '60 minutes') OR (p_action IN('complete','no_show') AND p_end>n)
 THEN RAISE EXCEPTION 'Workflow window changed after writes' USING ERRCODE='P4090';END IF;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.create_policy_booking(p_actor text,p_session text,p_key uuid,p_policy uuid,p_learner uuid,p_tutor uuid,p_subject uuid,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;p public.booking_workflow_policies;n timestamptz;e uuid;ap uuid;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_key IS NULL OR p_policy IS NULL OR p_learner IS NULL OR p_tutor IS NULL OR p_subject IS NULL OR p_start IS NULL OR p_end IS NULL OR p_zone IS NULL OR p_fingerprint IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 PERFORM u.id FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=p_policy;
 IF p.id IS NULL OR NOT public.booking_workflow_policy_current(p_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 ap:=(p.terms->>'admissionPolicyId')::uuid;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,ap) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_tutor_current(p_tutor,p_learner,p_subject,true) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO b FROM public.bookings WHERE booked_by_user_id=p_actor AND idempotency_key=p_key;
 IF b.id IS NOT NULL THEN
 IF b.source<>'synthetic_readiness' OR b.request_fingerprint<>p_fingerprint OR b.workflow_policy_id<>p_policy THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT id INTO e FROM public.booking_lifecycle_events WHERE booking_lifecycle_events.booking_id=b.id AND event='workflow_provisional';
 RETURN QUERY SELECT 'replayed'::text,b.id,e;RETURN;END IF;
 n:=clock_timestamp();
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_slot_valid(p_tutor,p_start,p_end,n,NULL) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (SELECT count(*) FROM public.bookings WHERE booked_by_user_id=p_actor AND created_at>n-interval '1 minute')>=20 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM public.expire_policy_bookings(p_tutor);
 -- Legacy expiry materialization is delegated to the established shared service.
 INSERT INTO public.bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES('synthetic_readiness',p_tutor,p_learner,p_actor,p_subject,p_start,p_end,p_zone,p_key,p_fingerprint,'provisional',n,n+interval '10 minutes',p_policy,ap) RETURNING * INTO b;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,p_actor,'workflow_provisional',p_key,p_fingerprint,n,p_policy,0,'synthetic_request') RETURNING id INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,b.id,'create',p_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'created'::text,b.id,e;
END; $$;

--> statement-breakpoint
CREATE FUNCTION public.has_current_booking_beneficiary(p_actor text,p_learner uuid,p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
SELECT EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access x ON x.user_id=u.id AND x.status='active' WHERE u.id=p_actor AND u.email_verified AND u.email LIKE '%.test') AND public.admission_policy_current(p_policy) AND EXISTS(
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
CREATE FUNCTION public.has_booking_workflow_task(p_actor text,p_session text,p_booking uuid,p_action text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.has_admin_assurance(p_actor,p_session,28800) AND EXISTS(SELECT 1 FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id JOIN public.booking_workflow_grants g ON g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=p_actor AND g.action=p_action AND g.active AND g.valid_until>clock_timestamp() WHERE b.id=p_booking AND b.source='synthetic_readiness' AND b.booked_by_user_id<>p_actor AND t.user_id<>p_actor); $$;
--> statement-breakpoint
CREATE FUNCTION public.change_policy_booking(p_actor text,p_session text,p_booking uuid,p_request uuid,p_current_policy uuid,p_revision integer,p_action text,p_reason text,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r public.bookings;e public.booking_lifecycle_events;p public.booking_workflow_policies;n timestamptz;newstate text;family boolean;tutor boolean;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_request IS NULL OR p_current_policy IS NULL OR p_revision IS NULL OR p_revision<0 OR NOT (p_action IN('confirm','complete','no_show','cancel','reschedule')) IS TRUE OR p_reason IS NULL OR p_fingerprint IS NULL OR (p_action='reschedule' AND (p_start IS NULL OR p_end IS NULL OR p_zone IS NULL)) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings prior ON prior.tutor_id=t.id WHERE prior.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR NO KEY UPDATE;
 IF b.id IS NULL OR b.source<>'synthetic_readiness' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_current_policy IS DISTINCT FROM b.workflow_policy_id OR NOT public.booking_workflow_policy_current(p_current_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=b.workflow_policy_id;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.admission_identity(p_actor,p_session) AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id);
 IF (p_action IN('cancel','reschedule') AND NOT(family OR tutor)) OR (p_action IN('confirm','complete','no_show') AND (NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action='confirm'))) OR p_action NOT IN('confirm','complete','no_show','cancel','reschedule') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE actor_user_id=p_actor AND request_id=p_request;
 IF e.id IS NOT NULL THEN
 IF e.booking_id<>b.id OR e.request_fingerprint<>p_fingerprint OR e.workflow_policy_id IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 RETURN QUERY SELECT 'replayed'::text,coalesce(e.replacement_booking_id,b.id),e.id;RETURN;END IF;
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_reason<>(CASE p_action WHEN 'confirm' THEN 'synthetic_prerequisite_review' WHEN 'complete' THEN 'synthetic_completed' WHEN 'no_show' THEN 'synthetic_no_show' ELSE 'synthetic_participant_change' END) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 n:=clock_timestamp();
 IF b.workflow_revision<>p_revision OR EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision) OR b.state NOT IN('provisional','confirmed') OR (b.state='provisional' AND b.expires_at<=n) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (p_action='confirm' AND (b.state<>'provisional' OR b.start_at_utc<=n)) OR (p_action IN('complete','no_show') AND (b.state<>'confirmed' OR b.end_at_utc>n)) OR (p_action IN('cancel','reschedule') AND b.start_at_utc<=n+make_interval(mins=>CASE p_action WHEN 'cancel' THEN (p.terms->>'cancelCutoffMinutes')::integer ELSE (p.terms->>'moveCutoffMinutes')::integer END)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_action='reschedule' AND (NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true) OR NOT public.booking_workflow_slot_valid(b.tutor_id,p_start,p_end,n,b.id) OR p_start=b.start_at_utc OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 newstate:=CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled' WHEN 'reschedule' THEN 'replaced' WHEN 'complete' THEN 'completed' ELSE 'no_show' END;
 -- Last post-lock checks use this connection and current clock; a receipt is no grant.
 IF NOT public.booking_workflow_policy_current(p_current_policy) OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action)) OR (family AND NOT public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id)) OR (tutor AND NOT public.admission_identity(p_actor,p_session)) THEN RAISE EXCEPTION 'Workflow authority changed' USING ERRCODE='42501';END IF;
 UPDATE public.bookings SET state=newstate,workflow_revision=workflow_revision+1 WHERE id=b.id;
 IF p_action='reschedule' THEN
 INSERT INTO public.bookings(logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES(b.logical_booking_id,b.id,b.revision+1,b.source,b.tutor_id,b.learner_id,b.booked_by_user_id,b.subject_id,p_start,p_end,p_zone,gen_random_uuid(),p_fingerprint,b.state,n,b.expires_at,b.workflow_policy_id,b.admission_policy_id) RETURNING * INTO r;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES(r.logical_booking_id,r.id,p_actor,'workflow_'||r.state,gen_random_uuid(),p_fingerprint,n,r.workflow_policy_id,0,CASE r.state WHEN 'confirmed' THEN 'synthetic_prerequisite_review' ELSE 'synthetic_request' END);
 END IF;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,replacement_booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,r.id,p_actor,CASE p_action WHEN 'reschedule' THEN 'workflow_rescheduled' ELSE 'workflow_'||newstate END,p_request,p_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,p_reason) RETURNING * INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,coalesce(r.id,b.id),p_action,p_current_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'saved'::text,coalesce(r.id,b.id),e.id;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.preserve_booking_workflow_policy(),public.booking_workflow_policy_current(uuid),public.booking_workflow_slot_valid(uuid,timestamptz,timestamptz,timestamptz,uuid),public.booking_workflow_tutor_current(uuid,uuid,uuid,boolean),public.expire_policy_bookings(uuid),public.has_current_booking_beneficiary(text,uuid,uuid),public.has_booking_workflow_task(text,text,uuid,text),public.create_policy_booking(text,text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text),public.change_policy_booking(text,text,uuid,uuid,uuid,integer,text,text,timestamptz,timestamptz,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE public.booking_workflow_notice_intents(event_id uuid NOT NULL REFERENCES public.booking_lifecycle_events(id) ON DELETE RESTRICT,recipient_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,kind text NOT NULL CHECK(kind IN('workflow_provisional','workflow_confirmed','workflow_completed','workflow_no_show','workflow_expired','workflow_cancelled','workflow_rescheduled')),created_at timestamptz NOT NULL,PRIMARY KEY(event_id,recipient_user_id,kind));
--> statement-breakpoint
CREATE FUNCTION public.queue_booking_workflow_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.workflow_policy_id IS NOT NULL AND (NEW.event NOT IN('workflow_provisional','workflow_confirmed') OR EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=NEW.booking_id AND b.revision=0)) THEN
 INSERT INTO public.booking_workflow_notice_intents(event_id,recipient_user_id,kind,created_at)
 SELECT NEW.id,x.user_id,NEW.event,NEW.created_at FROM (
 SELECT b.booked_by_user_id AS user_id FROM public.bookings b WHERE b.id=coalesce(NEW.replacement_booking_id,NEW.booking_id)
 UNION SELECT t.user_id FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE b.id=coalesce(NEW.replacement_booking_id,NEW.booking_id)) x ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER queue_booking_workflow_notice AFTER INSERT ON public.booking_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.queue_booking_workflow_notice();
--> statement-breakpoint
CREATE TRIGGER preserve_booking_workflow_notice BEFORE UPDATE OR DELETE ON public.booking_workflow_notice_intents FOR EACH ROW EXECUTE FUNCTION public.preserve_booking_workflow_policy();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.queue_booking_workflow_notice() FROM PUBLIC;

--> statement-breakpoint
REVOKE ALL ON FUNCTION public.assert_booking_workflow_authority(text,text,uuid,text,uuid,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC;

--> statement-breakpoint
ALTER TABLE public.support_cases ADD COLUMN creation_transaction text;
--> statement-breakpoint
CREATE FUNCTION public.stamp_support_creation_transaction() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.creation_transaction:=CASE WHEN NEW.source='synthetic_readiness' THEN pg_current_xact_id()::text ELSE NULL END;
 ELSIF NEW.creation_transaction IS DISTINCT FROM OLD.creation_transaction THEN RAISE EXCEPTION 'Support creation identity is immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER stamp_support_creation_transaction BEFORE INSERT OR UPDATE ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.stamp_support_creation_transaction();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.stamp_support_creation_transaction() FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_support_booking_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Support booking records are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME='support_case_bookings' AND EXISTS(SELECT 1 FROM public.support_cases c WHERE c.id=NEW.case_id AND c.source='synthetic_readiness') THEN
    IF current_user='learli_app' OR NOT EXISTS(SELECT 1 FROM public.support_cases c JOIN public.support_case_events e ON e.case_id=c.id JOIN public.support_case_responses r ON r.case_id=c.id JOIN public.bookings b ON b.id=NEW.booking_id
      WHERE c.id=NEW.case_id AND c.source='synthetic_readiness' AND b.source=c.source AND r.provenance=c.source AND c.status='open' AND c.revision=0 AND e.action='created' AND e.revision=0 AND c.creation_transaction=pg_current_xact_id()::text AND c.xmin=e.xmin) THEN
      RAISE EXCEPTION 'Association requires atomic readiness case creation' USING ERRCODE='23514';END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'support_case_bookings' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.support_cases c JOIN public.support_case_events e ON e.case_id=c.id
      JOIN public.bookings b ON b.id=NEW.booking_id
      WHERE c.id=NEW.case_id AND c.source='local_synthetic' AND c.revision=0 AND c.status='open'
        AND e.action='created' AND e.revision=0 AND b.source='local_simulation'
        AND c.xmin = pg_current_xact_id()::text::xid
        AND e.xmin = pg_current_xact_id()::text::xid
    ) THEN
      RAISE EXCEPTION 'Association requires atomic case creation' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.support_case_bookings l WHERE l.case_id=NEW.case_id AND l.booking_id=NEW.booking_id) THEN
    RAISE EXCEPTION 'Audit association mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.booking_workflow_participant(p_actor text,p_session text,p_booking uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.admission_identity(p_actor,p_session) AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=p_booking AND b.source='synthetic_readiness' AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND (public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id) OR (EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor AND t.review_status='approved') AND public.has_current_tutor_screening(b.tutor_id,'synthetic_readiness')))); $$;
--> statement-breakpoint
CREATE FUNCTION public.create_booking_workflow_dispute(p_actor text,p_session text,p_booking uuid,p_key uuid,p_response_version text,p_category text,p_subject text,p_body text) RETURNS TABLE(outcome text,case_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r record;prior public.support_case_bookings;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_key IS NULL OR p_response_version IS NULL OR p_category IS NULL OR p_subject IS NULL OR p_body IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings booked ON booked.tutor_id=t.id WHERE booked.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR SHARE;
 IF NOT public.booking_workflow_participant(p_actor,p_session,p_booking) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid;RETURN;END IF;
 SELECT * INTO r FROM public.create_safeguarding_case(p_actor,p_session,p_key,p_response_version,p_category,p_subject,p_body);
 IF r.case_id IS NULL OR r.outcome NOT IN('saved','replayed') THEN RETURN QUERY SELECT r.outcome::text,NULL::uuid;RETURN;END IF;
 SELECT * INTO prior FROM public.support_case_bookings WHERE support_case_bookings.case_id=r.case_id;
 IF r.outcome='replayed' THEN
 IF prior.case_id IS NULL OR prior.booking_id<>p_booking THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid;RETURN;END IF;
 ELSE INSERT INTO public.support_case_bookings(case_id,booking_id) VALUES(r.case_id,p_booking);END IF;
 -- Association FKs can wait after W8's own final checks; both contracts must be fresh again.
 IF NOT public.booking_workflow_participant(p_actor,p_session,p_booking) THEN RAISE EXCEPTION 'Current booking dispute authority unavailable' USING ERRCODE='42501';END IF;
 IF NOT public.has_current_support_policy(p_response_version) THEN RAISE EXCEPTION 'Current dispute policy unavailable' USING ERRCODE='P5030';END IF;
 RETURN QUERY SELECT r.outcome::text,r.case_id::uuid;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.booking_workflow_participant(text,text,uuid),public.create_booking_workflow_dispute(text,text,uuid,uuid,text,text,text,text) FROM PUBLIC;

--> statement-breakpoint
CREATE FUNCTION public.assert_booking_workflow_receipt(p_actor text,p_session text,p_booking uuid,p_event uuid,p_action text,p_policy uuid,p_replayed boolean,p_original_state text,p_expiry timestamptz,p_start timestamptz,p_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;e public.booking_lifecycle_events;family boolean;tutor boolean;expected text;
BEGIN
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_event IS NULL OR p_policy IS NULL OR p_replayed IS NULL OR NOT (p_action IN('create','confirm','cancel','reschedule','complete','no_show')) IS TRUE OR public.admission_identity(p_actor,p_session) IS NOT TRUE THEN RAISE EXCEPTION 'Receipt identity or action unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE id=p_event;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false);
 IF b.id IS NULL OR b.source IS DISTINCT FROM 'synthetic_readiness' OR b.workflow_policy_id IS DISTINCT FROM p_policy OR public.booking_workflow_policy_current(p_policy) IS NOT TRUE OR public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) IS NOT TRUE OR e.id IS NULL OR e.workflow_policy_id IS DISTINCT FROM p_policy OR e.logical_booking_id IS DISTINCT FROM b.logical_booking_id
 OR (p_action IN('create','cancel','reschedule') AND NOT (family OR (p_action<>'create' AND tutor)) IS TRUE)
 OR (p_action IN('confirm','complete','no_show') AND public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) IS NOT TRUE)
 OR (p_action IN('create','confirm','reschedule','complete','no_show') AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action IN('create','confirm','reschedule')) IS NOT TRUE)
 THEN RAISE EXCEPTION 'Receipt current authority unavailable' USING ERRCODE='42501';END IF;
 IF p_replayed THEN RETURN;END IF;
 IF p_original_state IS NULL OR p_expiry IS NULL OR p_start IS NULL OR p_end IS NULL THEN RAISE EXCEPTION 'Receipt transition context unavailable' USING ERRCODE='42501';END IF;
 expected:=CASE p_action WHEN 'create' THEN 'provisional' WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled' WHEN 'complete' THEN 'completed' WHEN 'no_show' THEN 'no_show' ELSE p_original_state END;
 IF b.state IS DISTINCT FROM expected OR (p_action<>'reschedule' AND (e.booking_id IS DISTINCT FROM b.id OR e.workflow_revision IS DISTINCT FROM b.workflow_revision OR e.event IS DISTINCT FROM 'workflow_'||expected)) OR (p_action='reschedule' AND (e.replacement_booking_id IS DISTINCT FROM b.id OR e.event IS DISTINCT FROM 'workflow_rescheduled'))
 THEN RAISE EXCEPTION 'Receipt postcondition unavailable' USING ERRCODE='P4090';END IF;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,b.id,p_action,p_policy,p_original_state,p_expiry,p_start,p_end);
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.assert_booking_workflow_receipt(text,text,uuid,uuid,text,uuid,boolean,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
