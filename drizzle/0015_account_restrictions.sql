CREATE TABLE "account_restriction_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"expected_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"previous_status" text NOT NULL,
	"next_status" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_restriction_events_request" UNIQUE("actor_user_id","request_key"),
	CONSTRAINT "account_restriction_events_revision" UNIQUE("target_user_id","revision"),
	CONSTRAINT "account_restriction_events_revision_valid" CHECK ("account_restriction_events"."expected_revision" >= 0 AND "account_restriction_events"."revision" = "account_restriction_events"."expected_revision" + 1),
	CONSTRAINT "account_restriction_events_not_self" CHECK ("account_restriction_events"."actor_user_id" <> "account_restriction_events"."target_user_id"),
	CONSTRAINT "account_restriction_events_shape" CHECK ((("account_restriction_events"."previous_status" = 'active' AND "account_restriction_events"."next_status" = 'suspended' AND "account_restriction_events"."reason" IN ('local_access_test','local_review_test')) OR ("account_restriction_events"."previous_status" = 'suspended' AND "account_restriction_events"."next_status" = 'active' AND "account_restriction_events"."reason" = 'local_restore_test')) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "account_restriction_grant_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_restriction_grant_events_action" CHECK ("account_restriction_grant_events"."action" IN ('authorized','revoked'))
);
--> statement-breakpoint
CREATE TABLE "account_restriction_grants" (
	"staff_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_restriction_grants_staff_user_id_target_user_id_pk" PRIMARY KEY("staff_user_id","target_user_id"),
	CONSTRAINT "account_restriction_grants_not_self" CHECK ("account_restriction_grants"."staff_user_id" <> "account_restriction_grants"."target_user_id"),
	CONSTRAINT "account_restriction_grants_status" CHECK ("account_restriction_grants"."status" IN ('authorized','revoked'))
);
--> statement-breakpoint
CREATE TABLE "account_restriction_targets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_restriction_targets_source" CHECK ("account_restriction_targets"."source" = 'local_fixture'),
	CONSTRAINT "account_restriction_targets_revision" CHECK ("account_restriction_targets"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "account_restriction_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_events" ADD CONSTRAINT "account_restriction_events_target_user_id_account_restriction_targets_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."account_restriction_targets"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_grant_events" ADD CONSTRAINT "account_restriction_grant_events_staff_user_id_target_user_id_account_restriction_grants_staff_user_id_target_user_id_fk" FOREIGN KEY ("staff_user_id","target_user_id") REFERENCES "public"."account_restriction_grants"("staff_user_id","target_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD CONSTRAINT "account_restriction_grants_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_grants" ADD CONSTRAINT "account_restriction_grants_target_user_id_account_restriction_targets_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."account_restriction_targets"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restriction_targets" ADD CONSTRAINT "account_restriction_targets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_restriction_events_target_idx" ON "account_restriction_events" USING btree ("target_user_id","revision");
--> statement-breakpoint
CREATE FUNCTION public.change_local_account_access(
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
    WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>clock_timestamp()
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
    WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
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
REVOKE ALL ON FUNCTION public.change_local_account_access(text,text,text,integer,text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.reject_account_restriction_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Restriction history is append-only.' USING ERRCODE='55000'; END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reject_account_restriction_history_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER account_restriction_history_immutable BEFORE UPDATE OR DELETE ON public.account_restriction_events
FOR EACH ROW EXECUTE FUNCTION public.reject_account_restriction_history_change();
--> statement-breakpoint
CREATE TRIGGER account_restriction_grant_history_immutable BEFORE UPDATE OR DELETE ON public.account_restriction_grant_events
FOR EACH ROW EXECUTE FUNCTION public.reject_account_restriction_history_change();
