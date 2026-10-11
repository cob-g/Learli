CREATE TABLE "support_booking_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_booking_access_action" CHECK ("support_booking_access_events"."action" = 'booking_context_read')
);
--> statement-breakpoint
CREATE TABLE "support_case_bookings" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_booking_access_events" ADD CONSTRAINT "support_booking_access_events_case_id_support_case_bookings_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_case_bookings"("case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_booking_access_events" ADD CONSTRAINT "support_booking_access_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_booking_access_events" ADD CONSTRAINT "support_booking_access_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_bookings" ADD CONSTRAINT "support_case_bookings_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_bookings" ADD CONSTRAINT "support_case_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_case_bookings_booking_idx" ON "support_case_bookings" USING btree ("booking_id");
--> statement-breakpoint
CREATE FUNCTION public.guard_support_booking_records() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Support booking records are immutable' USING ERRCODE = '23514';
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
REVOKE ALL ON FUNCTION public.guard_support_booking_records() FROM PUBLIC, learli_app;
--> statement-breakpoint
CREATE TRIGGER support_case_bookings_immutable BEFORE INSERT OR UPDATE OR DELETE
ON public.support_case_bookings FOR EACH ROW EXECUTE FUNCTION public.guard_support_booking_records();
--> statement-breakpoint
CREATE TRIGGER support_booking_access_immutable BEFORE INSERT OR UPDATE OR DELETE
ON public.support_booking_access_events FOR EACH ROW EXECUTE FUNCTION public.guard_support_booking_records();
