import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-049. Porter-reported Trip incidents. The primary key is the client-generated
 * UUID so an offline incident synchronized more than once stays one authoritative
 * row (BR-162, BR-221). Location is nullable because an unavailable fix must never be
 * fabricated; `location_status` tells fresh, stale and unavailable locations apart.
 */
export class CreateTripIncidentsTable1787240000000 implements MigrationInterface {
	name = "CreateTripIncidentsTable1787240000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TYPE "incident_category" AS ENUM (
				'injury', 'illness', 'lost_member', 'equipment_failure',
				'weather_hazard', 'route_obstruction', 'wildlife', 'other'
			)
		`);
		await queryRunner.query(
			`CREATE TYPE "incident_severity" AS ENUM ('low', 'medium', 'high', 'critical')`
		);
		await queryRunner.query(`CREATE TYPE "incident_status" AS ENUM ('open')`);
		await queryRunner.query(
			`CREATE TYPE "incident_location_status" AS ENUM ('fresh', 'stale', 'unavailable')`
		);
		await queryRunner.query(`
			CREATE TABLE "trip_incidents" (
				"id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"reporter_id" uuid NOT NULL,
				"category" "incident_category" NOT NULL,
				"severity" "incident_severity" NOT NULL,
				"status" "incident_status" NOT NULL DEFAULT 'open',
				"description" varchar(2000) NOT NULL,
				"occurred_at" timestamptz NOT NULL,
				"location" geography(Point,4326),
				"location_accuracy_meters" double precision,
				"location_captured_at" timestamptz,
				"location_status" "incident_location_status" NOT NULL,
				"captured_offline" boolean NOT NULL DEFAULT false,
				"media_url" varchar(512),
				"media_content_type" varchar(64),
				"media_size_bytes" integer,
				"media_uploaded_at" timestamptz,
				"received_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_incidents_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trip_incidents_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_trip_incidents_reporter_id" FOREIGN KEY ("reporter_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_trip_incidents_description" CHECK (length(btrim("description")) > 0),
				CONSTRAINT "CHK_trip_incidents_location_complete" CHECK (
					("location_status" = 'unavailable'
						AND "location" IS NULL
						AND "location_accuracy_meters" IS NULL
						AND "location_captured_at" IS NULL)
					OR ("location_status" <> 'unavailable'
						AND "location" IS NOT NULL
						AND "location_accuracy_meters" >= 0
						AND "location_captured_at" IS NOT NULL)
				),
				CONSTRAINT "CHK_trip_incidents_media_complete" CHECK (
					("media_url" IS NULL AND "media_content_type" IS NULL
						AND "media_size_bytes" IS NULL AND "media_uploaded_at" IS NULL)
					OR ("media_url" IS NOT NULL AND "media_content_type" IS NOT NULL
						AND "media_size_bytes" > 0 AND "media_uploaded_at" IS NOT NULL)
				)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_incidents_trip_occurred_at" ON "trip_incidents" ("trip_id", "occurred_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_trip_incidents_reporter_id" ON "trip_incidents" ("reporter_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_incidents_reporter_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_incidents_trip_occurred_at"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_incidents"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "incident_location_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "incident_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "incident_severity"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "incident_category"`);
	}
}
