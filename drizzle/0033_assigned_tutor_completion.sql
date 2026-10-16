ALTER TABLE "booking_workflow_policies" DROP CONSTRAINT "booking_workflow_policy_shape";--> statement-breakpoint
ALTER TABLE "booking_workflow_policies" ADD CONSTRAINT "booking_workflow_policy_shape" CHECK ((("booking_workflow_policies"."version"='synthetic-booking-v1' AND "booking_workflow_policies"."reference"='synthetic:booking:v1') OR ("booking_workflow_policies"."version"='synthetic-booking-v2' AND "booking_workflow_policies"."reference"='synthetic:booking:v2')) AND "booking_workflow_policies"."content_digest" ~ '^[a-f0-9]{64}$');
--> statement-breakpoint
-- Preserve immutable v1 terms and all existing function ownership/ACLs.
CREATE OR REPLACE FUNCTION public.booking_workflow_policy_current(p_policy uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.booking_workflow_policy_head h JOIN public.booking_workflow_policies p ON p.id=h.policy_id WHERE h.source='synthetic_readiness' AND h.enabled AND p.id=p_policy AND p.terms->>'authority'='synthetic_test' AND p.terms->>'source'='synthetic_readiness' AND p.terms->>'version'=p.version AND p.terms->>'reference'=p.reference AND p.terms->>'contentDigest'=p.content_digest AND p.terms->>'policyId'=p.id::text AND p.terms->>'durationMinutes'='60' AND p.terms->>'stepMinutes'='30' AND p.terms->>'noticeMinutes'='60' AND p.terms->>'horizonDays'='14' AND p.terms->>'provisionalMinutes'='10' AND p.terms->>'cancelCutoffMinutes'='60' AND p.terms->>'moveCutoffMinutes'='60' AND p.terms->>'confirmationPrerequisite'='synthetic_prerequisite_review' AND p.terms->>'confirmationActor'='assigned_mfa_admin' AND p.terms->>'outcomeActor'='assigned_mfa_admin' AND (p.version='synthetic-booking-v1' OR (p.version='synthetic-booking-v2' AND p.terms->>'completionActor'='assigned_tutor')) AND p.terms->>'disputePath'='/support' AND p.terms->>'meetingAccess'='confirmed_until_end'); $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_booking_workflow_task(p_actor text,p_session text,p_booking uuid,p_action text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.bookings b
  JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id
  JOIN public.tutor_profiles t ON t.id=b.tutor_id
  WHERE b.id=p_booking AND b.source='synthetic_readiness' AND (
   (p_action='complete' AND p.version='synthetic-booking-v2'
    AND p.terms->>'completionActor'='assigned_tutor'
    AND b.state IN('confirmed','completed') AND t.user_id=p_actor
    AND public.admission_identity(p_actor,p_session)
    AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_actor AND r.role='tutor')
    AND public.booking_workflow_policy_current(p.id)
    AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
    AND public.booking_workflow_tutor_current(t.id,b.learner_id,b.subject_id,false))
   OR
   ((p_action<>'complete' OR p.version='synthetic-booking-v1')
    AND public.has_admin_assurance(p_actor,p_session,28800)
    AND b.booked_by_user_id<>p_actor AND t.user_id<>p_actor
    AND EXISTS(SELECT 1 FROM public.booking_workflow_grants g
      WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=p_actor
        AND g.action=p_action AND g.active AND g.valid_until>clock_timestamp()))
  )
 );
$$;
