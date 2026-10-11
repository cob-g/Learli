CREATE TABLE "guardian_learner_links" (
	"guardian_user_id" text NOT NULL,
	"learner_id" uuid NOT NULL,
	"management" text DEFAULT 'guardian' NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_learner_links_guardian_user_id_learner_id_pk" PRIMARY KEY("guardian_user_id","learner_id"),
	CONSTRAINT "guardian_learner_links_management" CHECK ("guardian_learner_links"."management" = 'guardian'),
	CONSTRAINT "guardian_learner_links_source" CHECK ("guardian_learner_links"."source" = 'local_fixture'),
	CONSTRAINT "guardian_learner_links_status" CHECK ("guardian_learner_links"."status" IN ('authorized', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_key" text NOT NULL,
	"source" text NOT NULL,
	"management" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"level" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_profiles_fixture_key_unique" UNIQUE("fixture_key"),
	CONSTRAINT "learner_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "learner_profiles_id_management_unique" UNIQUE("id","management"),
	CONSTRAINT "learner_profiles_source" CHECK ("learner_profiles"."source" = 'local_fixture'),
	CONSTRAINT "learner_profiles_management" CHECK (("learner_profiles"."management" = 'guardian' AND "learner_profiles"."user_id" IS NULL) OR ("learner_profiles"."management" = 'self' AND "learner_profiles"."user_id" IS NOT NULL AND "learner_profiles"."level" = 'college_support')),
	CONSTRAINT "learner_profiles_status" CHECK ("learner_profiles"."status" IN ('active', 'inactive')),
	CONSTRAINT "learner_profiles_name" CHECK (char_length(btrim("learner_profiles"."display_name")) BETWEEN 1 AND 80 AND "learner_profiles"."display_name" = btrim("learner_profiles"."display_name")),
	CONSTRAINT "learner_profiles_level" CHECK ("learner_profiles"."level" IN ('elementary', 'middle_school', 'high_school', 'college_support')),
	CONSTRAINT "learner_profiles_timezone" CHECK (char_length("learner_profiles"."timezone") BETWEEN 1 AND 100 AND ("learner_profiles"."timezone" = 'UTC' OR "learner_profiles"."timezone" ~ '^[A-Za-z_]+/[A-Za-z_+/-]+$'))
);
--> statement-breakpoint
ALTER TABLE "guardian_learner_links" ADD CONSTRAINT "guardian_learner_links_guardian_user_id_user_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_learner_links" ADD CONSTRAINT "guardian_learner_links_learner_id_management_learner_profiles_id_management_fk" FOREIGN KEY ("learner_id","management") REFERENCES "public"."learner_profiles"("id","management") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardian_learner_links_learner_idx" ON "guardian_learner_links" USING btree ("learner_id");