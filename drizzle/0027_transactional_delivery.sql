CREATE TABLE "transactional_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"recipient_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claim_until" timestamp with time zone,
	"payload" jsonb,
	"idempotency_key" text,
	"payload_fingerprint" text,
	"configuration_fingerprint" text,
	"first_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"provider_id" uuid,
	"failure_code" text,
	"closed_at" timestamp with time zone,
	"suppressed_reason" text,
	CONSTRAINT "transactional_delivery_intent_unique" UNIQUE("event_id","recipient_user_id","kind"),
	CONSTRAINT "transactional_delivery_state_check" CHECK ("transactional_deliveries"."state" IN ('pending','claimed','retryable','uncertain','provider_accepted','suppressed','blocked')),
	CONSTRAINT "transactional_delivery_finite_times" CHECK (isfinite("transactional_deliveries"."created_at") AND ("transactional_deliveries"."claim_until" IS NULL OR isfinite("transactional_deliveries"."claim_until")) AND ("transactional_deliveries"."first_attempt_at" IS NULL OR isfinite("transactional_deliveries"."first_attempt_at")) AND ("transactional_deliveries"."last_attempt_at" IS NULL OR isfinite("transactional_deliveries"."last_attempt_at")) AND ("transactional_deliveries"."next_attempt_at" IS NULL OR isfinite("transactional_deliveries"."next_attempt_at")) AND ("transactional_deliveries"."closed_at" IS NULL OR isfinite("transactional_deliveries"."closed_at"))),
	CONSTRAINT "transactional_delivery_claim_shape" CHECK ((("transactional_deliveries"."state"='claimed' AND "transactional_deliveries"."claim_token" IS NOT NULL AND "transactional_deliveries"."claim_until" IS NOT NULL) OR ("transactional_deliveries"."state"<>'claimed' AND "transactional_deliveries"."claim_token" IS NULL AND "transactional_deliveries"."claim_until" IS NULL)) IS TRUE),
	CONSTRAINT "transactional_delivery_prepared_shape" CHECK ((( "transactional_deliveries"."payload" IS NULL AND "transactional_deliveries"."idempotency_key" IS NULL AND "transactional_deliveries"."payload_fingerprint" IS NULL AND "transactional_deliveries"."configuration_fingerprint" IS NULL AND "transactional_deliveries"."first_attempt_at" IS NULL AND "transactional_deliveries"."last_attempt_at" IS NULL AND "transactional_deliveries"."attempts"=0) OR ("transactional_deliveries"."payload" IS NOT NULL AND jsonb_typeof("transactional_deliveries"."payload")='object' AND "transactional_deliveries"."idempotency_key" ~ '^learli/[a-f0-9]{64}$' AND "transactional_deliveries"."payload_fingerprint" ~ '^[a-f0-9]{64}$' AND "transactional_deliveries"."configuration_fingerprint" ~ '^[a-f0-9]{64}$' AND "transactional_deliveries"."first_attempt_at" IS NOT NULL AND "transactional_deliveries"."last_attempt_at">="transactional_deliveries"."first_attempt_at" AND "transactional_deliveries"."attempts" BETWEEN 1 AND 8)) IS TRUE),
	CONSTRAINT "transactional_delivery_outcome_shape" CHECK ((( "transactional_deliveries"."state" IN ('pending','claimed') AND "transactional_deliveries"."provider_id" IS NULL AND "transactional_deliveries"."closed_at" IS NULL AND "transactional_deliveries"."next_attempt_at" IS NULL AND "transactional_deliveries"."failure_code" IS NULL AND "transactional_deliveries"."suppressed_reason" IS NULL) OR ("transactional_deliveries"."state" IN ('retryable','uncertain') AND "transactional_deliveries"."payload" IS NOT NULL AND "transactional_deliveries"."provider_id" IS NULL AND "transactional_deliveries"."closed_at" IS NULL AND "transactional_deliveries"."next_attempt_at" IS NOT NULL AND "transactional_deliveries"."failure_code" IN ('rate_limited','unavailable','timeout') AND "transactional_deliveries"."suppressed_reason" IS NULL) OR ("transactional_deliveries"."state"='provider_accepted' AND "transactional_deliveries"."payload" IS NOT NULL AND "transactional_deliveries"."provider_id" IS NOT NULL AND "transactional_deliveries"."closed_at" IS NOT NULL AND "transactional_deliveries"."next_attempt_at" IS NULL AND "transactional_deliveries"."failure_code" IS NULL AND "transactional_deliveries"."suppressed_reason" IS NULL) OR ("transactional_deliveries"."state"='blocked' AND "transactional_deliveries"."provider_id" IS NULL AND "transactional_deliveries"."closed_at" IS NOT NULL AND "transactional_deliveries"."next_attempt_at" IS NULL AND "transactional_deliveries"."failure_code" IN ('retention_elapsed','attempt_limit','configuration','recipient','payload') AND "transactional_deliveries"."suppressed_reason" IS NULL) OR ("transactional_deliveries"."state"='suppressed' AND "transactional_deliveries"."provider_id" IS NULL AND "transactional_deliveries"."closed_at" IS NOT NULL AND "transactional_deliveries"."next_attempt_at" IS NULL AND "transactional_deliveries"."failure_code" IS NULL AND "transactional_deliveries"."suppressed_reason" IN ('outdated_or_unauthorized','material_changed'))) IS TRUE)
);
--> statement-breakpoint
ALTER TABLE "transactional_deliveries" ADD CONSTRAINT "transactional_delivery_intent_fk" FOREIGN KEY ("event_id","recipient_user_id","kind") REFERENCES "public"."booking_workflow_notice_intents"("event_id","recipient_user_id","kind") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactional_delivery_pending_idx" ON "transactional_deliveries" USING btree ("state","next_attempt_at","created_at","id");
--> statement-breakpoint
CREATE FUNCTION public.queue_transactional_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 INSERT INTO public.transactional_deliveries(event_id,recipient_user_id,kind,created_at)
 VALUES(NEW.event_id,NEW.recipient_user_id,NEW.kind,clock_timestamp());
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER queue_transactional_delivery AFTER INSERT ON public.booking_workflow_notice_intents FOR EACH ROW EXECUTE FUNCTION public.queue_transactional_delivery();
--> statement-breakpoint
CREATE FUNCTION public.preserve_transactional_delivery() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'delivery history is immutable' USING ERRCODE='23514'; END IF;
 IF ROW(OLD.id,OLD.event_id,OLD.recipient_user_id,OLD.kind,OLD.created_at) IS DISTINCT FROM ROW(NEW.id,NEW.event_id,NEW.recipient_user_id,NEW.kind,NEW.created_at) THEN
  RAISE EXCEPTION 'delivery identity is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.payload IS NOT NULL AND ROW(OLD.payload,OLD.idempotency_key,OLD.payload_fingerprint,OLD.configuration_fingerprint,OLD.first_attempt_at) IS DISTINCT FROM ROW(NEW.payload,NEW.idempotency_key,NEW.payload_fingerprint,NEW.configuration_fingerprint,NEW.first_attempt_at) THEN
  RAISE EXCEPTION 'prepared delivery is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.state IN('provider_accepted','suppressed','blocked') THEN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'closed delivery is immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.state IN('pending','retryable','uncertain') OR (OLD.state='claimed' AND NEW.claim_token IS DISTINCT FROM OLD.claim_token AND NEW.state='claimed') THEN
  IF NEW.state<>'claimed' OR NEW.claim_token IS NULL OR (OLD.state='claimed' AND OLD.claim_until>clock_timestamp()) OR (OLD.state IN('retryable','uncertain') AND OLD.next_attempt_at>clock_timestamp())
    OR NEW.attempts<>OLD.attempts OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at
    OR NEW.claim_until<=clock_timestamp() OR NEW.claim_until>clock_timestamp()+interval '60 seconds' THEN
   RAISE EXCEPTION 'invalid delivery claim' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.state<>'claimed' OR OLD.claim_until<=clock_timestamp() OR (NEW.state='claimed' AND (NEW.claim_token IS DISTINCT FROM OLD.claim_token OR NEW.claim_until IS DISTINCT FROM OLD.claim_until)) THEN
  RAISE EXCEPTION 'stale delivery claim' USING ERRCODE='23514';
 END IF;
 IF NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 OR (NEW.state<>'claimed' AND NEW.attempts<>OLD.attempts)
  OR NEW.state='pending' THEN RAISE EXCEPTION 'invalid delivery transition' USING ERRCODE='23514'; END IF;
 IF NEW.payload IS NOT NULL THEN
  IF (jsonb_typeof(NEW.payload)<>'object'
    OR NEW.payload - ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath'] <> '{}'::jsonb
    OR NOT NEW.payload ?& ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath']
    OR EXISTS(SELECT 1 FROM jsonb_each(NEW.payload) item WHERE (item.key='firstAttemptAt' AND jsonb_typeof(item.value)<>'number') OR (item.key<>'firstAttemptAt' AND jsonb_typeof(item.value)<>'string'))
    OR NEW.payload->>'eventId' <> NEW.event_id::text
    OR NEW.payload->>'source' <> 'synthetic_readiness'
    OR NEW.payload->>'kind' <> substring(NEW.kind from 10)
    OR (NEW.payload->>'firstAttemptAt')::numeric <> floor(extract(epoch from NEW.first_attempt_at)*1000)
    OR length(NEW.payload->>'subject') NOT BETWEEN 1 AND 60
    OR length(NEW.payload->>'recipientEmail') NOT BETWEEN 3 AND 254
    OR NEW.payload->>'detailPath' !~ '^/bookings/[a-f0-9-]{36}[?]scope=(student|guardian|tutor)$') IS DISTINCT FROM FALSE THEN
   RAISE EXCEPTION 'invalid delivery material' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_transactional_delivery BEFORE UPDATE OR DELETE ON public.transactional_deliveries FOR EACH ROW EXECUTE FUNCTION public.preserve_transactional_delivery();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.queue_transactional_delivery(),public.preserve_transactional_delivery() FROM PUBLIC;
