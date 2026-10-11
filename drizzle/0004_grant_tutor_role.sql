-- The runtime role cannot write user_roles. This function is the one narrow
-- exception: it can add the non-privileged 'tutor' role and no other.
CREATE FUNCTION "grant_tutor_role"("target_user_id" text) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
	WITH granted AS (
		INSERT INTO public.user_roles (user_id, role)
		VALUES (target_user_id, 'tutor')
		ON CONFLICT DO NOTHING
		RETURNING 1
	)
	SELECT EXISTS (SELECT 1 FROM granted)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "grant_tutor_role"(text) FROM PUBLIC;
