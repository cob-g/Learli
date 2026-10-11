-- Hand-edited from the generated statement: add the column nullable, give every
-- existing profile an opaque slug, then require it.
ALTER TABLE "tutor_profiles" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "tutor_profiles" SET "slug" = 'tutor-' || substr(md5("id"::text), 1, 10) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_slug_format" CHECK ("tutor_profiles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
