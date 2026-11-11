CREATE TABLE "tutor_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"byte_size" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	CONSTRAINT "tutor_photos_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "tutor_photos_status_allowed" CHECK ("tutor_photos"."status" IN ('pending', 'approved', 'rejected', 'replaced', 'removed')),
	CONSTRAINT "tutor_photos_object_key_format" CHECK ("tutor_photos"."object_key" ~ '^tutor-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'),
	CONSTRAINT "tutor_photos_byte_size_valid" CHECK ("tutor_photos"."byte_size" BETWEEN 1 AND 1048576),
	CONSTRAINT "tutor_photos_review_recorded" CHECK (("tutor_photos"."status" <> 'pending' OR "tutor_photos"."reviewed_at" IS NULL) AND ("tutor_photos"."status" NOT IN ('approved', 'rejected') OR "tutor_photos"."reviewed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "tutor_photos" ADD CONSTRAINT "tutor_photos_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_photos" ADD CONSTRAINT "tutor_photos_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_photos_tutor_idx" ON "tutor_photos" USING btree ("tutor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_photos_one_pending" ON "tutor_photos" USING btree ("tutor_id") WHERE "tutor_photos"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_photos_one_approved" ON "tutor_photos" USING btree ("tutor_id") WHERE "tutor_photos"."status" = 'approved';--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_role.self_granted', 'parent_role.self_granted', 'student_role.self_granted', 'local_workflow.staff_authorized', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_availability.updated', 'tutor_time_off.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated', 'subject.renamed', 'google_meet.connected', 'google_meet.disconnected', 'tutor_photo.submitted', 'tutor_photo.removed', 'tutor_photo.approved', 'tutor_photo.rejected'));