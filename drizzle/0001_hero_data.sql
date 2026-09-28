CREATE TABLE "hero_data" (
	"kind" text NOT NULL,
	"bracket" text NOT NULL,
	"hero_id" smallint NOT NULL,
	"position" smallint NOT NULL,
	"value" jsonb NOT NULL,
	"source" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_data_kind_bracket_hero_id_position_pk" PRIMARY KEY("kind","bracket","hero_id","position")
);
