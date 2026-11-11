import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWeatherRiskTables1786930000000 implements MigrationInterface {
	name = "CreateWeatherRiskTables1786930000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TYPE "weather_risk_level" AS ENUM ('green', 'yellow', 'red')`);

		await queryRunner.query(`
			CREATE TABLE "weather_risk_rules" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"version" SERIAL NOT NULL,
				"rainfall_yellow_threshold" double precision NOT NULL,
				"rainfall_red_threshold" double precision NOT NULL,
				"wind_yellow_threshold" double precision NOT NULL,
				"wind_red_threshold" double precision NOT NULL,
				"temp_low_yellow" double precision NOT NULL,
				"temp_low_red" double precision NOT NULL,
				"temp_high_yellow" double precision NOT NULL,
				"temp_high_red" double precision NOT NULL,
				"visibility_yellow_threshold" double precision NOT NULL,
				"visibility_red_threshold" double precision NOT NULL,
				"thunderstorm_yellow" boolean NOT NULL,
				"thunderstorm_red" boolean NOT NULL,
				"rainfall_weight" double precision NOT NULL,
				"wind_weight" double precision NOT NULL,
				"temperature_weight" double precision NOT NULL,
				"visibility_weight" double precision NOT NULL,
				"thunderstorm_weight" double precision NOT NULL,
				"green_max_score" double precision NOT NULL,
				"yellow_max_score" double precision NOT NULL,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_by" uuid NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_risk_rules_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_weather_risk_rules_created_by" FOREIGN KEY ("created_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);

		// Seed initial default rule set
		await queryRunner.query(`
			INSERT INTO "weather_risk_rules" (
				"rainfall_yellow_threshold", "rainfall_red_threshold",
				"wind_yellow_threshold", "wind_red_threshold",
				"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
				"visibility_yellow_threshold", "visibility_red_threshold",
				"thunderstorm_yellow", "thunderstorm_red",
				"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
				"green_max_score", "yellow_max_score",
				"is_active"
			) VALUES (
				10.0, 50.0,
				40.0, 70.0,
				5.0, 0.0, 38.0, 42.0,
				5000.0, 1000.0,
				true, true,
				0.30, 0.25, 0.15, 0.15, 0.15,
				0.5, 1.2,
				true
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "weather_risk_assessments" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"route_id" uuid NOT NULL,
				"snapshot_id" uuid NOT NULL,
				"rule_version_id" uuid NOT NULL,
				"risk_level" "weather_risk_level" NOT NULL,
				"composite_score" double precision NOT NULL,
				"criteria_scores" jsonb NOT NULL,
				"created_by" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_risk_assessments_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_weather_risk_assessments_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_weather_risk_assessments_snapshot_id" FOREIGN KEY ("snapshot_id")
					REFERENCES "weather_snapshots" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_weather_risk_assessments_rule_version_id" FOREIGN KEY ("rule_version_id")
					REFERENCES "weather_risk_rules" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_weather_risk_assessments_created_by" FOREIGN KEY ("created_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "UQ_weather_risk_assessment_snapshot_rule" UNIQUE ("snapshot_id", "rule_version_id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_weather_risk_assessments_route_id" ON "weather_risk_assessments" ("route_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_risk_assessments_snapshot_id" ON "weather_risk_assessments" ("snapshot_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weather_risk_assessments_snapshot_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weather_risk_assessments_route_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "weather_risk_assessments"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "weather_risk_rules"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "weather_risk_level"`);
	}
}
