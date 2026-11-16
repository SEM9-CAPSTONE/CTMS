import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Danger-zone proposals (CTMS-117 amendment, 2026-11-16). A Host proposes a hazard on one of their
 * Routes, or an eligible field incident with a fresh position produces one automatically. Every
 * proposal waits for an Admin decision; only an approved proposal creates the authoritative
 * route_danger_zones row that the shared map layer publishes. The approved snapshot pins exactly
 * what the Admin approved so later unapproved edits are not published.
 *
 * Also records CTMS-117 hotspot review transitions (BR-424) and adds the incident categories the
 * Porter app needs for slippery/landslide ground and damaged barriers.
 */
export class CreateDangerZoneProposals1796400000000 implements MigrationInterface {
	name = "CreateDangerZoneProposals1796400000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "incident_category" ADD VALUE IF NOT EXISTS 'slippery_or_landslide'`
		);
		await queryRunner.query(
			`ALTER TYPE "incident_category" ADD VALUE IF NOT EXISTS 'damaged_barrier'`
		);

		await queryRunner.query(`
			CREATE TABLE "danger_zone_proposals" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"source" varchar(16) NOT NULL,
				"route_id" uuid NOT NULL,
				"incident_id" uuid,
				"proposer_id" uuid NOT NULL,
				"hazard_type" varchar(32) NOT NULL,
				"geom" geography(Geometry,4326) NOT NULL,
				"radius_m" double precision,
				"severity" "route_danger_zone_severity" NOT NULL,
				"description" varchar(2000) NOT NULL,
				"location_accuracy_meters" double precision,
				"observed_at" timestamptz NOT NULL,
				"status" varchar(16) NOT NULL DEFAULT 'PENDING',
				"reviewer_id" uuid,
				"reviewed_at" timestamptz,
				"review_reason" varchar(1000),
				"danger_zone_id" uuid,
				"approved_snapshot" jsonb,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_danger_zone_proposals" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_danger_zone_proposals_incident" UNIQUE ("incident_id"),
				CONSTRAINT "UQ_danger_zone_proposals_zone" UNIQUE ("danger_zone_id"),
				CONSTRAINT "CHK_danger_zone_proposals_source" CHECK (
					("source" = 'HOST' AND "incident_id" IS NULL)
					OR ("source" = 'INCIDENT' AND "incident_id" IS NOT NULL)
				),
				CONSTRAINT "CHK_danger_zone_proposals_hazard_type" CHECK ("hazard_type" IN (
					'ROUTE_OBSTRUCTION', 'LOST_MEMBER', 'SLIPPERY_OR_LANDSLIDE', 'DAMAGED_BARRIER',
					'WILDLIFE', 'OTHER'
				)),
				CONSTRAINT "CHK_danger_zone_proposals_geometry" CHECK (
					GeometryType("geom"::geometry) IN ('POINT', 'POLYGON')
				),
				CONSTRAINT "CHK_danger_zone_proposals_radius" CHECK (
					(GeometryType("geom"::geometry) = 'POINT' AND "radius_m" > 0)
					OR (GeometryType("geom"::geometry) = 'POLYGON' AND "radius_m" IS NULL)
				),
				CONSTRAINT "CHK_danger_zone_proposals_status" CHECK (
					("status" = 'PENDING' AND "reviewer_id" IS NULL AND "reviewed_at" IS NULL
						AND "danger_zone_id" IS NULL AND "approved_snapshot" IS NULL)
					OR ("status" = 'APPROVED' AND "reviewer_id" IS NOT NULL AND "reviewed_at" IS NOT NULL
						AND "danger_zone_id" IS NOT NULL AND "approved_snapshot" IS NOT NULL)
					OR ("status" = 'REJECTED' AND "reviewer_id" IS NOT NULL AND "reviewed_at" IS NOT NULL
						AND "danger_zone_id" IS NULL AND "approved_snapshot" IS NULL
						AND char_length(btrim(coalesce("review_reason", ''))) >= 10)
				),
				CONSTRAINT "FK_danger_zone_proposals_route" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_danger_zone_proposals_incident" FOREIGN KEY ("incident_id")
					REFERENCES "trip_incidents" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_danger_zone_proposals_proposer" FOREIGN KEY ("proposer_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_danger_zone_proposals_reviewer" FOREIGN KEY ("reviewer_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_danger_zone_proposals_zone" FOREIGN KEY ("danger_zone_id")
					REFERENCES "route_danger_zones" ("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_danger_zone_proposals_status" ON "danger_zone_proposals" ("status", "created_at" DESC)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_danger_zone_proposals_route" ON "danger_zone_proposals" ("route_id", "created_at" DESC)`
		);

		await queryRunner.query(`
			CREATE TABLE "hotspot_reviews" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"hotspot_id" uuid NOT NULL,
				"actor_id" uuid NOT NULL,
				"from_status" varchar(16) NOT NULL,
				"to_status" varchar(16) NOT NULL,
				"reason" varchar(1000) NOT NULL,
				"evidence_hash" char(64) NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_hotspot_reviews" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_hotspot_reviews_transition" CHECK (
					("from_status" = 'DETECTED' AND "to_status" = 'UNDER_REVIEW')
					OR ("from_status" = 'UNDER_REVIEW' AND "to_status" IN ('CONFIRMED', 'DISMISSED'))
				),
				CONSTRAINT "CHK_hotspot_reviews_reason" CHECK (char_length(btrim("reason")) >= 10),
				CONSTRAINT "FK_hotspot_reviews_hotspot" FOREIGN KEY ("hotspot_id")
					REFERENCES "potential_safety_hotspots" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_hotspot_reviews_actor" FOREIGN KEY ("actor_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_hotspot_reviews_hotspot" ON "hotspot_reviews" ("hotspot_id", "created_at")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "hotspot_reviews"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "danger_zone_proposals"`);
		// Postgres cannot drop enum values; the extra incident categories remain harmless.
	}
}
