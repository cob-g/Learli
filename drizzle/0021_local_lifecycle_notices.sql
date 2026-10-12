CREATE TABLE "booking_lifecycle_notification_deliveries" (
	"event_id" uuid NOT NULL,
	"recipient_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"failure_code" text,
	"suppressed_reason" text,
	CONSTRAINT "booking_lifecycle_notification_deliveries_event_id_recipient_user_id_kind_pk" PRIMARY KEY("event_id","recipient_user_id","kind"),
	CONSTRAINT "booking_lifecycle_notice_kind" CHECK ("booking_lifecycle_notification_deliveries"."kind" IN ('simulated_reservation_cancelled','simulated_reservation_rescheduled','simulated_fixture_confirmed','simulated_fixture_completed')),
	CONSTRAINT "booking_lifecycle_notice_state" CHECK ("booking_lifecycle_notification_deliveries"."state" IN ('pending','captured','suppressed')),
	CONSTRAINT "booking_lifecycle_notice_attempts" CHECK ("booking_lifecycle_notification_deliveries"."attempts" >= 0 AND (("booking_lifecycle_notification_deliveries"."attempts" = 0 AND "booking_lifecycle_notification_deliveries"."last_attempt_at" IS NULL) OR ("booking_lifecycle_notification_deliveries"."attempts" > 0 AND "booking_lifecycle_notification_deliveries"."last_attempt_at" IS NOT NULL))),
	CONSTRAINT "booking_lifecycle_notice_shape" CHECK ((
    ("booking_lifecycle_notification_deliveries"."state" = 'pending' AND "booking_lifecycle_notification_deliveries"."closed_at" IS NULL AND "booking_lifecycle_notification_deliveries"."suppressed_reason" IS NULL AND (("booking_lifecycle_notification_deliveries"."attempts" = 0 AND "booking_lifecycle_notification_deliveries"."failure_code" IS NULL) OR ("booking_lifecycle_notification_deliveries"."attempts" > 0 AND "booking_lifecycle_notification_deliveries"."failure_code" = 'capture_unavailable')))
    OR ("booking_lifecycle_notification_deliveries"."state" = 'captured' AND "booking_lifecycle_notification_deliveries"."closed_at" IS NOT NULL AND "booking_lifecycle_notification_deliveries"."attempts" > 0 AND "booking_lifecycle_notification_deliveries"."failure_code" IS NULL AND "booking_lifecycle_notification_deliveries"."suppressed_reason" IS NULL)
    OR ("booking_lifecycle_notification_deliveries"."state" = 'suppressed' AND "booking_lifecycle_notification_deliveries"."closed_at" IS NOT NULL AND "booking_lifecycle_notification_deliveries"."attempts" > 0 AND "booking_lifecycle_notification_deliveries"."failure_code" IS NULL AND "booking_lifecycle_notification_deliveries"."suppressed_reason" = 'outdated_or_unauthorized')
  ) IS TRUE),
	CONSTRAINT "booking_lifecycle_notice_finite_times" CHECK (isfinite("booking_lifecycle_notification_deliveries"."created_at") AND ("booking_lifecycle_notification_deliveries"."last_attempt_at" IS NULL OR isfinite("booking_lifecycle_notification_deliveries"."last_attempt_at")) AND ("booking_lifecycle_notification_deliveries"."closed_at" IS NULL OR isfinite("booking_lifecycle_notification_deliveries"."closed_at")))
);
--> statement-breakpoint
ALTER TABLE "booking_lifecycle_notification_deliveries" ADD CONSTRAINT "booking_lifecycle_notification_deliveries_event_id_booking_lifecycle_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."booking_lifecycle_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lifecycle_notification_deliveries" ADD CONSTRAINT "booking_lifecycle_notification_deliveries_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_lifecycle_notice_pending_idx" ON "booking_lifecycle_notification_deliveries" USING btree ("state","created_at","event_id");
--> statement-breakpoint
-- Original creation identity remains unchanged; replacement rows are changes.
CREATE OR REPLACE FUNCTION public.queue_local_booking_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.event = 'demo_reserved' THEN
    INSERT INTO public.booking_notification_deliveries
      (event_id, recipient_user_id, kind, created_at)
    SELECT NEW.id, recipients.user_id, 'simulated_reservation_created', NEW.created_at
    FROM (
      SELECT b.booked_by_user_id AS user_id
        FROM public.bookings b WHERE b.id = NEW.booking_id
          AND b.source = 'local_simulation' AND b.state = 'demo_reserved' AND b.revision = 0
      UNION
      SELECT t.user_id FROM public.bookings b
        JOIN public.tutor_profiles t ON t.id = b.tutor_id
        WHERE b.id = NEW.booking_id
          AND b.source = 'local_simulation' AND b.state = 'demo_reserved' AND b.revision = 0
    ) recipients
    ON CONFLICT (event_id, recipient_user_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE FUNCTION public.queue_local_booking_lifecycle_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE notice_kind text;
BEGIN
  notice_kind := CASE NEW.event
    WHEN 'demo_cancelled' THEN 'simulated_reservation_cancelled'
    WHEN 'demo_rescheduled' THEN 'simulated_reservation_rescheduled'
    WHEN 'demo_confirmed' THEN 'simulated_fixture_confirmed'
    WHEN 'demo_completed' THEN 'simulated_fixture_completed'
    ELSE NULL END;
  IF notice_kind IS NOT NULL THEN
    INSERT INTO public.booking_lifecycle_notification_deliveries
      (event_id, recipient_user_id, kind, created_at)
    SELECT NEW.id, recipients.user_id, notice_kind, NEW.created_at
    FROM (
      SELECT b.booked_by_user_id AS user_id FROM public.bookings b
        WHERE b.id = COALESCE(NEW.replacement_booking_id, NEW.booking_id)
          AND b.source = 'local_simulation' AND b.logical_booking_id = NEW.logical_booking_id
      UNION
      SELECT t.user_id FROM public.bookings b
        JOIN public.tutor_profiles t ON t.id = b.tutor_id
        WHERE b.id = COALESCE(NEW.replacement_booking_id, NEW.booking_id)
          AND b.source = 'local_simulation' AND b.logical_booking_id = NEW.logical_booking_id
    ) recipients
    ON CONFLICT (event_id, recipient_user_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.queue_local_booking_lifecycle_notice() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER queue_local_booking_lifecycle_notice AFTER INSERT ON public.booking_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION public.queue_local_booking_lifecycle_notice();
--> statement-breakpoint
CREATE TRIGGER preserve_local_booking_lifecycle_notice BEFORE UPDATE ON public.booking_lifecycle_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.preserve_local_booking_notice();
