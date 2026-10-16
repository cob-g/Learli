// Additional private-test scope. Existing domain authorization remains mandatory.
import { sql, type SQL } from "drizzle-orm";
import type { PrivateWorkflowPacket } from "./config";

export function privateActorPredicate(
  packet: PrivateWorkflowPacket | null | undefined,
  userId: SQL,
) {
  return packet
    ? sql`EXISTS(SELECT 1 FROM public."user" member WHERE member.id=${userId} AND member.email IN(SELECT jsonb_array_elements_text(${JSON.stringify(packet.accountEmails)}::jsonb)))`
    : sql`true`;
}

export function privateTutorPredicate(
  packet: PrivateWorkflowPacket | null | undefined,
  tutorId: SQL,
) {
  if (!packet) return sql`true`;
  return sql`EXISTS(SELECT 1 FROM public.tutor_profiles private_tutor
    JOIN public."user" private_user ON private_user.id=private_tutor.user_id
    JOIN public.tutor_screening_cases private_case ON private_case.tutor_id=private_tutor.id
    JOIN public.tutor_screening_policy_heads private_head ON private_head.provenance=private_case.provenance AND private_head.version=private_case.policy_version AND private_head.status='enabled'
    JOIN public.tutor_screening_policies private_policy ON private_policy.provenance=private_case.provenance AND private_policy.version=private_case.policy_version
    WHERE private_tutor.id=${tutorId} AND private_user.email IN(SELECT jsonb_array_elements_text(${JSON.stringify(packet.accountEmails)}::jsonb))
      AND private_case.provenance='synthetic_readiness' AND private_case.policy_version=${packet.screening.version}
      AND private_policy.reference=${packet.screening.reference}
      AND private_policy.authority_reference=${packet.screening.authorityReference}
      AND private_policy.required_check_codes=ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(packet.screening.requiredCheckCodes)}::jsonb))
      AND private_policy.allowed_actions=ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(packet.screening.allowedActions)}::jsonb))
      AND private_policy.expiry_rule=${packet.screening.expiryRule}
      AND private_policy.valid_from=${packet.screening.validFrom}::timestamptz
      AND private_policy.valid_until=${packet.screening.validUntil}::timestamptz
      AND private_policy.valid_from<=clock_timestamp() AND private_policy.valid_until>clock_timestamp())`;
}

/** Booking participant reads and post-mutation receipts share the finite audience. */
export function privateBookingPredicate(
  packet: PrivateWorkflowPacket | null | undefined,
  bookingId: SQL,
) {
  if (!packet) return sql`true`;
  return sql`EXISTS(SELECT 1 FROM public.bookings private_booking
    WHERE private_booking.id=${bookingId} AND private_booking.source='synthetic_readiness'
      AND private_booking.workflow_policy_id=${packet.booking.policyId}::uuid
      AND private_booking.admission_policy_id=${packet.admission.policyId}::uuid
      AND ${privateActorPredicate(packet, sql`private_booking.booked_by_user_id`)}
      AND ${privateTutorPredicate(packet, sql`private_booking.tutor_id`)})`;
}
