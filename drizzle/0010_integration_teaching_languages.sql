CREATE TYPE "public"."teaching_language_code" AS ENUM('ar', 'ceb', 'zh', 'en', 'fil', 'fr', 'de', 'hi', 'ja', 'ko', 'pt', 'es');--> statement-breakpoint
CREATE TABLE "tutor_teaching_languages" (
	"tutor_id" uuid NOT NULL,
	"language_code" "teaching_language_code" NOT NULL,
	CONSTRAINT "tutor_teaching_languages_tutor_id_language_code_pk" PRIMARY KEY("tutor_id","language_code")
);
--> statement-breakpoint
ALTER TABLE "tutor_teaching_languages" ADD CONSTRAINT "tutor_teaching_languages_tutor_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;