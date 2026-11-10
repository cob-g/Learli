-- Notify only opaque learner identifiers on committed booking/meeting changes.
CREATE FUNCTION public.notify_parent_booking_change() RETURNS trigger
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
 IF learner IS NOT NULL AND EXISTS (SELECT 1 FROM public.learner_profiles l WHERE l.id=learner AND l.management='guardian') THEN
  PERFORM pg_catalog.pg_notify('learli_student_booking',learner::text);
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.notify_parent_booking_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER notify_parent_booking_insert AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_parent_booking_update AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_parent_meeting_insert AFTER INSERT ON public.booking_meeting_links
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_parent_meeting_update AFTER UPDATE ON public.booking_meeting_links
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_booking_change();
