CREATE TABLE "private_booking_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"logical_booking_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"source" text DEFAULT 'local_synthetic' NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_booking_reviews_logical_unique" UNIQUE("logical_booking_id"),
	CONSTRAINT "private_booking_reviews_author_request_unique" UNIQUE("author_user_id","request_id"),
	CONSTRAINT "private_booking_reviews_source" CHECK ("private_booking_reviews"."source"='local_synthetic'),
	CONSTRAINT "private_booking_reviews_rating" CHECK ("private_booking_reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "private_booking_reviews_comment" CHECK (char_length("private_booking_reviews"."comment")<=1000 AND "private_booking_reviews"."comment"=btrim("private_booking_reviews"."comment")),
	CONSTRAINT "private_booking_reviews_state" CHECK ("private_booking_reviews"."state" IN ('pending','locally_approved','locally_rejected')),
	CONSTRAINT "private_booking_reviews_revision" CHECK ("private_booking_reviews"."revision">=0)
);
--> statement-breakpoint
CREATE TABLE "private_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"previous_state" text,
	"next_state" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_review_events_revision_unique" UNIQUE("review_id","revision"),
	CONSTRAINT "private_review_events_actor_request_unique" UNIQUE("actor_user_id","request_id"),
	CONSTRAINT "private_review_events_shape" CHECK ((("private_review_events"."revision"=0 AND "private_review_events"."previous_state" IS NULL AND "private_review_events"."next_state"='pending') OR ("private_review_events"."revision">0 AND (("private_review_events"."previous_state"='pending' AND "private_review_events"."next_state" IN ('locally_approved','locally_rejected')) OR ("private_review_events"."previous_state" IN ('locally_approved','locally_rejected') AND "private_review_events"."next_state"='pending')))) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "review_moderator_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"moderator_user_id" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "review_moderator_grants_scope_unique" UNIQUE("review_id","moderator_user_id"),
	CONSTRAINT "review_moderator_grants_status" CHECK ("review_moderator_grants"."status" IN ('authorized','revoked'))
);
--> statement-breakpoint
CREATE TABLE "review_moderators" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'local_fixture' NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "review_moderators_source" CHECK ("review_moderators"."source"='local_fixture'),
	CONSTRAINT "review_moderators_status" CHECK ("review_moderators"."status" IN ('authorized','revoked'))
);
--> statement-breakpoint
CREATE TABLE "review_provisioning_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_user_id" text NOT NULL,
	"review_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_provisioning_events_status" CHECK ("review_provisioning_events"."status" IN ('authorized','revoked'))
);
--> statement-breakpoint
ALTER TABLE "private_booking_reviews" ADD CONSTRAINT "private_booking_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_booking_reviews" ADD CONSTRAINT "private_booking_reviews_logical_booking_id_bookings_id_fk" FOREIGN KEY ("logical_booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_booking_reviews" ADD CONSTRAINT "private_booking_reviews_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_review_events" ADD CONSTRAINT "private_review_events_review_id_private_booking_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."private_booking_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_review_events" ADD CONSTRAINT "private_review_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderator_grants" ADD CONSTRAINT "review_moderator_grants_review_id_private_booking_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."private_booking_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderator_grants" ADD CONSTRAINT "review_moderator_grants_moderator_user_id_review_moderators_user_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."review_moderators"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderators" ADD CONSTRAINT "review_moderators_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_provisioning_events" ADD CONSTRAINT "review_provisioning_events_moderator_user_id_review_moderators_user_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."review_moderators"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_provisioning_events" ADD CONSTRAINT "review_provisioning_events_review_id_private_booking_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."private_booking_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_moderator_grants_user_idx" ON "review_moderator_grants" USING btree ("moderator_user_id");
--> statement-breakpoint
-- Internal predicate, invoked by the narrow owner functions only. No runtime execute grant.
CREATE FUNCTION public.private_review_author_allowed(p_actor text,p_session text,p_booking uuid) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.bookings b
 JOIN public."user" u ON u.id=p_actor AND u.email_verified AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
 JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
 JOIN public.session s ON s.user_id=u.id AND s.id=p_session AND s.expires_at>clock_timestamp()
 JOIN public.learner_profiles l ON l.id=b.learner_id AND l.status='active' AND l.source='local_fixture'
 JOIN public.tutor_profiles tp ON tp.id=b.tutor_id AND tp.user_id<>u.id
 WHERE b.id=p_booking AND b.source='local_simulation' AND b.state='demo_completed' AND b.end_at_utc<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM public.bookings child WHERE child.logical_booking_id=b.logical_booking_id AND child.revision>b.revision)
 AND EXISTS(SELECT 1 FROM public.booking_lifecycle_events e WHERE e.booking_id=b.id AND e.logical_booking_id=b.logical_booking_id AND e.event='demo_completed')
 AND ((l.management='self' AND l.user_id=u.id AND l.level='college_support' AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='student'))
 OR (l.management='guardian' AND l.user_id IS NULL AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='parent') AND EXISTS(SELECT 1 FROM public.guardian_learner_links g WHERE g.learner_id=l.id AND g.guardian_user_id=u.id AND g.source='local_fixture' AND g.status='authorized')))
 ); $$;
