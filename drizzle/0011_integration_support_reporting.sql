CREATE TABLE "support_case_assignments" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"previous_status" text,
	"next_status" text,
	"previous_reviewer_id" text,
	"next_reviewer_id" text,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_case_events_revision_unique" UNIQUE("case_id","revision"),
	CONSTRAINT "support_case_events_revision" CHECK ("support_case_events"."revision" >= 0),
	CONSTRAINT "support_case_events_shape" CHECK ((
    ("support_case_events"."action" = 'created' AND "support_case_events"."revision" = 0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" = 'open' AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL)
    OR ("support_case_events"."action" IN ('assigned','reassigned') AND "support_case_events"."revision" > 0 AND "support_case_events"."actor_user_id" IS NULL AND "support_case_events"."previous_status" IS NULL AND "support_case_events"."next_status" IS NULL AND "support_case_events"."next_reviewer_id" IS NOT NULL AND (("support_case_events"."action" = 'assigned' AND "support_case_events"."previous_reviewer_id" IS NULL) OR ("support_case_events"."action" = 'reassigned' AND "support_case_events"."previous_reviewer_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" <> "support_case_events"."next_reviewer_id")))
    OR ("support_case_events"."action" = 'status_changed' AND "support_case_events"."revision" > 0 AND "support_case_events"."actor_user_id" IS NOT NULL AND "support_case_events"."previous_reviewer_id" IS NULL AND "support_case_events"."next_reviewer_id" IS NULL AND (("support_case_events"."previous_status" = 'open' AND "support_case_events"."next_status" = 'in_review') OR ("support_case_events"."previous_status" = 'in_review' AND "support_case_events"."next_status" = 'closed') OR ("support_case_events"."previous_status" = 'closed' AND "support_case_events"."next_status" = 'in_review')))
  ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"source" text DEFAULT 'local_synthetic' NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_cases_request_unique" UNIQUE("requester_user_id","request_key"),
	CONSTRAINT "support_cases_source" CHECK ("support_cases"."source" = 'local_synthetic'),
	CONSTRAINT "support_cases_category" CHECK ("support_cases"."category" IN ('general', 'account', 'safety')),
	CONSTRAINT "support_cases_status" CHECK ("support_cases"."status" IN ('open', 'in_review', 'closed')),
	CONSTRAINT "support_cases_revision" CHECK ("support_cases"."revision" >= 0),
	CONSTRAINT "support_cases_subject" CHECK (char_length("support_cases"."subject") BETWEEN 1 AND 120 AND "support_cases"."subject" = btrim("support_cases"."subject")),
	CONSTRAINT "support_cases_body" CHECK (char_length("support_cases"."body") BETWEEN 1 AND 2000 AND "support_cases"."body" = btrim("support_cases"."body"))
);
--> statement-breakpoint
CREATE TABLE "support_reviewer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_reviewer_events_action" CHECK ("support_reviewer_events"."action" IN ('authorized', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "support_reviewers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_reviewers_source" CHECK ("support_reviewers"."source" = 'local_fixture'),
	CONSTRAINT "support_reviewers_status" CHECK ("support_reviewers"."status" IN ('authorized', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_reviewer_user_id_support_reviewers_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_previous_reviewer_id_support_reviewers_user_id_fk" FOREIGN KEY ("previous_reviewer_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_next_reviewer_id_support_reviewers_user_id_fk" FOREIGN KEY ("next_reviewer_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_reviewer_events" ADD CONSTRAINT "support_reviewer_events_reviewer_user_id_support_reviewers_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."support_reviewers"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_reviewers" ADD CONSTRAINT "support_reviewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_case_assignments_reviewer_idx" ON "support_case_assignments" USING btree ("reviewer_user_id","case_id");--> statement-breakpoint
CREATE INDEX "support_cases_requester_created_idx" ON "support_cases" USING btree ("requester_user_id","created_at","id");