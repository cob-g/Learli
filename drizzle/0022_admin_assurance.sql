CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "admin_assurance_receipts" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"factor_id" text NOT NULL,
	"epoch" integer NOT NULL,
	"role_granted_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	CONSTRAINT "admin_assurance_epoch_positive" CHECK ("admin_assurance_receipts"."epoch" > 0),
	CONSTRAINT "admin_assurance_method" CHECK ("admin_assurance_receipts"."method" IN ('totp','backup_code'))
);
--> statement-breakpoint
CREATE TABLE "admin_security_epochs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"epoch" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "admin_security_epoch_positive" CHECK ("admin_security_epochs"."epoch" > 0)
);
--> statement-breakpoint
CREATE TABLE "admin_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_security_action" CHECK ("admin_security_events"."action" IN ('factor_change_started','factor_verified'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assurance_receipts" ADD CONSTRAINT "admin_assurance_receipts_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assurance_receipts" ADD CONSTRAINT "admin_assurance_receipts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_security_epochs" ADD CONSTRAINT "admin_security_epochs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_security_events" ADD CONSTRAINT "admin_security_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");
--> statement-breakpoint
-- Current assurance is never implied by password, role, enrollment flag or session age.
CREATE FUNCTION public.has_admin_assurance(p_user text,p_session text,p_age integer DEFAULT 28800)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT p_age BETWEEN 1 AND 28800 AND EXISTS (
 SELECT 1 FROM public.admin_assurance_receipts r
 JOIN public.session s ON s.id=r.session_id AND s.user_id=r.user_id
 JOIN public."user" u ON u.id=r.user_id AND u.email_verified AND u.two_factor_enabled=true
 JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
 JOIN public.user_roles g ON g.user_id=u.id AND g.role='admin' AND g.granted_at=r.role_granted_at
 JOIN public.admin_security_epochs e ON e.user_id=u.id AND e.epoch=r.epoch
 JOIN public.two_factor f ON f.user_id=u.id AND f.id=r.factor_id AND f.verified=true
 WHERE r.user_id=p_user AND r.session_id=p_session AND s.expires_at>clock_timestamp()
 AND r.verified_at<=clock_timestamp() AND r.verified_at>clock_timestamp()-make_interval(secs=>p_age)
 ); $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_admin_assurance(text,text,integer) FROM PUBLIC;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.change_local_account_access(
  p_actor text, p_session text, p_target text, p_expected integer,
  p_next text, p_reason text, p_key uuid
) RETURNS TABLE(outcome text, revision integer, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_revision integer;
  v_status text;
  v_previous public.account_restriction_events%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_expected IS NULL OR p_expected < 0 OR p_expected >= 2147483647 OR p_key IS NULL
     OR NOT ((p_next = 'suspended' AND p_reason IN ('local_access_test','local_review_test'))
          OR (p_next = 'active' AND p_reason = 'local_restore_test')) IS TRUE THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp()
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT t.revision INTO v_revision FROM public.account_restriction_targets t
    WHERE t.user_id=p_target AND t.source='local_fixture' FOR UPDATE;
  IF NOT FOUND OR p_actor=p_target THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT a.status INTO v_status FROM public.user_access a
    WHERE a.user_id=p_target FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  -- Serialize a replay key even when two requests name different targets.
  PERFORM pg_advisory_xact_lock(hashtextextended('restriction-request:' || p_actor || ':' || p_key::text,0));
  PERFORM 1 FROM public.account_restriction_grants g
    WHERE g.staff_user_id=p_actor AND g.target_user_id=p_target AND g.status='authorized' FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public."user" u WHERE u.id=p_target AND u.email LIKE '%.test')
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_target AND r.role='admin') THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  v_now := clock_timestamp();
  -- Fresh READ COMMITTED command snapshot after every domain/grant wait.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT e.* INTO v_previous FROM public.account_restriction_events e
    WHERE e.actor_user_id=p_actor AND e.request_key=p_key;
  IF FOUND THEN
    IF v_previous.target_user_id<>p_target OR v_previous.expected_revision<>p_expected
      OR v_previous.next_status<>p_next OR v_previous.reason<>p_reason THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::integer, NULL::text;
    ELSE
      RETURN QUERY SELECT 'replayed'::text, v_previous.revision, v_previous.next_status;
    END IF;
    RETURN;
  END IF;
  IF v_revision<>p_expected OR v_status=p_next THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::integer, NULL::text; RETURN;
  END IF;
  UPDATE public.user_access SET status=p_next, updated_at=v_now WHERE user_id=p_target;
  UPDATE public.account_restriction_targets SET revision=v_revision+1 WHERE user_id=p_target;
  INSERT INTO public.account_restriction_events(actor_user_id,target_user_id,request_key,expected_revision,revision,previous_status,next_status,reason,created_at)
    VALUES(p_actor,p_target,p_key,p_expected,v_revision+1,v_status,p_next,p_reason,v_now);
  RETURN QUERY SELECT 'saved'::text, v_revision+1, p_next;
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.change_local_support_assignment(
  p_actor text,p_session text,p_case uuid,p_expected integer,p_reviewer text,p_kind text,p_key uuid
) RETURNS TABLE(outcome text,revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_case public.support_cases%ROWTYPE;
  v_previous text;
  v_receipt public.support_assignment_events%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR p_key IS NULL OR p_case IS NULL
    OR p_reviewer IS NULL OR char_length(p_reviewer) NOT BETWEEN 1 AND 128
    OR NOT (p_kind IN ('assign','reassign','escalate')) IS TRUE THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::integer; RETURN;
  END IF;
  -- Case lock is shared with reviewer status and owner assignment tooling.
  SELECT c.* INTO v_case FROM public.support_cases c WHERE c.id=p_case AND c.source='local_synthetic' FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('support-assignment-request:' || p_actor || ':' || p_key::text,0));
  v_now:=clock_timestamp();
  -- Separate commands acquire fresh READ COMMITTED snapshots after all domain waits.
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE public.has_admin_assurance(p_actor,p_session,28800) AND s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now AND u.email_verified
      AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' AND a.status='active'
      AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
  ) THEN RETURN QUERY SELECT 'forbidden'::text,NULL::integer; RETURN; END IF;
  IF p_actor=v_case.requester_user_id OR NOT EXISTS (
    SELECT 1 FROM public.support_dispatch_grants g WHERE g.dispatcher_user_id=p_actor AND g.case_id=p_case AND g.source='local_fixture' AND g.status='authorized'
  ) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  IF p_reviewer IN (p_actor,v_case.requester_user_id) OR NOT EXISTS (
    SELECT 1 FROM public.support_reviewer_choices choice JOIN public.support_reviewers r ON r.user_id=choice.reviewer_user_id
    JOIN public."user" u ON u.id=r.user_id JOIN public.user_access a ON a.user_id=u.id
    WHERE choice.case_id=p_case AND choice.reviewer_user_id=p_reviewer AND choice.source='local_fixture' AND choice.status='authorized'
      AND r.source='local_fixture' AND r.status='authorized' AND u.email_verified AND a.status='active'
      AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
      AND EXISTS(SELECT 1 FROM public.user_roles g WHERE g.user_id=u.id AND g.role='admin')
  ) THEN RETURN QUERY SELECT 'not_found'::text,NULL::integer; RETURN; END IF;
  SELECT e.* INTO v_receipt FROM public.support_assignment_events e WHERE e.actor_user_id=p_actor AND e.request_key=p_key;
  IF FOUND THEN
    IF v_receipt.case_id<>p_case OR v_receipt.expected_revision<>p_expected OR v_receipt.next_reviewer_id<>p_reviewer OR v_receipt.kind<>p_kind THEN
      RETURN QUERY SELECT 'conflict'::text,NULL::integer;
    ELSE RETURN QUERY SELECT 'replayed'::text,v_receipt.revision; END IF;
    RETURN;
  END IF;
  SELECT a.reviewer_user_id INTO v_previous FROM public.support_case_assignments a WHERE a.case_id=p_case;
  IF v_case.revision<>p_expected OR v_case.status='closed' OR v_previous=p_reviewer
    OR NOT ((p_kind='assign' AND v_previous IS NULL) OR (p_kind IN ('reassign','escalate') AND v_previous IS NOT NULL)) IS TRUE THEN
    RETURN QUERY SELECT 'conflict'::text,NULL::integer; RETURN;
  END IF;
  INSERT INTO public.support_case_assignments(case_id,reviewer_user_id,updated_at) VALUES(p_case,p_reviewer,v_now)
    ON CONFLICT(case_id) DO UPDATE SET reviewer_user_id=p_reviewer,updated_at=v_now;
  UPDATE public.support_cases SET revision=v_case.revision+1,updated_at=v_now WHERE id=p_case;
  INSERT INTO public.support_case_events(case_id,action,previous_reviewer_id,next_reviewer_id,revision,created_at)
    VALUES(p_case,CASE WHEN v_previous IS NULL THEN 'assigned' ELSE 'reassigned' END,v_previous,p_reviewer,v_case.revision+1,v_now);
  INSERT INTO public.support_assignment_events(case_id,actor_user_id,request_key,expected_revision,revision,kind,previous_reviewer_id,next_reviewer_id,created_at)
    VALUES(p_case,p_actor,p_key,p_expected,v_case.revision+1,p_kind,v_previous,p_reviewer,v_now);
  RETURN QUERY SELECT 'saved'::text,v_case.revision+1;
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.private_review_moderator_allowed(p_actor text,p_session text,p_review uuid) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.private_booking_reviews v
 JOIN public.bookings b ON b.id=v.booking_id
 JOIN public.tutor_profiles tp ON tp.id=b.tutor_id
 JOIN public."user" u ON u.id=p_actor AND u.email_verified AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
 JOIN public.user_access ua ON ua.user_id=u.id AND ua.status='active'
 JOIN public.session s ON s.user_id=u.id AND s.id=p_session AND s.expires_at>clock_timestamp()
 JOIN public.review_moderators m ON m.user_id=u.id AND m.source='local_fixture' AND m.status='authorized'
 JOIN public.review_moderator_grants g ON g.review_id=v.id AND g.moderator_user_id=u.id AND g.status='authorized'
 WHERE public.has_admin_assurance(p_actor,p_session,28800) AND v.id=p_review AND v.source='local_synthetic' AND v.author_user_id<>u.id AND tp.user_id<>u.id
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin'));
$$;