--> statement-breakpoint
CREATE FUNCTION public.private_review_moderator_allowed(p_actor text,p_session text,p_review uuid) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.private_booking_reviews v
 JOIN public.bookings b ON b.id=v.booking_id
 JOIN public.tutor_profiles tp ON tp.id=b.tutor_id
 JOIN public."user" u ON u.id=p_actor AND u.email_verified AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
 JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
 JOIN public.session s ON s.user_id=u.id AND s.id=p_session AND s.expires_at>clock_timestamp()
 JOIN public.review_moderators m ON m.user_id=u.id AND m.source='local_fixture' AND m.status='authorized'
 JOIN public.review_moderator_grants g ON g.review_id=v.id AND g.moderator_user_id=u.id AND g.status='authorized'
 WHERE v.id=p_review AND v.source='local_synthetic' AND v.author_user_id<>u.id AND tp.user_id<>u.id
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin'));
$$;
--> statement-breakpoint
CREATE FUNCTION public.submit_private_review(p_actor text,p_session text,p_booking uuid,p_expected integer,p_request uuid,p_rating integer,p_comment text) RETURNS TABLE(id uuid,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b public.bookings; existing public.private_booking_reviews; created public.private_booking_reviews;
BEGIN
 PERFORM tp.id FROM public.tutor_profiles tp JOIN public.bookings x ON x.tutor_id=tp.id WHERE x.id=p_booking FOR UPDATE OF tp;
 SELECT * INTO b FROM public.bookings x WHERE x.id=p_booking;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
 PERFORM x.id FROM public.bookings x WHERE x.id=b.logical_booking_id FOR NO KEY UPDATE;
 PERFORM x.id FROM public.bookings x WHERE x.id=b.id FOR NO KEY UPDATE;
 IF NOT public.private_review_author_allowed(p_actor,p_session,p_booking) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
 IF p_expected IS NULL OR b.revision<>p_expected THEN RAISE EXCEPTION 'Stale review' USING ERRCODE='40001'; END IF;
 IF p_request IS NULL OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_comment IS NULL OR char_length(p_comment)>1000 OR p_comment<>btrim(p_comment) THEN RAISE EXCEPTION 'Invalid review' USING ERRCODE='23514'; END IF;
 SELECT * INTO existing FROM public.private_booking_reviews v WHERE v.logical_booking_id=b.logical_booking_id OR (v.author_user_id=p_actor AND v.request_id=p_request) LIMIT 1;
 IF existing.id IS NOT NULL THEN
  IF existing.author_user_id<>p_actor OR existing.request_id<>p_request OR existing.booking_id<>b.id OR existing.rating<>p_rating OR existing.comment<>p_comment THEN RAISE EXCEPTION 'Conflicting review' USING ERRCODE='40001'; END IF;
  RETURN QUERY SELECT existing.id,existing.revision; RETURN;
 END IF;
 INSERT INTO public.private_booking_reviews(booking_id,logical_booking_id,author_user_id,request_id,rating,comment) VALUES(b.id,b.logical_booking_id,p_actor,p_request,p_rating,p_comment) RETURNING * INTO created;
 INSERT INTO public.private_review_events(review_id,actor_user_id,request_id,next_state,revision) VALUES(created.id,p_actor,p_request,'pending',0);
 RETURN QUERY SELECT created.id,created.revision;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.moderate_private_review(p_actor text,p_session text,p_review uuid,p_expected integer,p_request uuid,p_state text) RETURNS TABLE(id uuid,revision integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v public.private_booking_reviews; prior public.private_review_events;
BEGIN
 PERFORM tp.id FROM public.tutor_profiles tp JOIN public.bookings b ON b.tutor_id=tp.id JOIN public.private_booking_reviews x ON x.booking_id=b.id WHERE x.id=p_review FOR UPDATE OF tp;
 PERFORM root.id FROM public.bookings root JOIN public.private_booking_reviews x ON x.logical_booking_id=root.id WHERE x.id=p_review FOR NO KEY UPDATE OF root;
 SELECT * INTO v FROM public.private_booking_reviews x WHERE x.id=p_review FOR UPDATE;
 IF v.id IS NULL OR NOT public.private_review_moderator_allowed(p_actor,p_session,p_review) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
 IF p_request IS NULL OR p_expected IS NULL OR p_state IS NULL OR p_state NOT IN('pending','locally_approved','locally_rejected') THEN RAISE EXCEPTION 'Invalid moderation' USING ERRCODE='23514'; END IF;
 SELECT * INTO prior FROM public.private_review_events e WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
 IF prior.id IS NOT NULL THEN
  IF prior.review_id<>v.id OR prior.next_state<>p_state OR prior.revision<>p_expected+1 OR v.revision<>prior.revision OR v.state<>prior.next_state THEN RAISE EXCEPTION 'Stale moderation' USING ERRCODE='40001'; END IF;
  RETURN QUERY SELECT v.id,v.revision; RETURN;
 END IF;
 IF v.revision<>p_expected THEN RAISE EXCEPTION 'Stale moderation' USING ERRCODE='40001'; END IF;
 IF NOT ((v.state='pending' AND p_state IN('locally_approved','locally_rejected')) OR (v.state IN('locally_approved','locally_rejected') AND p_state='pending')) THEN RAISE EXCEPTION 'Invalid moderation transition' USING ERRCODE='23514'; END IF;
 UPDATE public.private_booking_reviews x SET state=p_state,revision=v.revision+1,updated_at=clock_timestamp() WHERE x.id=v.id;
 INSERT INTO public.private_review_events(review_id,actor_user_id,request_id,previous_state,next_state,revision) VALUES(v.id,p_actor,p_request,v.state,p_state,v.revision+1);
 RETURN QUERY SELECT v.id,v.revision+1;
END; $$;
--> statement-breakpoint
CREATE FUNCTION public.preserve_private_review() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Private submission is immutable' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-'state'-'revision'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'revision'-'updated_at') OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.state='pending' AND NEW.state IN('locally_approved','locally_rejected')) OR (OLD.state IN('locally_approved','locally_rejected') AND NEW.state='pending')) THEN RAISE EXCEPTION 'Private submission is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_private_review BEFORE UPDATE OR DELETE ON public.private_booking_reviews FOR EACH ROW EXECUTE FUNCTION public.preserve_private_review();
--> statement-breakpoint
CREATE FUNCTION public.preserve_private_review_audit() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'Private audit is immutable' USING ERRCODE='23514'; END; $$;
--> statement-breakpoint
CREATE TRIGGER preserve_private_review_audit BEFORE UPDATE OR DELETE ON public.private_review_events FOR EACH ROW EXECUTE FUNCTION public.preserve_private_review_audit();
--> statement-breakpoint
CREATE TRIGGER preserve_review_provisioning_audit BEFORE UPDATE OR DELETE ON public.review_provisioning_events FOR EACH ROW EXECUTE FUNCTION public.preserve_private_review_audit();
--> statement-breakpoint
-- Require transition audit in the same transaction, including initial submission.
CREATE FUNCTION public.require_private_review_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.private_review_events e WHERE e.review_id=NEW.id AND e.revision=NEW.revision AND e.next_state=NEW.state) THEN RAISE EXCEPTION 'Private review requires audit' USING ERRCODE='23514'; END IF;
 RETURN NULL; END; $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER require_private_review_event AFTER INSERT OR UPDATE ON public.private_booking_reviews DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_private_review_event();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.private_review_author_allowed(text,text,uuid),public.private_review_moderator_allowed(text,text,uuid),public.submit_private_review(text,text,uuid,integer,uuid,integer,text),public.moderate_private_review(text,text,uuid,integer,uuid,text),public.preserve_private_review(),public.preserve_private_review_audit(),public.require_private_review_event() FROM PUBLIC;
