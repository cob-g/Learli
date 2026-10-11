CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_events_transition_unique" UNIQUE("booking_id","event"),
	CONSTRAINT "booking_events_demo_event" CHECK ("booking_events"."event" IN ('demo_reserved','demo_expired'))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"tutor_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"booked_by_user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"start_at_utc" timestamp with time zone NOT NULL,
	"end_at_utc" timestamp with time zone NOT NULL,
	"display_timezone" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bookings_actor_key_unique" UNIQUE("booked_by_user_id","idempotency_key"),
	CONSTRAINT "bookings_local_source" CHECK ("bookings"."source" = 'local_simulation'),
	CONSTRAINT "bookings_demo_state" CHECK ("bookings"."state" IN ('demo_reserved','demo_expired')),
	CONSTRAINT "bookings_interval_valid" CHECK (isfinite("bookings"."start_at_utc") AND isfinite("bookings"."end_at_utc") AND "bookings"."end_at_utc" > "bookings"."start_at_utc"),
	CONSTRAINT "bookings_expiry_valid" CHECK (isfinite("bookings"."created_at") AND isfinite("bookings"."expires_at") AND "bookings"."expires_at" > "bookings"."created_at"),
	CONSTRAINT "bookings_fingerprint_valid" CHECK ("bookings"."request_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "bookings_zone_valid" CHECK (char_length("bookings"."display_timezone") BETWEEN 1 AND 100 AND ("bookings"."display_timezone" = 'UTC' OR "bookings"."display_timezone" ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$'))
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booked_by_user_id_user_id_fk" FOREIGN KEY ("booked_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_tutor_time_idx" ON "bookings" USING btree ("tutor_id","start_at_utc");
--> statement-breakpoint
-- Drizzle has no exclusion-constraint/trigger schema primitive. Preserve these
-- reviewed supplemental invariants in every future migration reconciliation.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_tutor_no_overlap
  EXCLUDE USING gist (tutor_id WITH =, tstzrange(start_at_utc,end_at_utc,'[)') WITH &&)
  WHERE (state = 'demo_reserved');
--> statement-breakpoint
CREATE FUNCTION preserve_demo_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'state') IS DISTINCT FROM (to_jsonb(OLD) - 'state') THEN
    RAISE EXCEPTION 'Synthetic booking fields are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state AND
     NOT (OLD.state = 'demo_reserved' AND NEW.state = 'demo_expired' AND OLD.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Synthetic booking transition is unavailable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER preserve_demo_booking BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION preserve_demo_booking();
