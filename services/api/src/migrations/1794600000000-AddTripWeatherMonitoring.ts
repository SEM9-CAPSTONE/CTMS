import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-015 follow-up (Jira CTMS-93): monitor the forecast for each Trip's own dates.
 *
 * - `trip_weather_forecasts.checked_at`: when the stored result was last confirmed. An unchanged
 *   result only moves this timestamp, so the table holds one row per *change*, not one per check.
 * - `trip_weather_change_notices`: one notice per (forecast row, recipient) when the risk level
 *   changes, so each change reaches each recipient exactly once.
 */
export class AddTripWeatherMonitoring1794600000000 implements MigrationInterface {
	name = "AddTripWeatherMonitoring1794600000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "trip_weather_forecasts" ADD COLUMN IF NOT EXISTS "checked_at" timestamptz`
		);
		await queryRunner.query(
			`UPDATE "trip_weather_forecasts" SET "checked_at" = "created_at" WHERE "checked_at" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "trip_weather_forecasts" ALTER COLUMN "checked_at" SET DEFAULT now(), ALTER COLUMN "checked_at" SET NOT NULL`
		);
		await queryRunner.query(`
			CREATE TABLE "trip_weather_change_notices" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"recipient_id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"forecast_id" uuid NOT NULL,
				"trip_title" varchar(150) NOT NULL,
				"trip_starts_at" timestamptz NOT NULL,
				"previous_risk_level" "weather_risk_level" NOT NULL,
				"risk_level" "weather_risk_level" NOT NULL,
				"read_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_weather_change_notices" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_trip_weather_change_notice_recipient" UNIQUE ("forecast_id", "recipient_id"),
				CONSTRAINT "FK_trip_weather_change_notices_recipient" FOREIGN KEY ("recipient_id")
					REFERENCES "users"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_change_notices_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_change_notices_forecast" FOREIGN KEY ("forecast_id")
					REFERENCES "trip_weather_forecasts"("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_weather_change_notices_inbox" ON "trip_weather_change_notices" ("recipient_id", "created_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_weather_change_notices"`);
		await queryRunner.query(
			`ALTER TABLE "trip_weather_forecasts" DROP COLUMN IF EXISTS "checked_at"`
		);
	}
}
