CREATE TABLE "llm_usage" (
	"day" date NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_usage_day_provider_model_feature_pk" PRIMARY KEY("day","provider","model","feature")
);
--> statement-breakpoint
CREATE TABLE "narratives" (
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"version" smallint NOT NULL,
	"content" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "narratives_kind_key_version_pk" PRIMARY KEY("kind","key","version")
);
--> statement-breakpoint
ALTER TABLE "narratives" ADD CONSTRAINT "narratives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "narratives_created_idx" ON "narratives" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "narratives_creator_idx" ON "narratives" USING btree ("created_by","created_at");