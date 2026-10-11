CREATE TABLE "booking_notification_deliveries" (
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
	CONSTRAINT "booking_notification_deliveries_event_id_recipient_user_id_kind_pk" PRIMARY KEY("event_id","recipient_user_id","kind"),
	CONSTRAINT "booking_notice_kind" CHECK ("booking_notification_deliveries"."kind" = 'simulated_reservation_created'),
	CONSTRAINT "booking_notice_state" CHECK ("booking_notification_deliveries"."state" IN ('pending','captured','suppressed')),
	CONSTRAINT "booking_notice_attempts" CHECK ("booking_notification_deliveries"."attempts" >= 0 AND (("booking_notification_deliveries"."attempts" = 0 AND "booking_notification_deliveries"."last_attempt_at" IS NULL) OR ("booking_notification_deliveries"."attempts" > 0 AND "booking_notification_deliveries"."last_attempt_at" IS NOT NULL))),
	CONSTRAINT "booking_notice_shape" CHECK ((
    ("booking_notification_deliveries"."state" = 'pending' AND "booking_notification_deliveries"."closed_at" IS NULL AND "booking_notification_deliveries"."suppressed_reason" IS NULL AND (("booking_notification_deliveries"."attempts" = 0 AND "booking_notification_deliveries"."failure_code" IS NULL) OR ("booking_notification_deliveries"."attempts" > 0 AND "booking_notification_deliveries"."failure_code" = 'capture_unavailable')))
    OR ("booking_notification_deliveries"."state" = 'captured' AND "booking_notification_deliveries"."closed_at" IS NOT NULL AND "booking_notification_deliveries"."attempts" > 0 AND "booking_notification_deliveries"."failure_code" IS NULL AND "booking_notification_deliveries"."suppressed_reason" IS NULL)
    OR ("booking_notification_deliveries"."state" = 'suppressed' AND "booking_notification_deliveries"."closed_at" IS NOT NULL AND "booking_notification_deliveries"."attempts" > 0 AND "booking_notification_deliveries"."failure_code" IS NULL AND "booking_notification_deliveries"."suppressed_reason" = 'outdated_or_unauthorized')
  ) IS TRUE),
	CONSTRAINT "booking_notice_finite_times" CHECK (isfinite("booking_notification_deliveries"."created_at") AND ("booking_notification_deliveries"."last_attempt_at" IS NULL OR isfinite("booking_notification_deliveries"."last_attempt_at")) AND ("booking_notification_deliveries"."closed_at" IS NULL OR isfinite("booking_notification_deliveries"."closed_at")))
);
--> statement-breakpoint
ALTER TABLE "booking_notification_deliveries" ADD CONSTRAINT "booking_notification_deliveries_event_id_booking_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."booking_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notification_deliveries" ADD CONSTRAINT "booking_notification_deliveries_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_notice_pending_idx" ON "booking_notification_deliveries" USING btree ("state","created_at","event_id");
--> statement-breakpoint
-- Supplemental trigger invariants are not represented by Drizzle snapshots.
-- Queue only from the actual existing creation event in its booking transaction.
CREATE FUNCTION public.queue_local_booking_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.event = 'demo_reserved' THEN
    INSERT INTO public.booking_notification_deliveries
      (event_id, recipient_user_id, kind, created_at)
    SELECT NEW.id, recipients.user_id, 'simulated_reservation_created', NEW.created_at
    FROM (
      SELECT b.booked_by_user_id AS user_id
        FROM public.bookings b WHERE b.id = NEW.booking_id
          AND b.source = 'local_simulation' AND b.state = 'demo_reserved'
      UNION
      SELECT t.user_id FROM public.bookings b
        JOIN public.tutor_profiles t ON t.id = b.tutor_id
        WHERE b.id = NEW.booking_id
          AND b.source = 'local_simulation' AND b.state = 'demo_reserved'
    ) recipients
    ON CONFLICT (event_id, recipient_user_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.queue_local_booking_notice() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER queue_local_booking_notice AFTER INSERT ON public.booking_events
  FOR EACH ROW EXECUTE FUNCTION public.queue_local_booking_notice();
--> statement-breakpoint
CREATE FUNCTION public.preserve_local_booking_notice() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.state <> 'pending'
     OR (to_jsonb(NEW) - ARRAY['state','attempts','last_attempt_at','closed_at','failure_code','suppressed_reason'])
        IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['state','attempts','last_attempt_at','closed_at','failure_code','suppressed_reason'])
     OR NEW.attempts <> OLD.attempts + 1 THEN
    RAISE EXCEPTION 'Local notice transition unavailable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.preserve_local_booking_notice() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER preserve_local_booking_notice BEFORE UPDATE ON public.booking_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.preserve_local_booking_notice();
