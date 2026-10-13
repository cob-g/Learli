CREATE TABLE "publication_moderator_grants" (
	"review_id" uuid NOT NULL,
	"moderator_user_id" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"reference" text NOT NULL,
	CONSTRAINT "publication_moderator_grants_review_id_moderator_user_id_pk" PRIMARY KEY("review_id","moderator_user_id"),
	CONSTRAINT "publication_moderator_shape" CHECK (isfinite("publication_moderator_grants"."valid_until") AND "publication_moderator_grants"."reference" ~ '^synthetic:[0-9a-f-]{36}$')
);
--> statement-breakpoint
CREATE TABLE "publication_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"previous_state" text,
	"next_state" text NOT NULL,
	"revision" integer NOT NULL,
	"privacy_checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_events_revision_unique" UNIQUE("review_id","revision"),
	CONSTRAINT "publication_events_actor_request_unique" UNIQUE("actor_user_id","request_id"),
	CONSTRAINT "publication_events_shape" CHECK ((("publication_review_events"."revision"=0 AND "publication_review_events"."previous_state" IS NULL AND "publication_review_events"."next_state"='pending' AND NOT "publication_review_events"."privacy_checked") OR ("publication_review_events"."revision">0 AND (("publication_review_events"."previous_state"='pending' AND "publication_review_events"."next_state" IN ('approved','rejected')) OR ("publication_review_events"."previous_state"='approved' AND "publication_review_events"."next_state" IN ('published','pending')) OR ("publication_review_events"."previous_state"='published' AND "publication_review_events"."next_state"='withdrawn') OR ("publication_review_events"."previous_state" IN ('rejected','withdrawn') AND "publication_review_events"."next_state"='pending')) AND ("publication_review_events"."next_state" NOT IN ('approved','published') OR "publication_review_events"."privacy_checked"))) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "publication_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"logical_booking_id" uuid NOT NULL,
	"completion_event_id" uuid NOT NULL,
	"booking_revision" integer NOT NULL,
	"author_user_id" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"source" text DEFAULT 'synthetic_readiness' NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_reviews_logical_unique" UNIQUE("logical_booking_id"),
	CONSTRAINT "publication_reviews_author_request_unique" UNIQUE("author_user_id","request_id"),
	CONSTRAINT "publication_reviews_source" CHECK ("publication_reviews"."source"='synthetic_readiness'),
	CONSTRAINT "publication_reviews_rating" CHECK ("publication_reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "publication_reviews_comment" CHECK (char_length("publication_reviews"."comment")<=1000 AND "publication_reviews"."comment"=btrim("publication_reviews"."comment") AND translate("publication_reviews"."comment",E'\n\r\t','') !~ '[[:cntrl:]]'),
	CONSTRAINT "publication_reviews_state" CHECK ("publication_reviews"."state" IN ('pending','approved','rejected','published','withdrawn')),
	CONSTRAINT "publication_reviews_revisions" CHECK ("publication_reviews"."revision">=0 AND "publication_reviews"."booking_revision">=0)
);
--> statement-breakpoint
CREATE TABLE "review_publication_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"reference" text NOT NULL,
	"content_digest" text NOT NULL,
	"terms" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_publication_policy_shape" CHECK ("review_publication_policies"."version"='synthetic-publication-v1' AND "review_publication_policies"."reference"='synthetic:publication:v1' AND "review_publication_policies"."content_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "review_publication_policy_head" (
	"source" text PRIMARY KEY NOT NULL,
	"policy_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "review_publication_head_source" CHECK ("review_publication_policy_head"."source"='synthetic_readiness')
);
--> statement-breakpoint
ALTER TABLE "publication_moderator_grants" ADD CONSTRAINT "publication_moderator_grants_review_id_publication_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."publication_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_moderator_grants" ADD CONSTRAINT "publication_moderator_grants_moderator_user_id_user_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_moderator_grants" ADD CONSTRAINT "publication_moderator_grants_policy_id_review_publication_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."review_publication_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_review_events" ADD CONSTRAINT "publication_review_events_review_id_publication_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."publication_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_review_events" ADD CONSTRAINT "publication_review_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_review_events" ADD CONSTRAINT "publication_review_events_policy_id_review_publication_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."review_publication_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_reviews" ADD CONSTRAINT "publication_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_reviews" ADD CONSTRAINT "publication_reviews_logical_booking_id_bookings_id_fk" FOREIGN KEY ("logical_booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_reviews" ADD CONSTRAINT "publication_reviews_completion_event_id_booking_lifecycle_events_id_fk" FOREIGN KEY ("completion_event_id") REFERENCES "public"."booking_lifecycle_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_reviews" ADD CONSTRAINT "publication_reviews_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_reviews" ADD CONSTRAINT "publication_reviews_policy_id_review_publication_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."review_publication_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_publication_policy_head" ADD CONSTRAINT "review_publication_policy_head_policy_id_review_publication_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."review_publication_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_moderator_user_idx" ON "publication_moderator_grants" USING btree ("moderator_user_id");--> statement-breakpoint
CREATE FUNCTION public.publication_policy_current(p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.review_publication_policy_head h JOIN public.review_publication_policies p ON p.id=h.policy_id WHERE h.source='synthetic_readiness' AND h.enabled AND p.id=p_policy AND p.terms->>'authority'='synthetic_test' AND p.terms->>'source'='synthetic_readiness' AND p.terms->>'policyId'=p.id::text AND p.terms->>'version'=p.version AND p.terms->>'reference'=p.reference AND p.terms->>'contentDigest'=p.content_digest AND p.terms->>'eligibleOutcome'='administrative_completed' AND p.terms->>'authorRelation'='current_booking_beneficiary' AND p.terms->>'submissionRule'='one_immutable_per_logical_booking' AND p.terms->>'moderation'='manual_exact_assigned_mfa' AND p.terms->>'privacyReview'='explicit_before_approval_and_publication' AND p.terms->>'publicFields'='anonymous_label_rating_plain_text_date' AND p.terms->>'disputePath'='/support'); $$;
--> statement-breakpoint
-- Exact stored author authority is independent of whether that author is signed in.
CREATE FUNCTION public.publication_completion_current(p_author text,p_booking uuid,p_event uuid,p_revision integer) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.bookings b JOIN public.booking_lifecycle_events e ON e.id=p_event AND e.booking_id=b.id AND e.logical_booking_id=b.logical_booking_id AND e.event='workflow_completed' AND e.workflow_policy_id=b.workflow_policy_id AND e.workflow_revision=b.workflow_revision JOIN public.tutor_profiles t ON t.id=b.tutor_id JOIN public."user" u ON u.id=t.user_id JOIN public.user_access x ON x.user_id=u.id AND x.status='active' WHERE b.id=p_booking AND b.source='synthetic_readiness' AND b.state='completed' AND b.workflow_revision=p_revision AND b.end_at_utc<=clock_timestamp() AND b.booked_by_user_id=p_author AND t.user_id<>p_author AND t.review_status='approved' AND u.email_verified AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tutor') AND EXISTS(SELECT 1 FROM public.tutor_subjects ts JOIN public.subjects s ON s.id=ts.subject_id AND s.is_active WHERE ts.tutor_id=t.id) AND NOT EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision) AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(p_author,b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(t.id,'synthetic_readiness')); $$;
--> statement-breakpoint
CREATE FUNCTION public.publication_author_allowed(p_actor text,p_session text,p_booking uuid,p_event uuid,p_revision integer,p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.publication_policy_current(p_policy) AND public.publication_completion_current(p_actor,p_booking,p_event,p_revision) AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=p_booking AND public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id)); $$;
--> statement-breakpoint
CREATE FUNCTION public.publication_moderator_allowed(p_actor text,p_session text,p_review uuid,p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.has_admin_assurance(p_actor,p_session,28800) AND public.publication_policy_current(p_policy) AND EXISTS(SELECT 1 FROM public.publication_moderator_grants g JOIN public.publication_reviews v ON v.id=g.review_id JOIN public.bookings b ON b.id=v.booking_id JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE v.id=p_review AND v.policy_id=p_policy AND v.source='synthetic_readiness' AND g.moderator_user_id=p_actor AND g.active AND g.valid_until>clock_timestamp() AND g.policy_id=v.policy_id AND v.author_user_id<>p_actor AND t.user_id<>p_actor); $$;
--> statement-breakpoint
CREATE FUNCTION public.submit_publication_review(p_actor text,p_session text,p_booking uuid,p_event uuid,p_booking_revision integer,p_policy uuid,p_request uuid,p_rating integer,p_comment text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings%ROWTYPE; v public.publication_reviews%ROWTYPE; result uuid;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Publication writes require read committed' USING ERRCODE='25001';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_event IS NULL OR p_booking_revision IS NULL OR p_booking_revision<0 OR p_policy IS NULL OR p_request IS NULL OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_comment IS NULL OR char_length(p_comment)>1000 OR p_comment<>btrim(p_comment) OR translate(p_comment,E'\n\r\t','') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid publication submission' USING ERRCODE='23514'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=b.tutor_id FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 IF public.publication_author_allowed(p_actor,p_session,b.id,p_event,p_booking_revision,p_policy) IS NOT TRUE THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
 SELECT * INTO v FROM public.publication_reviews WHERE logical_booking_id=b.logical_booking_id OR (author_user_id=p_actor AND request_id=p_request) ORDER BY created_at LIMIT 1;
 IF v.id IS NOT NULL THEN
  IF v.author_user_id IS DISTINCT FROM p_actor OR v.booking_id IS DISTINCT FROM b.id OR v.completion_event_id IS DISTINCT FROM p_event OR v.booking_revision IS DISTINCT FROM p_booking_revision OR v.policy_id IS DISTINCT FROM p_policy OR v.request_id IS DISTINCT FROM p_request OR v.rating IS DISTINCT FROM p_rating OR v.comment IS DISTINCT FROM p_comment THEN RAISE EXCEPTION 'Review already saved' USING ERRCODE='40001';END IF;
  RETURN v.id;
 END IF;
 INSERT INTO public.publication_reviews(booking_id,logical_booking_id,completion_event_id,booking_revision,author_user_id,policy_id,request_id,rating,comment) VALUES(b.id,b.logical_booking_id,p_event,p_booking_revision,p_actor,p_policy,p_request,p_rating,p_comment) RETURNING id INTO result;
 INSERT INTO public.publication_review_events(review_id,actor_user_id,policy_id,request_id,next_state,revision) VALUES(result,p_actor,p_policy,p_request,'pending',0);
 IF public.publication_author_allowed(p_actor,p_session,b.id,p_event,p_booking_revision,p_policy) IS NOT TRUE THEN RAISE EXCEPTION 'Review authority changed' USING ERRCODE='P0002';END IF;
 RETURN result;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.decide_publication_review(p_actor text,p_session text,p_review uuid,p_policy uuid,p_expected integer,p_request uuid,p_state text,p_privacy boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v public.publication_reviews%ROWTYPE; b public.bookings%ROWTYPE; e public.publication_review_events%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Publication writes require read committed' USING ERRCODE='25001';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_review IS NULL OR p_policy IS NULL OR p_expected IS NULL OR p_expected<0 OR p_request IS NULL OR p_state IS NULL OR p_state NOT IN('pending','approved','rejected','published','withdrawn') OR p_privacy IS NULL OR (p_state IN('approved','published') AND p_privacy IS NOT TRUE) THEN RAISE EXCEPTION 'Invalid publication decision' USING ERRCODE='23514';END IF;
 SELECT * INTO v FROM public.publication_reviews WHERE id=p_review;
 SELECT * INTO b FROM public.bookings WHERE id=v.booking_id;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=b.tutor_id FOR UPDATE;
 PERFORM 1 FROM public.bookings WHERE id=b.id FOR UPDATE;
 SELECT * INTO v FROM public.publication_reviews WHERE id=p_review FOR UPDATE;
 IF public.publication_moderator_allowed(p_actor,p_session,v.id,p_policy) IS NOT TRUE THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
 SELECT * INTO e FROM public.publication_review_events WHERE actor_user_id=p_actor AND request_id=p_request;
 IF e.id IS NOT NULL THEN
  IF e.review_id IS DISTINCT FROM v.id OR e.policy_id IS DISTINCT FROM p_policy OR e.revision IS DISTINCT FROM p_expected+1 OR e.next_state IS DISTINCT FROM p_state OR e.privacy_checked IS DISTINCT FROM p_privacy THEN RAISE EXCEPTION 'Review changed' USING ERRCODE='40001';END IF;
  IF p_state IN('approved','published') AND public.publication_completion_current(v.author_user_id,v.booking_id,v.completion_event_id,v.booking_revision) IS NOT TRUE THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
  RETURN v.id;
 END IF;
 IF v.revision<>p_expected THEN RAISE EXCEPTION 'Review changed' USING ERRCODE='40001';END IF;
 IF NOT ((v.state='pending' AND p_state IN('approved','rejected')) OR (v.state='approved' AND p_state IN('published','pending')) OR (v.state='published' AND p_state='withdrawn') OR (v.state IN('rejected','withdrawn') AND p_state='pending')) THEN RAISE EXCEPTION 'Review decision unavailable' USING ERRCODE='23514';END IF;
 IF p_state IN('approved','published') AND public.publication_completion_current(v.author_user_id,v.booking_id,v.completion_event_id,v.booking_revision) IS NOT TRUE THEN RAISE EXCEPTION 'Review unavailable' USING ERRCODE='P0002';END IF;
 UPDATE public.publication_reviews SET state=p_state,revision=revision+1,updated_at=clock_timestamp() WHERE id=v.id;
 INSERT INTO public.publication_review_events(review_id,actor_user_id,policy_id,request_id,previous_state,next_state,revision,privacy_checked) VALUES(v.id,p_actor,p_policy,p_request,v.state,p_state,v.revision+1,p_privacy);
 IF public.publication_moderator_allowed(p_actor,p_session,v.id,p_policy) IS NOT TRUE OR (p_state IN('approved','published') AND public.publication_completion_current(v.author_user_id,v.booking_id,v.completion_event_id,v.booking_revision) IS NOT TRUE) THEN RAISE EXCEPTION 'Review authority changed' USING ERRCODE='P0002';END IF;
 RETURN v.id;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.preserve_publication_review() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' OR ROW(NEW.id,NEW.booking_id,NEW.logical_booking_id,NEW.completion_event_id,NEW.booking_revision,NEW.author_user_id,NEW.policy_id,NEW.request_id,NEW.source,NEW.rating,NEW.comment,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.logical_booking_id,OLD.completion_event_id,OLD.booking_revision,OLD.author_user_id,OLD.policy_id,OLD.request_id,OLD.source,OLD.rating,OLD.comment,OLD.created_at) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Review is immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.preserve_publication_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN RAISE EXCEPTION 'Publication record is immutable' USING ERRCODE='23514';END; $$;
--> statement-breakpoint
CREATE FUNCTION public.require_publication_event() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.publication_review_events e WHERE e.review_id=NEW.id AND e.revision=NEW.revision AND e.next_state=NEW.state AND e.policy_id=NEW.policy_id AND (NEW.revision>0 OR (e.actor_user_id=NEW.author_user_id AND e.request_id=NEW.request_id))) THEN RAISE EXCEPTION 'Review audit required' USING ERRCODE='23514';END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_publication_review BEFORE UPDATE OR DELETE ON public.publication_reviews FOR EACH ROW EXECUTE FUNCTION public.preserve_publication_review();
--> statement-breakpoint
CREATE TRIGGER preserve_publication_audit BEFORE UPDATE OR DELETE ON public.publication_review_events FOR EACH ROW EXECUTE FUNCTION public.preserve_publication_audit();
--> statement-breakpoint
CREATE TRIGGER preserve_publication_policy BEFORE UPDATE OR DELETE ON public.review_publication_policies FOR EACH ROW EXECUTE FUNCTION public.preserve_publication_audit();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER require_publication_event AFTER INSERT OR UPDATE ON public.publication_reviews DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_publication_event();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.publication_policy_current(uuid),public.publication_completion_current(text,uuid,uuid,integer),public.publication_author_allowed(text,text,uuid,uuid,integer,uuid),public.publication_moderator_allowed(text,text,uuid,uuid),public.submit_publication_review(text,text,uuid,uuid,integer,uuid,uuid,integer,text),public.decide_publication_review(text,text,uuid,uuid,integer,uuid,text,boolean),public.preserve_publication_review(),public.preserve_publication_audit(),public.require_publication_event() FROM PUBLIC;

--> statement-breakpoint
-- Root-authorized forward isolation guard; accepted0025 remains immutable.
CREATE OR REPLACE FUNCTION public.create_policy_booking(p_actor text,p_session text,p_key uuid,p_policy uuid,p_learner uuid,p_tutor uuid,p_subject uuid,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;p public.booking_workflow_policies;n timestamptz;e uuid;ap uuid;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_key IS NULL OR p_policy IS NULL OR p_learner IS NULL OR p_tutor IS NULL OR p_subject IS NULL OR p_start IS NULL OR p_end IS NULL OR p_zone IS NULL OR p_fingerprint IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t WHERE t.id=p_tutor FOR UPDATE;
 PERFORM u.id FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=p_policy;
 IF p.id IS NULL OR NOT public.booking_workflow_policy_current(p_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 ap:=(p.terms->>'admissionPolicyId')::uuid;
 IF NOT public.has_current_learner_authority(p_actor,p_session,p_learner,ap) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_tutor_current(p_tutor,p_learner,p_subject,true) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO b FROM public.bookings WHERE booked_by_user_id=p_actor AND idempotency_key=p_key;
 IF b.id IS NOT NULL THEN
 IF b.source<>'synthetic_readiness' OR b.request_fingerprint<>p_fingerprint OR b.workflow_policy_id<>p_policy THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT id INTO e FROM public.booking_lifecycle_events WHERE booking_lifecycle_events.booking_id=b.id AND event='workflow_provisional';
 RETURN QUERY SELECT 'replayed'::text,b.id,e;RETURN;END IF;
 n:=clock_timestamp();
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF NOT public.booking_workflow_slot_valid(p_tutor,p_start,p_end,n,NULL) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (SELECT count(*) FROM public.bookings WHERE booked_by_user_id=p_actor AND created_at>n-interval '1 minute')>=20 THEN RETURN QUERY SELECT 'capacity'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM public.expire_policy_bookings(p_tutor);
 -- Legacy expiry materialization is delegated to the established shared service.
 INSERT INTO public.bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES('synthetic_readiness',p_tutor,p_learner,p_actor,p_subject,p_start,p_end,p_zone,p_key,p_fingerprint,'provisional',n,n+interval '10 minutes',p_policy,ap) RETURNING * INTO b;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,p_actor,'workflow_provisional',p_key,p_fingerprint,n,p_policy,0,'synthetic_request') RETURNING id INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,b.id,'create',p_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'created'::text,b.id,e;
END; $$;

--> statement-breakpoint
-- Root-authorized forward isolation guard; accepted0025 remains immutable.
CREATE OR REPLACE FUNCTION public.change_policy_booking(p_actor text,p_session text,p_booking uuid,p_request uuid,p_current_policy uuid,p_revision integer,p_action text,p_reason text,p_start timestamptz,p_end timestamptz,p_zone text,p_fingerprint text) RETURNS TABLE(outcome text,booking_id uuid,event_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r public.bookings;e public.booking_lifecycle_events;p public.booking_workflow_policies;n timestamptz;newstate text;family boolean;tutor boolean;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_request IS NULL OR p_current_policy IS NULL OR p_revision IS NULL OR p_revision<0 OR NOT (p_action IN('confirm','complete','no_show','cancel','reschedule')) IS TRUE OR p_reason IS NULL OR p_fingerprint IS NULL OR (p_action='reschedule' AND (p_start IS NULL OR p_end IS NULL OR p_zone IS NULL)) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings prior ON prior.tutor_id=t.id WHERE prior.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR NO KEY UPDATE;
 IF b.id IS NULL OR b.source<>'synthetic_readiness' THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_current_policy IS DISTINCT FROM b.workflow_policy_id OR NOT public.booking_workflow_policy_current(p_current_policy) THEN RETURN QUERY SELECT 'policy_unavailable'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO p FROM public.booking_workflow_policies WHERE id=b.workflow_policy_id;
 family:=public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id);
 tutor:=public.admission_identity(p_actor,p_session) AND EXISTS(SELECT 1 FROM public.tutor_profiles t WHERE t.id=b.tutor_id AND t.user_id=p_actor) AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id);
 IF (p_action IN('cancel','reschedule') AND NOT(family OR tutor)) OR (p_action IN('confirm','complete','no_show') AND (NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action) OR NOT public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) OR NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,p_action='confirm'))) OR p_action NOT IN('confirm','complete','no_show','cancel','reschedule') THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 SELECT * INTO e FROM public.booking_lifecycle_events WHERE actor_user_id=p_actor AND request_id=p_request;
 IF e.id IS NOT NULL THEN
 IF e.booking_id<>b.id OR e.request_fingerprint<>p_fingerprint OR e.workflow_policy_id IS NULL THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 RETURN QUERY SELECT 'replayed'::text,coalesce(e.replacement_booking_id,b.id),e.id;RETURN;END IF;
 IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_reason<>(CASE p_action WHEN 'confirm' THEN 'synthetic_prerequisite_review' WHEN 'complete' THEN 'synthetic_completed' WHEN 'no_show' THEN 'synthetic_no_show' ELSE 'synthetic_participant_change' END) THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 n:=clock_timestamp();
 IF b.workflow_revision<>p_revision OR EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision) OR b.state NOT IN('provisional','confirmed') OR (b.state='provisional' AND b.expires_at<=n) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF (p_action='confirm' AND (b.state<>'provisional' OR b.start_at_utc<=n)) OR (p_action IN('complete','no_show') AND (b.state<>'confirmed' OR b.end_at_utc>n)) OR (p_action IN('cancel','reschedule') AND b.start_at_utc<=n+make_interval(mins=>CASE p_action WHEN 'cancel' THEN (p.terms->>'cancelCutoffMinutes')::integer ELSE (p.terms->>'moveCutoffMinutes')::integer END)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 IF p_action='reschedule' AND (NOT public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,true) OR NOT public.booking_workflow_slot_valid(b.tutor_id,p_start,p_end,n,b.id) OR p_start=b.start_at_utc OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone)) THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid,NULL::uuid;RETURN;END IF;
 newstate:=CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'cancel' THEN 'cancelled' WHEN 'reschedule' THEN 'replaced' WHEN 'complete' THEN 'completed' ELSE 'no_show' END;
 -- Last post-lock checks use this connection and current clock; a receipt is no grant.
 IF NOT public.booking_workflow_policy_current(p_current_policy) OR (p_action IN('confirm','complete','no_show') AND NOT public.has_booking_workflow_task(p_actor,p_session,b.id,p_action)) OR (family AND NOT public.has_current_learner_authority(p_actor,p_session,b.learner_id,b.admission_policy_id)) OR (tutor AND NOT public.admission_identity(p_actor,p_session)) THEN RAISE EXCEPTION 'Workflow authority changed' USING ERRCODE='42501';END IF;
 UPDATE public.bookings SET state=newstate,workflow_revision=workflow_revision+1 WHERE id=b.id;
 IF p_action='reschedule' THEN
 INSERT INTO public.bookings(logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
 VALUES(b.logical_booking_id,b.id,b.revision+1,b.source,b.tutor_id,b.learner_id,b.booked_by_user_id,b.subject_id,p_start,p_end,p_zone,gen_random_uuid(),p_fingerprint,b.state,n,b.expires_at,b.workflow_policy_id,b.admission_policy_id) RETURNING * INTO r;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES(r.logical_booking_id,r.id,p_actor,'workflow_'||r.state,gen_random_uuid(),p_fingerprint,n,r.workflow_policy_id,0,CASE r.state WHEN 'confirmed' THEN 'synthetic_prerequisite_review' ELSE 'synthetic_request' END);
 END IF;
 INSERT INTO public.booking_lifecycle_events(logical_booking_id,booking_id,replacement_booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
 VALUES(b.logical_booking_id,b.id,r.id,p_actor,CASE p_action WHEN 'reschedule' THEN 'workflow_rescheduled' ELSE 'workflow_'||newstate END,p_request,p_fingerprint,n,b.workflow_policy_id,b.workflow_revision+1,p_reason) RETURNING * INTO e;
 PERFORM public.assert_booking_workflow_authority(p_actor,p_session,coalesce(r.id,b.id),p_action,p_current_policy,b.state,b.expires_at,b.start_at_utc,b.end_at_utc);
 RETURN QUERY SELECT 'saved'::text,coalesce(r.id,b.id),e.id;
END; $$;

--> statement-breakpoint
-- Root-authorized forward isolation guard; accepted0025 remains immutable.
CREATE OR REPLACE FUNCTION public.create_booking_workflow_dispute(p_actor text,p_session text,p_booking uuid,p_key uuid,p_response_version text,p_category text,p_subject text,p_body text) RETURNS TABLE(outcome text,case_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE b public.bookings;r record;prior public.support_case_bookings;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'Workflow writes require read committed' USING ERRCODE='23514';END IF;
 IF p_actor IS NULL OR p_session IS NULL OR p_booking IS NULL OR p_key IS NULL OR p_response_version IS NULL OR p_category IS NULL OR p_subject IS NULL OR p_body IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid;RETURN;END IF;
 PERFORM t.id FROM public.tutor_profiles t JOIN public.bookings booked ON booked.tutor_id=t.id WHERE booked.id=p_booking FOR UPDATE OF t;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR SHARE;
 IF NOT public.booking_workflow_participant(p_actor,p_session,p_booking) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::uuid;RETURN;END IF;
 SELECT * INTO r FROM public.create_safeguarding_case(p_actor,p_session,p_key,p_response_version,p_category,p_subject,p_body);
 IF r.case_id IS NULL OR r.outcome NOT IN('saved','replayed') THEN RETURN QUERY SELECT r.outcome::text,NULL::uuid;RETURN;END IF;
 SELECT * INTO prior FROM public.support_case_bookings WHERE support_case_bookings.case_id=r.case_id;
 IF r.outcome='replayed' THEN
 IF prior.case_id IS NULL OR prior.booking_id<>p_booking THEN RETURN QUERY SELECT 'conflict'::text,NULL::uuid;RETURN;END IF;
 ELSE INSERT INTO public.support_case_bookings(case_id,booking_id) VALUES(r.case_id,p_booking);END IF;
 -- Association FKs can wait after W8's own final checks; both contracts must be fresh again.
 IF NOT public.booking_workflow_participant(p_actor,p_session,p_booking) THEN RAISE EXCEPTION 'Current booking dispute authority unavailable' USING ERRCODE='42501';END IF;
 IF NOT public.has_current_support_policy(p_response_version) THEN RAISE EXCEPTION 'Current dispute policy unavailable' USING ERRCODE='P5030';END IF;
 RETURN QUERY SELECT r.outcome::text,r.case_id::uuid;
END; $$;
