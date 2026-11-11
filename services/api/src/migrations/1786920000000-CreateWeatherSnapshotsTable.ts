import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWeatherSnapshotsTable1786920000000 implements MigrationInterface {
	name = "CreateWeatherSnapshotsTable1786920000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TYPE "weather_snapshot_status" AS ENUM ('success', 'failed')`);
		await queryRunner.query(`
			CREATE TABLE "weather_snapshots" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"route_id" uuid NOT NULL,
				"status" "weather_snapshot_status" NOT NULL,
				"observed_at" timestamptz NULL,
				"rainfall_mm" double precision NULL,
				"wind_kph" double precision NULL,
				"temperature_c" double precision NULL,
				"visibility_m" double precision NULL,
				"thunderstorm" boolean NULL,
				"provider_weather_code" integer NULL,
				"provider_response" jsonb NULL,
				"error_message" varchar(500) NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_snapshots_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_weather_snapshots_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_weather_snapshots_success_shape" CHECK (
					("status" = 'failed' AND "error_message" IS NOT NULL)
					OR ("status" = 'success' AND "error_message" IS NULL AND "observed_at" IS NOT NULL)
				)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_snapshots_route_created" ON "weather_snapshots" ("route_id", "created_at")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weather_snapshots_route_created"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "weather_snapshots"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "weather_snapshot_status"`);
	}
}
