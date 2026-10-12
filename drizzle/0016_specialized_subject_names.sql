ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "name_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated', 'subject.renamed'));--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_name_revision_valid" CHECK ("subjects"."name_revision" >= 0);
--> statement-breakpoint
CREATE FUNCTION public.guard_subject_name_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.category IS DISTINCT FROM OLD.category THEN
    RAISE EXCEPTION 'Subject references are fixed.' USING ERRCODE = '23514';
  END IF;
  IF NEW.name_revision IS DISTINCT FROM OLD.name_revision THEN
    RAISE EXCEPTION 'Subject name revision is database-owned.' USING ERRCODE = '23514';
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    IF OLD.category <> 'specialized' THEN
      RAISE EXCEPTION 'Launch subject names are fixed.' USING ERRCODE = '23514';
    END IF;
    NEW.name_revision := OLD.name_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_subject_name_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER subjects_name_change_guard BEFORE UPDATE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.guard_subject_name_change();
