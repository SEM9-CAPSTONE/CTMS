import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-060-T01 (CTMS-311). Server-side store for route-deviation and GPS-quality
 * transitions detected on the device. The primary key is the client-generated UUID so
 * repeated uploads are idempotent (BR-244). The CHECK constraints mirror the fixed V3
 * thresholds so no row can claim a transition its own context does not support.
 */
export class CreateSafetyEventsTable1792713600000 implements MigrationInterface {
	name = "CreateSafetyEventsTable1792713600000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "safety_event_type" AS ENUM ('OFF_ROUTE', 'ON_ROUTE_RECOVERED', 'GPS_DEGRADED', 'GPS_RESTORED')`
		);
		await queryRunner.query(`
			CREATE TABLE "safety_events" (
				"id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"user_id" uuid NOT NULL,
				"participant_role" "gps_participant_role" NOT NULL,
				"event_type" "safety_event_type" NOT NULL,
				"event_time" timestamptz NOT NULL,
				"location" geography(Point,4326),
				"accuracy_meters" double precision,
				"distance_to_route_meters" double precision,
				"consecutive_valid_samples" smallint,
				"no_valid_sample_since" timestamptz,
				"detected_offline" boolean NOT NULL DEFAULT false,
				"route_id" uuid NOT NULL,
				"route_version" varchar(64) NOT NULL,
				"package_version" varchar(64),
				"config_version" varchar(32) NOT NULL,
				"received_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_safety_events_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_safety_events_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_safety_events_user_id" FOREIGN KEY ("user_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_safety_events_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_safety_events_accuracy_meters"
					CHECK ("accuracy_meters" IS NULL OR "accuracy_meters" >= 0),
				CONSTRAINT "CHK_safety_events_location_accuracy"
					CHECK (("location" IS NULL) = ("accuracy_meters" IS NULL)),
				CONSTRAINT "CHK_safety_events_off_route" CHECK (
					"event_type" <> 'OFF_ROUTE' OR (
						"location" IS NOT NULL AND "accuracy_meters" <= 20
						AND "distance_to_route_meters" > 50 AND "consecutive_valid_samples" >= 3
					)
				),
				CONSTRAINT "CHK_safety_events_on_route_recovered" CHECK (
					"event_type" <> 'ON_ROUTE_RECOVERED' OR (
						"location" IS NOT NULL AND "accuracy_meters" <= 20
						AND "distance_to_route_meters" >= 0 AND "distance_to_route_meters" < 20
						AND "consecutive_valid_samples" >= 3
					)
				),
				CONSTRAINT "CHK_safety_events_gps_degraded" CHECK (
					"event_type" <> 'GPS_DEGRADED' OR (
						"no_valid_sample_since" IS NOT NULL
						AND "event_time" - "no_valid_sample_since" >= interval '120 seconds'
					)
				),
				CONSTRAINT "CHK_safety_events_gps_restored" CHECK (
					"event_type" <> 'GPS_RESTORED' OR ("location" IS NOT NULL AND "accuracy_meters" <= 20)
				)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_safety_events_trip_user_event_time" ON "safety_events" ("trip_id", "user_id", "event_time")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_safety_events_trip_user_event_time"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "safety_events"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "safety_event_type"`);
	}
}
