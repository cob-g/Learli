-- Only an opaque Tutor profile identifier is sent; booking data remains private.
-- PostgreSQL delivers NOTIFY only when the writing transaction commits.
CREATE FUNCTION public.notify_tutor_booking_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.state IS DISTINCT FROM NEW.state OR OLD.start_at_utc IS DISTINCT FROM NEW.start_at_utc OR OLD.end_at_utc IS DISTINCT FROM NEW.end_at_utc THEN
    PERFORM pg_catalog.pg_notify('learli_tutor_booking', NEW.tutor_id::text);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.notify_tutor_booking_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER notify_tutor_booking_insert AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_tutor_booking_change();
--> statement-breakpoint
CREATE TRIGGER notify_tutor_booking_update AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_tutor_booking_change();
