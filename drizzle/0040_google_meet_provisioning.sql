CREATE TABLE "tutor_google_meet_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tutor_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"google_subject" text NOT NULL,
	"account_label" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text NOT NULL,
	"generation" integer NOT NULL,
	"refresh_ciphertext" text,
	"granted_scopes" text[] NOT NULL,
	"consent_version" text DEFAULT 'meet-future-bookings-v1' NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"busy_token" uuid,
	"busy_until" timestamp with time zone,
	CONSTRAINT "tutor_google_meet_connections_tutor_id_unique" UNIQUE("tutor_id"),
	CONSTRAINT "tutor_google_meet_connections_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "meet_connection_tutor_identity" UNIQUE("id","tutor_id"),
	CONSTRAINT "meet_connection_shape" CHECK ("tutor_google_meet_connections"."state" IN ('active','reconnect','disconnected') AND "tutor_google_meet_connections"."generation">0 AND "tutor_google_meet_connections"."fingerprint" ~ '^[a-f0-9]{64}$' AND char_length("tutor_google_meet_connections"."google_subject") BETWEEN 1 AND 255 AND char_length("tutor_google_meet_connections"."account_label") BETWEEN 1 AND 320 AND ("tutor_google_meet_connections"."state"<>'active' OR "tutor_google_meet_connections"."refresh_ciphertext" IS NOT NULL) AND ("tutor_google_meet_connections"."state"<>'disconnected' OR "tutor_google_meet_connections"."refresh_ciphertext" IS NULL) AND "tutor_google_meet_connections"."consent_version"='meet-future-bookings-v1' AND isfinite("tutor_google_meet_connections"."consent_at")),
	CONSTRAINT "meet_connection_busy" CHECK (("tutor_google_meet_connections"."busy_token" IS NULL AND "tutor_google_meet_connections"."busy_until" IS NULL) OR ("tutor_google_meet_connections"."busy_token" IS NOT NULL AND "tutor_google_meet_connections"."busy_until" IS NOT NULL AND isfinite("tutor_google_meet_connections"."busy_until")))
);
--> statement-breakpoint
CREATE TABLE "booking_meeting_provisioning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"tutor_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"claim_token" uuid,
	"claim_until" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"space_name" text,
	"meeting_uri" text,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_meeting_provisioning_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "booking_meeting_provisioning_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "meet_job_booking_identity" UNIQUE("id","booking_id"),
	CONSTRAINT "meet_job_shape" CHECK ("booking_meeting_provisioning"."state" IN ('pending','claimed','dispatched','uncertain','ready','suppressed','blocked') AND "booking_meeting_provisioning"."generation">0 AND "booking_meeting_provisioning"."attempts" BETWEEN 0 AND 5 AND "booking_meeting_provisioning"."fingerprint" ~ '^[a-f0-9]{64}$' AND isfinite("booking_meeting_provisioning"."created_at") AND isfinite("booking_meeting_provisioning"."next_attempt_at") AND ("booking_meeting_provisioning"."claim_until" IS NULL OR isfinite("booking_meeting_provisioning"."claim_until")) AND ("booking_meeting_provisioning"."dispatched_at" IS NULL OR isfinite("booking_meeting_provisioning"."dispatched_at"))),
	CONSTRAINT "meet_job_receipt" CHECK (("booking_meeting_provisioning"."space_name" IS NULL AND "booking_meeting_provisioning"."meeting_uri" IS NULL) OR ("booking_meeting_provisioning"."space_name" IS NOT NULL AND "booking_meeting_provisioning"."meeting_uri" IS NOT NULL AND "booking_meeting_provisioning"."space_name" ~ '^spaces/[A-Za-z0-9_-]{1,128}$' AND "booking_meeting_provisioning"."meeting_uri" ~ '^https://meet[.]google[.]com/[a-z]+-[a-z]+-[a-z]+$' AND char_length("booking_meeting_provisioning"."meeting_uri")<=2048))
);
--> statement-breakpoint
CREATE TABLE "google_meet_oauth_attempts" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"browser_hash" text NOT NULL,
	"nonce" text NOT NULL,
	"verifier_ciphertext" text NOT NULL,
	"fingerprint" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"expected_generation" integer NOT NULL,
	"replace_account" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meet_oauth_shape" CHECK ("google_meet_oauth_attempts"."state_hash" ~ '^[a-f0-9]{64}$' AND "google_meet_oauth_attempts"."browser_hash" ~ '^[a-f0-9]{64}$' AND "google_meet_oauth_attempts"."fingerprint" ~ '^[a-f0-9]{64}$' AND "google_meet_oauth_attempts"."expected_generation">=0 AND isfinite("google_meet_oauth_attempts"."created_at") AND isfinite("google_meet_oauth_attempts"."expires_at") AND "google_meet_oauth_attempts"."expires_at">"google_meet_oauth_attempts"."created_at" AND ("google_meet_oauth_attempts"."consumed_at" IS NULL OR isfinite("google_meet_oauth_attempts"."consumed_at")))
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ALTER COLUMN "updated_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD COLUMN "actor_kind" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD COLUMN "automation_job_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD COLUMN "actor_kind" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD COLUMN "automation_job_id" uuid;--> statement-breakpoint
ALTER TABLE "tutor_google_meet_connections" ADD CONSTRAINT "tutor_google_meet_connections_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_google_meet_connections" ADD CONSTRAINT "tutor_google_meet_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_provisioning" ADD CONSTRAINT "booking_meeting_provisioning_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_provisioning" ADD CONSTRAINT "booking_meeting_provisioning_event_id_booking_lifecycle_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."booking_lifecycle_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_provisioning" ADD CONSTRAINT "meet_job_connection_fk" FOREIGN KEY ("connection_id","tutor_id") REFERENCES "public"."tutor_google_meet_connections"("id","tutor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_meet_oauth_attempts" ADD CONSTRAINT "google_meet_oauth_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meet_job_claim_order" ON "booking_meeting_provisioning" USING btree ("fingerprint","state","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "meet_oauth_owner_time" ON "google_meet_oauth_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD CONSTRAINT "meeting_event_job_fk" FOREIGN KEY ("automation_job_id","booking_id") REFERENCES "public"."booking_meeting_provisioning"("id","booking_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD CONSTRAINT "meeting_link_job_fk" FOREIGN KEY ("automation_job_id","booking_id") REFERENCES "public"."booking_meeting_provisioning"("id","booking_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'parent_role.self_granted', 'student_role.self_granted', 'local_workflow.staff_authorized', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated', 'subject.renamed', 'google_meet.connected', 'google_meet.disconnected'));--> statement-breakpoint
ALTER TABLE "booking_meeting_link_events" ADD CONSTRAINT "meeting_event_actor" CHECK (("booking_meeting_link_events"."actor_kind"='human' AND "booking_meeting_link_events"."actor_user_id" IS NOT NULL AND "booking_meeting_link_events"."automation_job_id" IS NULL) OR ("booking_meeting_link_events"."actor_kind"='system' AND "booking_meeting_link_events"."actor_user_id" IS NULL AND "booking_meeting_link_events"."automation_job_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "booking_meeting_links" ADD CONSTRAINT "meeting_link_actor" CHECK (("booking_meeting_links"."actor_kind"='human' AND "booking_meeting_links"."updated_by_user_id" IS NOT NULL AND "booking_meeting_links"."automation_job_id" IS NULL) OR ("booking_meeting_links"."actor_kind"='system' AND "booking_meeting_links"."updated_by_user_id" IS NULL AND "booking_meeting_links"."automation_job_id" IS NOT NULL));--> statement-breakpoint
-- Cluster-level worker-role provisioning belongs to the explicit local operator.
CREATE FUNCTION public.google_meet_actor(p_user text,p_session text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.workflow_identity(p_user,p_session,'local_operation') AND EXISTS(
 SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles r ON r.user_id=t.user_id AND r.role='tutor'
 WHERE t.user_id=p_user AND t.review_status<>'suspended'); $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_fresh_actor(p_user text,p_session text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.google_meet_actor(p_user,p_session) AND EXISTS(SELECT 1 FROM public.session s
 WHERE s.id=p_session AND s.user_id=p_user AND s.created_at>clock_timestamp()-interval '24 hours'); $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_metadata(p_user text,p_session text)
RETURNS TABLE(state text,account_label text,generation integer,fingerprint text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.google_meet_actor(p_user,p_session) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT c.state,c.account_label,c.generation,c.fingerprint FROM public.tutor_google_meet_connections c WHERE c.user_id=p_user;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_begin(p_user text,p_session text,p_state text,p_browser text,p_nonce text,p_verifier text,p_config text,p_replace boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t uuid;c public.tutor_google_meet_connections;
BEGIN
 SELECT id INTO t FROM public.tutor_profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT public.google_meet_fresh_actor(p_user,p_session) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.google_meet_oauth_attempts a WHERE a.user_id=p_user AND a.created_at>clock_timestamp()-interval '10 minutes')>=5 THEN
  RAISE EXCEPTION 'Connection busy' USING ERRCODE='54000'; END IF;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE user_id=p_user FOR UPDATE;
 DELETE FROM public.google_meet_oauth_attempts a WHERE a.user_id=p_user AND a.expires_at<=clock_timestamp() AND a.created_at<clock_timestamp()-interval '1 day';
 INSERT INTO public.google_meet_oauth_attempts(state_hash,user_id,session_id,browser_hash,nonce,verifier_ciphertext,fingerprint,connection_id,expected_generation,replace_account,expires_at)
 VALUES(p_state,p_user,p_session,p_browser,p_nonce,p_verifier,p_config,coalesce(c.id,gen_random_uuid()),coalesce(c.generation,0),p_replace,clock_timestamp()+interval '10 minutes');
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_consume(p_user text,p_session text,p_state text,p_browser text,p_config text)
RETURNS TABLE(connection_id uuid,nonce text,verifier_ciphertext text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.google_meet_fresh_actor(p_user,p_session) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 RETURN QUERY UPDATE public.google_meet_oauth_attempts a SET consumed_at=clock_timestamp()
 WHERE a.state_hash=p_state AND a.browser_hash=p_browser AND a.user_id=p_user AND a.session_id=p_session
 AND a.fingerprint=p_config AND a.expires_at>clock_timestamp() AND a.consumed_at IS NULL
 RETURNING a.connection_id,a.nonce,a.verifier_ciphertext;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_complete(p_user text,p_session text,p_state text,p_subject text,p_label text,p_cipher text,p_scopes text[],p_config text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.google_meet_oauth_attempts;c public.tutor_google_meet_connections;t uuid;
BEGIN
 SELECT id INTO t FROM public.tutor_profiles WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO a FROM public.google_meet_oauth_attempts WHERE state_hash=p_state FOR UPDATE;
 IF NOT public.google_meet_fresh_actor(p_user,p_session) OR a.user_id IS DISTINCT FROM p_user OR a.session_id IS DISTINCT FROM p_session
 OR a.fingerprint IS DISTINCT FROM p_config OR a.consumed_at IS NULL OR a.expires_at<=clock_timestamp()
 OR coalesce(c.generation,0)<>a.expected_generation
 OR (c.id IS NOT NULL AND c.id<>a.connection_id)
 OR NOT coalesce('https://www.googleapis.com/auth/meetings.space.created'=ANY(p_scopes),false)
 OR (c.id IS NOT NULL AND c.google_subject<>p_subject AND NOT a.replace_account)
 THEN RETURN false; END IF;
 IF p_cipher IS NULL AND (c.id IS NULL OR c.google_subject<>p_subject OR c.fingerprint<>p_config OR c.refresh_ciphertext IS NULL) THEN RETURN false; END IF;
 INSERT INTO public.tutor_google_meet_connections(id,tutor_id,user_id,google_subject,account_label,fingerprint,state,generation,refresh_ciphertext,granted_scopes)
 VALUES(a.connection_id,t,p_user,p_subject,p_label,p_config,'active',1,coalesce(p_cipher,c.refresh_ciphertext),p_scopes)
 ON CONFLICT(user_id) DO UPDATE SET google_subject=p_subject,account_label=p_label,fingerprint=p_config,state='active',
 generation=c.generation+1,refresh_ciphertext=coalesce(p_cipher,c.refresh_ciphertext),granted_scopes=p_scopes,consent_at=clock_timestamp(),busy_token=NULL,busy_until=NULL;
 -- Consumption and generation prevent a second completion of the same attempt.
 INSERT INTO public.audit_events(actor_user_id,target_user_id,action) VALUES(p_user,p_user,'google_meet.connected');
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_disconnect(p_user text,p_session text)
RETURNS TABLE(id uuid,google_subject text,fingerprint text,refresh_ciphertext text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.tutor_google_meet_connections;
BEGIN
 PERFORM 1 FROM public.tutor_profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT public.google_meet_fresh_actor(p_user,p_session) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE user_id=p_user FOR UPDATE;
 -- Also invalidate a first connection callback which is still in flight.
 UPDATE public.google_meet_oauth_attempts SET expires_at=clock_timestamp() WHERE user_id=p_user AND expires_at>clock_timestamp();
 IF c.id IS NULL THEN RETURN; END IF;
 UPDATE public.tutor_google_meet_connections SET state='disconnected',generation=generation+1,refresh_ciphertext=NULL,busy_token=NULL,busy_until=NULL WHERE user_id=p_user;
 INSERT INTO public.audit_events(actor_user_id,target_user_id,action) VALUES(p_user,p_user,'google_meet.disconnected');
 RETURN QUERY SELECT c.id,c.google_subject,c.fingerprint,c.refresh_ciphertext;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_booking_current(p_booking uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.bookings b
 WHERE b.id=p_booking AND b.source='local_operation' AND b.state='confirmed' AND b.end_at_utc>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM public.bookings newer WHERE newer.replaces_booking_id=b.id)
 AND public.booking_workflow_policy_current(b.workflow_policy_id)
 AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
 AND public.booking_workflow_tutor_current(b.tutor_id,b.learner_id,b.subject_id,false)); $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.event='workflow_confirmed' AND public.google_meet_booking_current(NEW.booking_id) THEN
  INSERT INTO public.booking_meeting_provisioning(booking_id,event_id,tutor_id,connection_id,generation,fingerprint)
  SELECT b.id,NEW.id,b.tutor_id,c.id,c.generation,c.fingerprint
  FROM public.bookings b JOIN public.tutor_google_meet_connections c ON c.tutor_id=b.tutor_id AND c.state='active'
  WHERE b.id=NEW.booking_id AND NOT EXISTS(SELECT 1 FROM public.booking_meeting_links m WHERE m.booking_id=b.id)
  ON CONFLICT(booking_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER google_meet_confirmed_intent AFTER INSERT ON public.booking_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.google_meet_enqueue();
--> statement-breakpoint
CREATE FUNCTION public.google_meet_claim(p_config text,p_token uuid)
RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- A dispatched request with no known result may have succeeded. Never replay it.
 UPDATE public.booking_meeting_provisioning j SET state='uncertain',failure_code='uncertain'
 WHERE j.fingerprint=p_config AND j.state='dispatched' AND j.claim_until<=clock_timestamp() AND j.space_name IS NULL;
 UPDATE public.booking_meeting_provisioning j SET state=CASE WHEN j.attempts>=5 AND j.space_name IS NULL THEN 'blocked' ELSE 'pending' END,claim_token=NULL,claim_until=NULL
 WHERE j.fingerprint=p_config AND j.state IN('claimed','dispatched') AND j.claim_until<=clock_timestamp()
 AND (j.dispatched_at IS NULL OR j.space_name IS NOT NULL);
 RETURN QUERY WITH candidate AS (
 SELECT j.id FROM public.booking_meeting_provisioning j WHERE j.fingerprint=p_config AND j.state='pending'
 AND j.next_attempt_at<=clock_timestamp() AND (j.attempts<5 OR j.space_name IS NOT NULL)
 ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE SKIP LOCKED
 ) UPDATE public.booking_meeting_provisioning j SET state='claimed',claim_token=p_token,
 claim_until=clock_timestamp()+interval '60 seconds',attempts=CASE WHEN j.space_name IS NULL THEN j.attempts+1 ELSE j.attempts END
 FROM candidate WHERE j.id=candidate.id RETURNING j.id;
END $$;
--> statement-breakpoint
-- Shared lock protocol: tutor -> booking -> connection -> job. No HTTP in SQL.
CREATE FUNCTION public.google_meet_prepare(p_id uuid,p_token uuid,p_config text,p_dispatch boolean)
RETURNS TABLE(connection_id uuid,owner_id text,google_subject text,refresh_ciphertext text,space_name text,meeting_uri text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.booking_meeting_provisioning;c public.tutor_google_meet_connections;
BEGIN
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id;
 IF j.id IS NULL THEN RETURN; END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=j.tutor_id FOR UPDATE;
 PERFORM 1 FROM public.bookings WHERE id=j.booking_id FOR NO KEY UPDATE;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE id=j.connection_id FOR UPDATE;
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.state NOT IN('claimed','dispatched') OR j.claim_until<=clock_timestamp() OR j.fingerprint IS DISTINCT FROM p_config THEN RETURN; END IF;
 IF c.state<>'active' OR c.generation<>j.generation OR c.fingerprint<>p_config
 OR NOT public.google_meet_booking_current(j.booking_id) OR EXISTS(SELECT 1 FROM public.booking_meeting_links m WHERE m.booking_id=j.booking_id) THEN
  UPDATE public.booking_meeting_provisioning SET state='suppressed',failure_code='outdated',claim_until=NULL WHERE id=p_id;
  RETURN;
 END IF;
 IF c.busy_token IS NOT NULL AND c.busy_token<>p_token AND c.busy_until>clock_timestamp() THEN
  UPDATE public.booking_meeting_provisioning SET state='pending',attempts=greatest(0,attempts-1),claim_token=NULL,claim_until=NULL,next_attempt_at=clock_timestamp()+interval '10 seconds' WHERE id=p_id;
  RETURN;
 END IF;
 UPDATE public.tutor_google_meet_connections SET busy_token=p_token,busy_until=j.claim_until WHERE id=c.id;
 IF p_dispatch THEN
  IF j.state<>'claimed' OR j.space_name IS NOT NULL THEN RETURN; END IF;
  UPDATE public.booking_meeting_provisioning SET state='dispatched',dispatched_at=clock_timestamp() WHERE id=p_id;
 END IF;
 RETURN QUERY SELECT c.id,c.user_id,c.google_subject,c.refresh_ciphertext,j.space_name,j.meeting_uri;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_receipt(p_id uuid,p_token uuid,p_name text,p_uri text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.booking_meeting_provisioning;
BEGIN
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.dispatched_at IS NULL THEN RETURN false; END IF;
 IF j.space_name IS NOT NULL THEN RETURN (j.space_name,j.meeting_uri) IS NOT DISTINCT FROM (p_name,p_uri); END IF;
 UPDATE public.booking_meeting_provisioning SET space_name=p_name,meeting_uri=p_uri,
 state=CASE WHEN (state='uncertain' OR (state='dispatched' AND claim_until<=clock_timestamp())) THEN 'pending' ELSE state END
 WHERE id=p_id;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_install(p_id uuid,p_token uuid,p_config text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.booking_meeting_provisioning;c public.tutor_google_meet_connections;
BEGIN
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id;
 IF j.id IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM public.tutor_profiles WHERE id=j.tutor_id FOR UPDATE;
 PERFORM 1 FROM public.bookings WHERE id=j.booking_id FOR NO KEY UPDATE;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE id=j.connection_id FOR UPDATE;
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id FOR UPDATE;
 IF j.state='ready' THEN RETURN j.claim_token=p_token; END IF;
 IF j.claim_token IS DISTINCT FROM p_token OR j.claim_until<=clock_timestamp() OR j.state NOT IN('claimed','dispatched') OR j.fingerprint IS DISTINCT FROM p_config OR j.space_name IS NULL THEN RETURN false; END IF;
 IF c.state<>'active' OR c.generation<>j.generation OR c.fingerprint<>p_config OR c.busy_token IS DISTINCT FROM p_token
 OR NOT public.google_meet_booking_current(j.booking_id) OR EXISTS(SELECT 1 FROM public.booking_meeting_links m WHERE m.booking_id=j.booking_id) THEN
  UPDATE public.booking_meeting_provisioning SET state='suppressed',failure_code='outdated',claim_until=NULL WHERE id=p_id;
  RETURN false;
 END IF;
 INSERT INTO public.booking_meeting_links(booking_id,provider,url,revision,request_id,updated_by_user_id,updated_at,actor_kind,automation_job_id)
 VALUES(j.booking_id,'google_meet',j.meeting_uri,1,j.id,NULL,clock_timestamp(),'system',j.id);
 INSERT INTO public.booking_meeting_link_events(booking_id,revision,request_id,actor_user_id,created_at,actor_kind,automation_job_id)
 VALUES(j.booking_id,1,j.id,NULL,clock_timestamp(),'system',j.id);
 UPDATE public.booking_meeting_provisioning SET state='ready',claim_until=NULL,failure_code=NULL WHERE id=p_id;
 UPDATE public.tutor_google_meet_connections SET busy_token=NULL,busy_until=NULL WHERE id=c.id AND busy_token=p_token;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_fail(p_id uuid,p_token uuid,p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.booking_meeting_provisioning;c public.tutor_google_meet_connections;
BEGIN
 IF p_code NOT IN('refresh_rejected','refresh_unavailable','create_rejected','rate_limited','uncertain','credential') THEN RAISE EXCEPTION 'Invalid failure' USING ERRCODE='23514'; END IF;
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id;
 IF j.id IS NULL THEN RETURN; END IF;
 SELECT * INTO c FROM public.tutor_google_meet_connections WHERE id=j.connection_id FOR UPDATE;
 SELECT * INTO j FROM public.booking_meeting_provisioning WHERE id=p_id FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.state NOT IN('claimed','dispatched') THEN RETURN; END IF;
 UPDATE public.booking_meeting_provisioning SET state=CASE
 WHEN p_code='uncertain' OR (j.dispatched_at IS NOT NULL AND p_code NOT IN('rate_limited','create_rejected')) THEN 'uncertain'
 WHEN p_code IN('refresh_unavailable','rate_limited') AND j.attempts<5 THEN 'pending'
 ELSE 'blocked' END,
 failure_code=p_code,claim_until=NULL,
 dispatched_at=CASE WHEN p_code='rate_limited' THEN NULL ELSE dispatched_at END,
 next_attempt_at=clock_timestamp()+interval '60 seconds'
 WHERE id=p_id;
 IF p_code='refresh_rejected' AND c.generation=j.generation THEN
  UPDATE public.tutor_google_meet_connections SET state='reconnect',refresh_ciphertext=NULL WHERE id=c.id;
 END IF;
 UPDATE public.tutor_google_meet_connections SET busy_token=NULL,busy_until=NULL WHERE id=c.id AND busy_token=p_token;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_job_status(p_user text,p_session text,p_booking uuid,p_config text)
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN j.state IN('pending','claimed','dispatched') AND c.state='active' AND c.generation=j.generation AND c.fingerprint=p_config THEN 'preparing' ELSE 'action_required' END
 FROM public.booking_meeting_provisioning j JOIN public.tutor_google_meet_connections c ON c.id=j.connection_id WHERE j.booking_id=p_booking
 AND public.booking_workflow_participant(p_user,p_session,p_booking)
 AND public.google_meet_booking_current(p_booking); $$;
--> statement-breakpoint
CREATE FUNCTION public.google_meet_system_actor_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 -- A normal manual replacement resets current provenance, retaining the old event.
 IF TG_OP='UPDATE' AND current_user='learli_app' THEN NEW.actor_kind:='human';NEW.automation_job_id:=NULL; END IF;
 IF NEW.actor_kind='system' AND current_user<>(SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=TG_TABLE_NAME) THEN
  RAISE EXCEPTION 'System provenance requires scoped installation' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER google_meet_link_actor BEFORE INSERT OR UPDATE ON public.booking_meeting_links FOR EACH ROW EXECUTE FUNCTION public.google_meet_system_actor_guard();
--> statement-breakpoint
CREATE TRIGGER google_meet_event_actor BEFORE INSERT ON public.booking_meeting_link_events FOR EACH ROW EXECUTE FUNCTION public.google_meet_system_actor_guard();
--> statement-breakpoint
-- Explicit grants survive runtimeGrantsSql's table revocation, without token SELECT.
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'google_meet_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,learli_app',f);
 END LOOP;
END $$;

