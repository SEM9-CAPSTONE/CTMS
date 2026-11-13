import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hybrid weather risk: an independent AI opinion stored next to each rule-based forecast. Additive
 * only; the rule-based `risk_level` stays the official result.
 */
export class AddTripWeatherAiReview1795200000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE "trip_weather_forecasts"
			ADD COLUMN "ai_risk_level" "weather_risk_level",
			ADD COLUMN "ai_reason" text,
			ADD COLUMN "ai_confidence" double precision,
			ADD COLUMN "ai_model" varchar(200),
			ADD COLUMN "ai_reviewed_at" timestamptz,
			ADD COLUMN "ai_review_attempts" smallint NOT NULL DEFAULT 0,
			ADD COLUMN "ai_review_acknowledged_at" timestamptz,
			ADD COLUMN "ai_review_acknowledged_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
			ADD CONSTRAINT "CHK_trip_weather_forecasts_ai_review_complete" CHECK (
				("ai_risk_level" IS NULL AND "ai_reason" IS NULL AND "ai_confidence" IS NULL
					AND "ai_model" IS NULL AND "ai_reviewed_at" IS NULL)
				OR ("ai_risk_level" IS NOT NULL AND "ai_reason" IS NOT NULL AND "ai_confidence" IS NOT NULL
					AND "ai_model" IS NOT NULL AND "ai_reviewed_at" IS NOT NULL AND "risk_level" IS NOT NULL)
			),
			ADD CONSTRAINT "CHK_trip_weather_forecasts_ai_confidence" CHECK (
				"ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1)
			),
			ADD CONSTRAINT "CHK_trip_weather_forecasts_ai_ack" CHECK (
				"ai_review_acknowledged_at" IS NULL OR "ai_reviewed_at" IS NOT NULL
			)`);
		await q.query(`CREATE INDEX "IDX_trip_weather_forecasts_ai_mismatch"
			ON "trip_weather_forecasts" ("trip_id")
			WHERE "ai_risk_level" IS NOT NULL AND "ai_risk_level" <> "risk_level"
				AND "ai_review_acknowledged_at" IS NULL`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`DROP INDEX IF EXISTS "IDX_trip_weather_forecasts_ai_mismatch"`);
		await q.query(`ALTER TABLE "trip_weather_forecasts"
			DROP CONSTRAINT IF EXISTS "CHK_trip_weather_forecasts_ai_ack",
			DROP CONSTRAINT IF EXISTS "CHK_trip_weather_forecasts_ai_confidence",
			DROP CONSTRAINT IF EXISTS "CHK_trip_weather_forecasts_ai_review_complete",
			DROP COLUMN IF EXISTS "ai_review_acknowledged_by",
			DROP COLUMN IF EXISTS "ai_review_acknowledged_at",
			DROP COLUMN IF EXISTS "ai_review_attempts",
			DROP COLUMN IF EXISTS "ai_reviewed_at",
			DROP COLUMN IF EXISTS "ai_model",
			DROP COLUMN IF EXISTS "ai_confidence",
			DROP COLUMN IF EXISTS "ai_reason",
			DROP COLUMN IF EXISTS "ai_risk_level"`);
	}
}
