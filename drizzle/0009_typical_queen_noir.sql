CREATE TABLE "tutor_availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"start_at_utc" timestamp with time zone NOT NULL,
	"end_at_utc" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_time_off_interval_valid" CHECK (isfinite("tutor_availability_exceptions"."start_at_utc") AND isfinite("tutor_availability_exceptions"."end_at_utc") AND "tutor_availability_exceptions"."end_at_utc" > "tutor_availability_exceptions"."start_at_utc" AND "tutor_availability_exceptions"."start_at_utc" >= '0100-01-01'::timestamptz AND "tutor_availability_exceptions"."end_at_utc" < '10000-01-01'::timestamptz)
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "tutor_availability_exceptions" ADD CONSTRAINT "tutor_availability_exceptions_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_time_off_start_idx" ON "tutor_availability_exceptions" USING btree ("tutor_id","start_at_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_time_off_interval_unique" ON "tutor_availability_exceptions" USING btree ("tutor_id","start_at_utc","end_at_utc");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated'));