CREATE TABLE "booking_meeting_link_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_meeting_link_events_revision_unique" UNIQUE("booking_id","revision"),
	CONSTRAINT "booking_meeting_link_events_request_unique" UNIQUE("booking_id","request_id"),
	CONSTRAINT "booking_meeting_link_events_revision" CHECK ("booking_meeting_link_events"."revision" > 0),
	CONSTRAINT "booking_meeting_link_events_time" CHECK (isfinite("booking_meeting_link_events"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "booking_meeting_links" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"url" text NOT NULL,
	"revision" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_meeting_links_revision" CHECK ("booking_meeting_links"."revision" > 0),
	CONSTRAINT "booking_meeting_links_provider" CHECK ("booking_meeting_links"."provider" IN ('zoom','google_meet')),
	CONSTRAINT "booking_meeting_links_url_bound" CHECK (char_length("booking_meeting_links"."url") BETWEEN 1 AND 2048 AND "booking_meeting_links"."url" LIKE 'https://%'),
	CONSTRAINT "booking_meeting_links_time" CHECK (isfinite("booking_meeting_links"."updated_at"))
);
--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD CONSTRAINT "booking_meeting_link_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD CONSTRAINT "booking_meeting_link_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD CONSTRAINT "booking_meeting_links_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD CONSTRAINT "booking_meeting_links_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION enforce_booking_meeting_link_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.revision <> 1 THEN RAISE EXCEPTION 'Invalid meeting revision' USING ERRCODE='23514'; END IF;
  ELSE
    IF NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Invalid meeting revision' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION enforce_booking_meeting_link_revision() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER booking_meeting_link_revision_guard BEFORE INSERT OR UPDATE ON booking_meeting_links
FOR EACH ROW EXECUTE FUNCTION enforce_booking_meeting_link_revision();
