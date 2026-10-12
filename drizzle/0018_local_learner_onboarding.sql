CREATE TABLE public.learner_creation_events (
  actor_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  learner_id uuid NOT NULL UNIQUE REFERENCES public.learner_profiles(id) ON DELETE RESTRICT,
  management text NOT NULL CHECK (management IN ('guardian','self')),
  origin text NOT NULL DEFAULT 'local_creation' CHECK (origin='local_creation'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id,request_id)
);
--> statement-breakpoint
CREATE INDEX learner_creation_events_actor_idx ON public.learner_creation_events(actor_user_id,management);
--> statement-breakpoint
CREATE FUNCTION public.create_local_learner(
  p_actor text, p_session text, p_request uuid, p_management text,
  p_name text, p_level text, p_zone text
) RETURNS TABLE(outcome text, learner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_previous public.learner_creation_events%ROWTYPE;
  v_fingerprint text;
  v_id uuid;
  v_now timestamptz;
BEGIN
  -- Actor lock bounds concurrent creation and capacity; compatible with FK checks.
  PERFORM 1 FROM public."user" u WHERE u.id=p_actor FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid; RETURN;
  END IF;
  PERFORM 1 FROM public.session s WHERE s.id=p_session AND s.user_id=p_actor FOR SHARE;
  -- New READ COMMITTED command snapshot after every identity/domain wait.
  v_now := clock_timestamp();
  IF NOT EXISTS (
    SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id
    JOIN public.user_access a ON a.user_id=u.id
    WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now
      AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor
        AND ((p_management='guardian' AND r.role='parent') OR (p_management='self' AND r.role='student')))
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid; RETURN;
  END IF;
  IF p_request IS NULL OR p_name IS NULL OR p_name<>btrim(p_name)
    OR p_name ~ '^[[:space:]]|[[:space:]]$' OR char_length(p_name) NOT BETWEEN 1 AND 80
    OR NOT (p_level IN ('elementary','middle_school','high_school','college_support')) IS TRUE
    OR (p_management='self' AND p_level<>'college_support')
    OR p_zone IS NULL OR char_length(p_zone) NOT BETWEEN 1 AND 64 OR p_zone ~* '^etc/'
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_zone)
    OR NOT (p_zone='UTC' OR p_zone ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$') THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_array(p_management,p_name,p_level,p_zone)::text,'UTF8')),'hex');
  SELECT e.* INTO v_previous FROM public.learner_creation_events e
    WHERE e.actor_user_id=p_actor AND e.request_id=p_request;
  IF FOUND THEN
    IF v_previous.fingerprint<>v_fingerprint THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
    ELSE
      RETURN QUERY SELECT 'replayed'::text, v_previous.learner_id;
    END IF;
    RETURN;
  END IF;
  IF p_management='self' AND EXISTS (SELECT 1 FROM public.learner_profiles l WHERE l.user_id=p_actor) THEN
    RETURN QUERY SELECT 'exists'::text, NULL::uuid; RETURN;
  END IF;
  IF p_management='guardian' AND (SELECT count(*) FROM public.learner_creation_events e
    WHERE e.actor_user_id=p_actor AND e.management='guardian')>=20 THEN
    RETURN QUERY SELECT 'capacity'::text, NULL::uuid; RETURN;
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO public.learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone,created_at,updated_at)
    VALUES(v_id,'local-created:' || v_id::text,'local_fixture',p_management,
      CASE WHEN p_management='self' THEN p_actor ELSE NULL END,p_name,p_level,p_zone,v_now,v_now);
  IF p_management='guardian' THEN
    INSERT INTO public.guardian_learner_links(guardian_user_id,learner_id,source,status,created_at,updated_at)
      VALUES(p_actor,v_id,'local_fixture','authorized',v_now,v_now);
  END IF;
  INSERT INTO public.learner_creation_events(actor_user_id,request_id,fingerprint,learner_id,management,created_at)
    VALUES(p_actor,p_request,v_fingerprint,v_id,p_management,v_now);
  RETURN QUERY SELECT 'created'::text, v_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_local_learner(text,text,uuid,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.reject_learner_creation_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Local creation history is append-only.' USING ERRCODE='55000'; END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reject_learner_creation_history_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER learner_creation_history_immutable BEFORE UPDATE OR DELETE ON public.learner_creation_events
FOR EACH ROW EXECUTE FUNCTION public.reject_learner_creation_history_change();
