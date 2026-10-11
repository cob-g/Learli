CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "subjects_slug_format" CHECK ("subjects"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "subjects_name_length" CHECK (char_length("subjects"."name") BETWEEN 2 AND 60),
	CONSTRAINT "subjects_category_allowed" CHECK ("subjects"."category" IN ('academic_core', 'test_prep', 'academic_support', 'specialized'))
);
--> statement-breakpoint
CREATE TABLE "tutor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"teaching_background" text NOT NULL,
	"timezone" text NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "tutor_profiles_review_status_allowed" CHECK ("tutor_profiles"."review_status" IN ('pending', 'approved', 'rejected', 'suspended')),
	CONSTRAINT "tutor_profiles_headline_length" CHECK (char_length("tutor_profiles"."headline") BETWEEN 1 AND 100),
	CONSTRAINT "tutor_profiles_bio_length" CHECK (char_length("tutor_profiles"."bio") BETWEEN 1 AND 1500),
	CONSTRAINT "tutor_profiles_background_length" CHECK (char_length("tutor_profiles"."teaching_background") BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "tutor_subjects" (
	"tutor_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"levels" text[] NOT NULL,
	"specialty" text,
	CONSTRAINT "tutor_subjects_tutor_id_subject_id_pk" PRIMARY KEY("tutor_id","subject_id"),
	CONSTRAINT "tutor_subjects_levels_allowed" CHECK (cardinality("tutor_subjects"."levels") BETWEEN 1 AND 4 AND "tutor_subjects"."levels" <@ ARRAY['elementary', 'middle_school', 'high_school', 'college_support']::text[]),
	CONSTRAINT "tutor_subjects_specialty_length" CHECK ("tutor_subjects"."specialty" IS NULL OR char_length("tutor_subjects"."specialty") BETWEEN 1 AND 120)
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_action_allowed";--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "target_subject_id" uuid;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_name_unique" ON "subjects" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "tutor_profiles_review_status_idx" ON "tutor_profiles" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "tutor_subjects_subject_idx" ON "tutor_subjects" USING btree ("subject_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_target_subject_id_subjects_id_fk" FOREIGN KEY ("target_subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_action_allowed" CHECK ("audit_events"."action" IN ('account.created', 'account.updated', 'fixture.roles_granted', 'tutor_profile.submitted', 'tutor_profile.updated', 'tutor_review.approved', 'tutor_review.rejected', 'tutor_review.suspended', 'tutor_review.reinstated', 'tutor_review.reopened', 'subject.created', 'subject.activated', 'subject.deactivated'));