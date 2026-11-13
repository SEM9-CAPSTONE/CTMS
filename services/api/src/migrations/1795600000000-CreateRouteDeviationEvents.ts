import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-115 (Subtask CTMS-433). Historical Route Deviation Events: derived episodes built by
 * replaying a completed Trip's GPS logs with the fixed V3 rules (BR-352, BR-353, BR-363). Raw
 * `gps_logs` / `safety_events` are never modified. One analysis row per (Trip, analysis version)
 * makes the work idempotent; episodes are replaced as a whole when a Trip is re-analysed.
 */
export class CreateRouteDeviationEvents1795600000000 implements MigrationInterface {
	name = "CreateRouteDeviationEvents1795600000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "route_deviation_trip_analyses" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"analysis_version" varchar(64) NOT NULL,
				"route_id" uuid NOT NULL,
				"route_version" varchar(64) NOT NULL,
				"runtime_context" jsonb NOT NULL,
				"participants" integer NOT NULL DEFAULT 0,
				"samples_total" integer NOT NULL DEFAULT 0,
				"samples_used" integer NOT NULL DEFAULT 0,
				"samples_excluded" jsonb NOT NULL DEFAULT '{}',
				"episodes" integer NOT NULL DEFAULT 0,
				"triggered_by" uuid,
				"analyzed_at" timestamptz NOT NULL,
				CONSTRAINT "PK_route_deviation_trip_analyses" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_route_deviation_trip_analyses_trip_version" UNIQUE ("trip_id", "analysis_version"),
				CONSTRAINT "FK_route_deviation_trip_analyses_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_route_deviation_trip_analyses_route" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_route_deviation_trip_analyses_triggered_by" FOREIGN KEY ("triggered_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "route_deviation_events" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"analysis_id" uuid NOT NULL,
				"analysis_version" varchar(64) NOT NULL,
				"config_version" varchar(32) NOT NULL,
				"trip_id" uuid NOT NULL,
				"route_id" uuid NOT NULL,
				"route_version" varchar(64) NOT NULL,
				"package_version" varchar(64),
				"user_id" uuid NOT NULL,
				"participant_role" "gps_participant_role" NOT NULL,
				"started_at" timestamptz NOT NULL,
				"confirmed_at" timestamptz NOT NULL,
				"ended_at" timestamptz NOT NULL,
				"recovery_confirmed_at" timestamptz,
				"end_reason" varchar(16) NOT NULL,
				"sample_count" integer NOT NULL,
				"valid_sample_count" integer NOT NULL,
				"max_distance_meters" double precision NOT NULL,
				"avg_distance_meters" double precision NOT NULL,
				"start_location" geography(Point,4326) NOT NULL,
				"max_distance_location" geography(Point,4326) NOT NULL,
				"start_route_fraction" double precision NOT NULL,
				"start_gps_log_id" uuid NOT NULL,
				"end_gps_log_id" uuid NOT NULL,
				"device_safety_event_ids" uuid[] NOT NULL DEFAULT '{}',
				"runtime_context" jsonb NOT NULL,
				"authoritative" boolean NOT NULL,
				"context_issues" text[] NOT NULL DEFAULT '{}',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_route_deviation_events" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_route_deviation_events_version_start" UNIQUE ("analysis_version", "start_gps_log_id"),
				CONSTRAINT "CHK_route_deviation_events_end_reason" CHECK ("end_reason" IN ('RECOVERED', 'EVIDENCE_ENDED')),
				CONSTRAINT "CHK_route_deviation_events_times" CHECK ("started_at" <= "confirmed_at" AND "started_at" <= "ended_at"),
				CONSTRAINT "CHK_route_deviation_events_counts" CHECK ("valid_sample_count" >= 3 AND "sample_count" >= "valid_sample_count"),
				CONSTRAINT "CHK_route_deviation_events_distance" CHECK ("max_distance_meters" > 50 AND "avg_distance_meters" >= 0),
				CONSTRAINT "CHK_route_deviation_events_fraction" CHECK ("start_route_fraction" BETWEEN 0 AND 1),
				CONSTRAINT "CHK_route_deviation_events_authoritative" CHECK ("authoritative" = (cardinality("context_issues") = 0)),
				CONSTRAINT "FK_route_deviation_events_analysis" FOREIGN KEY ("analysis_id")
					REFERENCES "route_deviation_trip_analyses" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_route_deviation_events_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_route_deviation_events_route" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_route_deviation_events_user" FOREIGN KEY ("user_id")
					REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_route_deviation_events_route_started" ON "route_deviation_events" ("route_id", "route_version", "started_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_route_deviation_events_trip" ON "route_deviation_events" ("trip_id", "user_id", "started_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_route_deviation_events_start_location" ON "route_deviation_events" USING GIST ("start_location")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "route_deviation_events"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "route_deviation_trip_analyses"`);
	}
}
