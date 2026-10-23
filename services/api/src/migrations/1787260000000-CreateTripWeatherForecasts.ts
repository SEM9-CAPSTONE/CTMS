import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTripWeatherForecasts1787260000000 implements MigrationInterface {
	name = "CreateTripWeatherForecasts1787260000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "trip_weather_forecast_status" AS ENUM ('available', 'out_of_range')`
		);
		await queryRunner.query(`
			CREATE TABLE "trip_weather_forecasts" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"route_id" uuid NOT NULL,
				"status" "trip_weather_forecast_status" NOT NULL,
				"trip_starts_at" timestamptz NOT NULL,
				"trip_ends_at" timestamptz NOT NULL,
				"forecast_from" timestamptz,
				"forecast_to" timestamptz,
				"worst_reading" jsonb,
				"rule_version_id" uuid,
				"risk_level" "weather_risk_level",
				"composite_score" double precision,
				"criteria_scores" jsonb,
				"provider_response" jsonb,
				"advice_text" text,
				"advice_actions" jsonb,
				"advice_generated_at" timestamptz,
				"created_by" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_weather_forecasts_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trip_weather_forecasts_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_forecasts_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_trip_weather_forecasts_rule_version_id" FOREIGN KEY ("rule_version_id")
					REFERENCES "weather_risk_rules" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_trip_weather_forecasts_created_by" FOREIGN KEY ("created_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_trip_weather_forecasts_available_fields" CHECK (
					"status" <> 'available' OR (
						"forecast_from" IS NOT NULL AND "forecast_to" IS NOT NULL
						AND "forecast_from" <= "forecast_to"
						AND "worst_reading" IS NOT NULL AND "rule_version_id" IS NOT NULL
						AND "risk_level" IS NOT NULL AND "composite_score" IS NOT NULL
						AND "criteria_scores" IS NOT NULL
					)
				),
				CONSTRAINT "CHK_trip_weather_forecasts_out_of_range_fields" CHECK (
					"status" <> 'out_of_range' OR (
						"risk_level" IS NULL AND "composite_score" IS NULL AND "advice_text" IS NULL
					)
				),
				CONSTRAINT "CHK_trip_weather_forecasts_advice_pair" CHECK (
					("advice_text" IS NULL) = ("advice_generated_at" IS NULL)
				)
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_trip_weather_forecasts_trip_created"
			ON "trip_weather_forecasts" ("trip_id", "created_at" DESC)
		`);
		await queryRunner.query(`
			ALTER TABLE "trips"
				ADD COLUMN "submitted_weather_forecast_id" uuid,
				ADD COLUMN "weather_risk_acknowledged_at" timestamptz,
				ADD CONSTRAINT "FK_trips_submitted_weather_forecast_id"
					FOREIGN KEY ("submitted_weather_forecast_id")
					REFERENCES "trip_weather_forecasts" ("id") ON DELETE SET NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "trips"
				DROP CONSTRAINT IF EXISTS "FK_trips_submitted_weather_forecast_id",
				DROP COLUMN IF EXISTS "weather_risk_acknowledged_at",
				DROP COLUMN IF EXISTS "submitted_weather_forecast_id"
		`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_weather_forecasts"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trip_weather_forecast_status"`);
	}
}
