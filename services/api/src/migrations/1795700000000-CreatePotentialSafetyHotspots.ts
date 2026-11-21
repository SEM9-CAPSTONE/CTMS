import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-116 (Subtask CTMS-435). PotentialSafetyHotspot candidates derived from historical
 * RouteDeviationEvents (BR-355, BR-417, BR-418, BR-420, BR-421, BR-422) and the detection runs
 * that produced them. Advisory only: nothing here changes Route or safety data (BR-356). A
 * candidate keeps aggregate counts, a cluster centre and evidence ids, never member ids (BR-361).
 */
export class CreatePotentialSafetyHotspots1795700000000 implements MigrationInterface {
	name = "CreatePotentialSafetyHotspots1795700000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "hotspot_detection_runs" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"analysis_version" varchar(64) NOT NULL,
				"config_version" varchar(32) NOT NULL,
				"criteria" jsonb NOT NULL,
				"window_start" timestamptz NOT NULL,
				"window_end" timestamptz NOT NULL,
				"events_considered" integer NOT NULL,
				"clusters_found" integer NOT NULL,
				"candidates_created" integer NOT NULL,
				"skipped" jsonb NOT NULL DEFAULT '{}',
				"triggered_by" uuid,
				"ran_at" timestamptz NOT NULL,
				CONSTRAINT "PK_hotspot_detection_runs" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_hotspot_detection_runs_window" CHECK ("window_start" < "window_end"),
				CONSTRAINT "FK_hotspot_detection_runs_triggered_by" FOREIGN KEY ("triggered_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "potential_safety_hotspots" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"route_id" uuid NOT NULL,
				"route_version" varchar(64) NOT NULL,
				"status" varchar(16) NOT NULL DEFAULT 'DETECTED',
				"status_changed_at" timestamptz NOT NULL,
				"analysis_version" varchar(64) NOT NULL,
				"config_version" varchar(32) NOT NULL,
				"criteria" jsonb NOT NULL,
				"window_start" timestamptz NOT NULL,
				"window_end" timestamptz NOT NULL,
				"center" geography(Point,4326) NOT NULL,
				"radius_meters" double precision NOT NULL,
				"anchor_event_id" uuid NOT NULL,
				"route_fraction_min" double precision NOT NULL,
				"route_fraction_max" double precision NOT NULL,
				"event_count" integer NOT NULL,
				"distinct_trip_count" integer NOT NULL,
				"distinct_member_count" integer NOT NULL,
				"evidence_event_ids" uuid[] NOT NULL,
				"evidence_hash" char(64) NOT NULL,
				"first_event_at" timestamptz NOT NULL,
				"last_event_at" timestamptz NOT NULL,
				"previous_hotspot_id" uuid,
				"detection_run_id" uuid,
				"detected_at" timestamptz NOT NULL,
				CONSTRAINT "PK_potential_safety_hotspots" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_potential_safety_hotspots_evidence"
					UNIQUE ("route_id", "route_version", "analysis_version", "evidence_hash"),
				CONSTRAINT "CHK_potential_safety_hotspots_status"
					CHECK ("status" IN ('DETECTED', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED')),
				CONSTRAINT "CHK_potential_safety_hotspots_counts" CHECK (
					"event_count" = cardinality("evidence_event_ids")
					AND "distinct_trip_count" BETWEEN 1 AND "event_count"
					AND "distinct_member_count" BETWEEN 1 AND "event_count"
				),
				CONSTRAINT "CHK_potential_safety_hotspots_window" CHECK (
					"window_start" < "window_end"
					AND "first_event_at" <= "last_event_at"
					AND "first_event_at" >= "window_start" AND "last_event_at" <= "window_end"
				),
				CONSTRAINT "CHK_potential_safety_hotspots_fraction"
					CHECK ("route_fraction_min" BETWEEN 0 AND 1 AND "route_fraction_max" BETWEEN "route_fraction_min" AND 1),
				CONSTRAINT "FK_potential_safety_hotspots_route" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_potential_safety_hotspots_previous" FOREIGN KEY ("previous_hotspot_id")
					REFERENCES "potential_safety_hotspots" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_potential_safety_hotspots_run" FOREIGN KEY ("detection_run_id")
					REFERENCES "hotspot_detection_runs" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_potential_safety_hotspots_route_status" ON "potential_safety_hotspots" ("route_id", "route_version", "status")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_potential_safety_hotspots_center" ON "potential_safety_hotspots" USING GIST ("center")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "potential_safety_hotspots"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "hotspot_detection_runs"`);
	}
}
