-- Only local provisional messages may add the exact persisted expiry deadline.
-- All identity, claim, immutable preparation and terminal guards are preserved.
CREATE OR REPLACE FUNCTION public.preserve_transactional_delivery() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
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
    OR NEW.payload - ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath','expiresAtUtc'] <> '{}'::jsonb
    OR NOT NEW.payload ?& ARRAY['eventId','firstAttemptAt','recipientEmail','kind','source','subject','startAtUtc','endAtUtc','timezone','detailPath']
    OR EXISTS(SELECT 1 FROM jsonb_each(NEW.payload) item WHERE (item.key='firstAttemptAt' AND jsonb_typeof(item.value)<>'number') OR (item.key<>'firstAttemptAt' AND jsonb_typeof(item.value)<>'string'))
    OR NEW.payload->>'eventId' <> NEW.event_id::text
    OR NOT EXISTS(SELECT 1 FROM public.booking_lifecycle_events source_event JOIN public.bookings source_booking ON source_booking.id=source_event.booking_id WHERE source_event.id=NEW.event_id AND source_booking.source IN ('synthetic_readiness','local_operation') AND source_booking.source=NEW.payload->>'source')
    OR (NEW.payload ? 'expiresAtUtc' AND (NEW.payload->>'source'<>'local_operation' OR NEW.kind<>'workflow_provisional'))
    OR (NEW.payload->>'source'='local_operation' AND NEW.kind='workflow_provisional' AND (
      NOT NEW.payload ? 'expiresAtUtc'
      OR NOT EXISTS(SELECT 1 FROM public.booking_lifecycle_events deadline_event
        JOIN public.bookings deadline_booking ON deadline_booking.id=deadline_event.booking_id
        WHERE deadline_event.id=NEW.event_id AND deadline_booking.source='local_operation'
          AND (NEW.payload->>'expiresAtUtc')::timestamptz=deadline_booking.expires_at)))
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
