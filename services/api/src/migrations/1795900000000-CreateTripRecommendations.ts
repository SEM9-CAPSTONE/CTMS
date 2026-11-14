import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-106. Camper trip preferences (ranking signals only, never eligibility filters) and one
 * metadata row per recommendation generation. A run stores versions, counts, the ordered Trip ids
 * with backend-validated reason codes and the fallback cause; never the prompt or AI free text.
 * An AI run also keeps the validated AI order and a fingerprint of the Camper's signals, so later
 * requests with the same signals reuse that order instead of calling the AI again.
 */
export class CreateTripRecommendations1795900000000 implements MigrationInterface {
	name = "CreateTripRecommendations1795900000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "camper_trip_preferences" (
				"user_id" uuid PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
				"trip_types" text[] NOT NULL DEFAULT '{}',
				"difficulties" text[] NOT NULL DEFAULT '{}',
				"regions" text[] NOT NULL DEFAULT '{}',
				"min_price" integer,
				"max_price" integer,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "CHK_camper_trip_preferences_trip_types"
					CHECK ("trip_types" <@ ARRAY['day_trip', 'overnight']::text[]),
				CONSTRAINT "CHK_camper_trip_preferences_difficulties"
					CHECK ("difficulties" <@ ARRAY['easy', 'moderate', 'hard', 'expert']::text[]),
				CONSTRAINT "CHK_camper_trip_preferences_regions"
					CHECK ("regions" <@ ARRAY['son_tra', 'hai_van_lien_chieu', 'ba_na_hoa_vang', 'ngu_hanh_son', 'city_center']::text[]),
				CONSTRAINT "CHK_camper_trip_preferences_price"
					CHECK (("min_price" IS NULL OR "min_price" >= 0)
						AND ("max_price" IS NULL OR "max_price" >= 0)
						AND ("min_price" IS NULL OR "max_price" IS NULL OR "min_price" <= "max_price"))
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "trip_recommendation_runs" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
				"generated_at" timestamptz NOT NULL DEFAULT now(),
				"mode" varchar(16) NOT NULL,
				"signal_type" varchar(32) NOT NULL,
				"rules_version" varchar(64) NOT NULL,
				"prompt_version" varchar(64),
				"model_version" varchar(200),
				"eligible_count" integer NOT NULL,
				"candidate_count" integer NOT NULL,
				"results" jsonb NOT NULL,
				"fallback_reason" varchar(32),
				"latency_ms" integer NOT NULL,
				"signal_fingerprint" varchar(64),
				"ai_ranking" jsonb,
				"reused_run_id" uuid REFERENCES "trip_recommendation_runs" ("id") ON DELETE SET NULL,
				CONSTRAINT "CHK_trip_recommendation_runs_mode" CHECK ("mode" IN ('ai', 'rules')),
				CONSTRAINT "CHK_trip_recommendation_runs_signal"
					CHECK ("signal_type" IN ('preferences', 'history', 'preferences_and_history')),
				CONSTRAINT "CHK_trip_recommendation_runs_counts"
					CHECK ("eligible_count" >= 0 AND "candidate_count" >= 0 AND "candidate_count" <= 30 AND "latency_ms" >= 0),
				CONSTRAINT "CHK_trip_recommendation_runs_ai_cache"
					CHECK (("ai_ranking" IS NULL OR ("mode" = 'ai' AND "signal_fingerprint" IS NOT NULL))
						AND ("reused_run_id" IS NULL OR ("mode" = 'ai' AND "ai_ranking" IS NULL))),
				CONSTRAINT "CHK_trip_recommendation_runs_fallback"
					CHECK ("fallback_reason" IS NULL OR "mode" = 'rules')
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_recommendation_runs_user_generated" ON "trip_recommendation_runs" ("user_id", "generated_at" DESC)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_recommendation_runs_ai_cache" ON "trip_recommendation_runs" ("user_id", "signal_fingerprint", "generated_at" DESC) WHERE "ai_ranking" IS NOT NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "trip_recommendation_runs"`);
		await queryRunner.query(`DROP TABLE "camper_trip_preferences"`);
	}
}
