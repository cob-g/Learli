CREATE TABLE public.support_dispatch_grants (
  dispatcher_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source='local_fixture'),
  status text NOT NULL CHECK (status IN ('authorized','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(dispatcher_user_id,case_id)
);
--> statement-breakpoint
CREATE TABLE public.support_reviewer_choices (
  case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE RESTRICT,
  reviewer_user_id text NOT NULL REFERENCES public.support_reviewers(user_id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source='local_fixture'),
  status text NOT NULL CHECK (status IN ('authorized','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(case_id,reviewer_user_id)
);
--> statement-breakpoint
CREATE TABLE public.support_dispatch_grant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('dispatcher','reviewer_choice')),
  action text NOT NULL CHECK (action IN ('authorized','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE public.support_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL, expected_revision integer NOT NULL, revision integer NOT NULL,
  kind text NOT NULL,
  previous_reviewer_id text REFERENCES public.support_reviewers(user_id) ON DELETE RESTRICT,
  next_reviewer_id text NOT NULL REFERENCES public.support_reviewers(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_assignment_events_request UNIQUE(actor_user_id,request_key),
  CONSTRAINT support_assignment_events_revision UNIQUE(case_id,revision),
  CONSTRAINT support_assignment_events_history_fk FOREIGN KEY(case_id,revision) REFERENCES public.support_case_events(case_id,revision) ON DELETE RESTRICT,
  CONSTRAINT support_assignment_events_revision_valid CHECK(expected_revision>=0 AND revision=expected_revision+1),
  CONSTRAINT support_assignment_events_shape CHECK ((actor_user_id<>next_reviewer_id AND ((kind='assign' AND previous_reviewer_id IS NULL) OR (kind IN ('reassign','escalate') AND previous_reviewer_id IS NOT NULL AND previous_reviewer_id<>next_reviewer_id))) IS TRUE)
);
--> statement-breakpoint
CREATE INDEX support_assignment_events_case_idx ON public.support_assignment_events(case_id,revision);
--> statement-breakpoint
CREATE FUNCTION public.change_local_support_assignment(
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
    WHERE s.id=p_session AND s.user_id=p_actor AND s.expires_at>v_now AND u.email_verified
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
REVOKE ALL ON FUNCTION public.change_local_support_assignment(text,text,uuid,integer,text,text,uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.reject_support_dispatch_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Support assignment history is append-only.' USING ERRCODE='55000'; END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reject_support_dispatch_history_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER support_assignment_history_immutable BEFORE UPDATE OR DELETE ON public.support_assignment_events
FOR EACH ROW EXECUTE FUNCTION public.reject_support_dispatch_history_change();
--> statement-breakpoint
CREATE TRIGGER support_dispatch_grant_history_immutable BEFORE UPDATE OR DELETE ON public.support_dispatch_grant_events
FOR EACH ROW EXECUTE FUNCTION public.reject_support_dispatch_history_change();
