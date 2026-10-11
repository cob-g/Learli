CREATE TABLE "tutor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"iso_weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "tutor_availability_weekday_valid" CHECK ("tutor_availability"."iso_weekday" BETWEEN 1 AND 7),
	CONSTRAINT "tutor_availability_minutes_valid" CHECK ("tutor_availability"."start_minute" BETWEEN 0 AND 1439 AND "tutor_availability"."end_minute" > "tutor_availability"."start_minute" AND "tutor_availability"."end_minute" <= "tutor_availability"."start_minute" + 1440)
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD COLUMN "availability_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_availability_window_unique" ON "tutor_availability" USING btree ("tutor_id","iso_weekday","start_minute","end_minute");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated'));--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_availability_version_valid" CHECK ("tutor_profiles"."availability_version" >= 0);