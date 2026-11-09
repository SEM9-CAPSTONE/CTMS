import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Weather decision near departure (policy §5): Host keeps / reschedules / cancels a Red Trip,
 * Admin intervenes within the last 3 days (including pausing the Trip).
 *
 * - `trip_weather_decisions`: append-only log of every decision with the forecast it relied on.
 * - `trip_weather_decision_alerts`: one reminder per (Trip, recipient, milestone), so the T-48h
 *   Host reminder and the T-24h / T-12h / T-6h Admin escalations are each sent exactly once.
 * - `trips.weather_paused_at` / `weather_pause_reason`: set while an Admin has paused the Trip.
 */
export class AddTripWeatherDecisions1794700000000 implements MigrationInterface {
	name = "AddTripWeatherDecisions1794700000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "weather_paused_at" timestamptz, ADD COLUMN IF NOT EXISTS "weather_pause_reason" varchar(500)`
		);
		await queryRunner.query(
			`CREATE TYPE "trip_weather_decision" AS ENUM ('keep', 'reschedule', 'cancel', 'pause', 'resume')`
		);
		await queryRunner.query(`
			CREATE TABLE "trip_weather_decisions" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"trip_id" uuid NOT NULL,
				"forecast_id" uuid,
				"risk_level" "weather_risk_level",
				"decided_by" uuid,
				"decider_role" varchar(10) NOT NULL,
				"decision" "trip_weather_decision" NOT NULL,
				"reason" varchar(500) NOT NULL,
				"safety_plan" varchar(1000),
				"late" boolean NOT NULL DEFAULT false,
				"trip_starts_at" timestamptz NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_weather_decisions" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_trip_weather_decisions_role" CHECK ("decider_role" IN ('host', 'admin')),
				CONSTRAINT "CHK_trip_weather_decisions_keep_plan"
					CHECK ("decision" <> 'keep' OR "decider_role" <> 'host' OR "safety_plan" IS NOT NULL),
				CONSTRAINT "FK_trip_weather_decisions_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_decisions_forecast" FOREIGN KEY ("forecast_id")
					REFERENCES "trip_weather_forecasts"("id") ON DELETE SET NULL,
				CONSTRAINT "FK_trip_weather_decisions_decider" FOREIGN KEY ("decided_by")
					REFERENCES "users"("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_weather_decisions_trip" ON "trip_weather_decisions" ("trip_id", "created_at" DESC)`
		);
		await queryRunner.query(`
			CREATE TABLE "trip_weather_decision_alerts" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"recipient_id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"milestone" varchar(20) NOT NULL,
				"urgency" varchar(10) NOT NULL,
				"trip_title" varchar(150) NOT NULL,
				"trip_starts_at" timestamptz NOT NULL,
				"forecast_id" uuid,
				"read_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_weather_decision_alerts" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_trip_weather_decision_alert" UNIQUE ("trip_id", "trip_starts_at", "recipient_id", "milestone"),
				CONSTRAINT "CHK_trip_weather_decision_alerts_milestone"
					CHECK ("milestone" IN ('host_t48', 'admin_t24', 'admin_t12', 'admin_t6', 'admin_kept')),
				CONSTRAINT "CHK_trip_weather_decision_alerts_urgency"
					CHECK ("urgency" IN ('normal', 'urgent', 'critical')),
				CONSTRAINT "FK_trip_weather_decision_alerts_recipient" FOREIGN KEY ("recipient_id")
					REFERENCES "users"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_decision_alerts_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_weather_decision_alerts_forecast" FOREIGN KEY ("forecast_id")
					REFERENCES "trip_weather_forecasts"("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_weather_decision_alerts_inbox" ON "trip_weather_decision_alerts" ("recipient_id", "created_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_weather_decision_alerts"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_weather_decisions"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trip_weather_decision"`);
		await queryRunner.query(
			`ALTER TABLE "trips" DROP COLUMN IF EXISTS "weather_pause_reason", DROP COLUMN IF EXISTS "weather_paused_at"`
		);
	}
}
