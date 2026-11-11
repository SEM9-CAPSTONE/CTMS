import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-059-T01 (CTMS-309). Server-side GPS breadcrumb store. The primary key is
 * the client-generated UUID so repeated uploads are idempotent (BR-244), and the
 * logical owner is user + Trip, never a device (BR-237).
 */
export class CreateGpsLogsTable1787200000000 implements MigrationInterface {
	name = "CreateGpsLogsTable1787200000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TYPE "gps_participant_role" AS ENUM ('camper', 'porter')`);
		await queryRunner.query(`
			CREATE TABLE "gps_logs" (
				"id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"user_id" uuid NOT NULL,
				"participant_role" "gps_participant_role" NOT NULL,
				"event_time" timestamptz NOT NULL,
				"location" geography(Point,4326) NOT NULL,
				"accuracy_meters" double precision NOT NULL,
				"altitude_meters" double precision,
				"battery_level" smallint,
				"package_version" varchar(64),
				"config_version" varchar(32) NOT NULL,
				"received_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_gps_logs_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_gps_logs_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_gps_logs_user_id" FOREIGN KEY ("user_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_gps_logs_accuracy_meters" CHECK ("accuracy_meters" >= 0),
				CONSTRAINT "CHK_gps_logs_battery_level"
					CHECK ("battery_level" IS NULL OR "battery_level" BETWEEN 0 AND 100)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_gps_logs_trip_user_event_time" ON "gps_logs" ("trip_id", "user_id", "event_time")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gps_logs_trip_user_event_time"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "gps_logs"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "gps_participant_role"`);
	}
}
