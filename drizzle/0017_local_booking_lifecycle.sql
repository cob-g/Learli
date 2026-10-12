ALTER TABLE public.bookings ADD COLUMN logical_booking_id uuid, ADD COLUMN replaces_booking_id uuid, ADD COLUMN revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Backfill only new columns; original fields and state/event facts are preserved.
DROP TRIGGER preserve_demo_booking ON public.bookings;
--> statement-breakpoint
UPDATE public.bookings SET logical_booking_id=id;
--> statement-breakpoint
ALTER TABLE public.bookings ALTER COLUMN logical_booking_id SET NOT NULL, ADD CONSTRAINT bookings_logical_fk FOREIGN KEY(logical_booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT, ADD CONSTRAINT bookings_replaces_fk FOREIGN KEY(replaces_booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT, ADD CONSTRAINT bookings_replaces_unique UNIQUE(replaces_booking_id), ADD CONSTRAINT bookings_revision_valid CHECK(revision>=0 AND ((revision=0 AND replaces_booking_id IS NULL AND logical_booking_id=id) OR (revision>0 AND replaces_booking_id IS NOT NULL AND logical_booking_id<>id)));
--> statement-breakpoint
ALTER TABLE public.bookings DROP CONSTRAINT bookings_demo_state, DROP CONSTRAINT bookings_tutor_no_overlap;
--> statement-breakpoint
ALTER TABLE public.bookings ADD CONSTRAINT bookings_demo_state CHECK(state IN('demo_reserved','demo_expired','demo_cancelled','demo_replaced','demo_confirmed','demo_completed')), ADD CONSTRAINT bookings_tutor_no_overlap EXCLUDE USING gist(tutor_id WITH =,tstzrange(start_at_utc,end_at_utc,'[)') WITH &&) WHERE(state IN('demo_reserved','demo_confirmed'));
--> statement-breakpoint
CREATE UNIQUE INDEX bookings_logical_live_unique ON public.bookings(logical_booking_id) WHERE(state IN('demo_reserved','demo_confirmed'));
--> statement-breakpoint
CREATE TABLE public.booking_lifecycle_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 logical_booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
 booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
 replacement_booking_id uuid REFERENCES public.bookings(id) ON DELETE RESTRICT,
 actor_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN('demo_cancelled','demo_rescheduled','demo_confirmed','demo_completed')),
 request_id uuid NOT NULL,
 request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT booking_lifecycle_actor_request_unique UNIQUE(actor_user_id,request_id),
 CONSTRAINT booking_lifecycle_shape CHECK((event='demo_rescheduled' AND replacement_booking_id IS NOT NULL) OR (event<>'demo_rescheduled' AND replacement_booking_id IS NULL))
);
--> statement-breakpoint
CREATE INDEX booking_lifecycle_logical_idx ON public.booking_lifecycle_events(logical_booking_id);
--> statement-breakpoint
CREATE FUNCTION public.guard_demo_booking_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE prior public.bookings;
BEGIN
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
CREATE TRIGGER guard_demo_booking_insert BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_demo_booking_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.preserve_demo_booking() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
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
CREATE TRIGGER preserve_demo_booking BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.preserve_demo_booking();
--> statement-breakpoint
CREATE FUNCTION public.guard_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE b public.bookings; replacement public.bookings;
BEGIN
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
CREATE TRIGGER guard_booking_lifecycle_event BEFORE INSERT OR UPDATE OR DELETE ON public.booking_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.guard_booking_lifecycle_event();
--> statement-breakpoint
CREATE FUNCTION public.require_booking_lifecycle_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.state IS DISTINCT FROM OLD.state AND NEW.state IN('demo_cancelled','demo_replaced','demo_confirmed','demo_completed') AND NOT EXISTS (
  SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=NEW.id AND e.event=CASE NEW.state WHEN 'demo_replaced' THEN 'demo_rescheduled' ELSE NEW.state END
 ) THEN RAISE EXCEPTION 'Synthetic transition requires history' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER require_booking_lifecycle_event AFTER UPDATE ON public.bookings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_booking_lifecycle_event();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_demo_booking_insert(),public.preserve_demo_booking(),public.guard_booking_lifecycle_event(),public.require_booking_lifecycle_event() FROM PUBLIC;
