CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"direction" text NOT NULL,
	"target" double precision NOT NULL,
	"games" smallint NOT NULL,
	"hero_id" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_summaries" (
	"account_id" bigint NOT NULL,
	"match_id" bigint NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"hero_id" smallint NOT NULL,
	"parsed" boolean DEFAULT false NOT NULL,
	"replay_checked" boolean DEFAULT false NOT NULL,
	"parse_requested_at" timestamp with time zone,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_summaries_account_id_match_id_pk" PRIMARY KEY("account_id","match_id")
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_summaries_account_time_idx" ON "match_summaries" USING btree ("account_id","start_time");