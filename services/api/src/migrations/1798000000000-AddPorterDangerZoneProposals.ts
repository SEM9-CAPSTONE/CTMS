import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPorterDangerZoneProposals1798000000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE "danger_zone_proposals"
			ADD COLUMN "trip_id" uuid REFERENCES "trips"("id") ON DELETE RESTRICT,
			ADD COLUMN "client_request_id" uuid,
			ADD COLUMN "request_payload" jsonb,
			DROP CONSTRAINT "CHK_danger_zone_proposals_source"`);
		await runner.query(`ALTER TABLE "danger_zone_proposals" ADD CONSTRAINT "CHK_danger_zone_proposals_source" CHECK (
			("source" = 'HOST' AND "incident_id" IS NULL AND "trip_id" IS NULL)
			OR ("source" = 'INCIDENT' AND "incident_id" IS NOT NULL AND "trip_id" IS NULL)
			OR ("source" = 'PORTER' AND "incident_id" IS NULL AND "trip_id" IS NOT NULL
				AND "client_request_id" IS NOT NULL AND "request_payload" IS NOT NULL
				AND GeometryType("geom"::geometry) = 'POINT' AND "location_accuracy_meters" >= 0)
		)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_porter_proposal_request" ON "danger_zone_proposals" ("proposer_id", "client_request_id") WHERE "source" = 'PORTER'`
		);
		await runner.query(
			`CREATE INDEX "IDX_porter_proposal_trip" ON "danger_zone_proposals" ("trip_id", "proposer_id", "created_at" DESC)`
		);
	}
	async down(runner: QueryRunner): Promise<void> {
		// Preserve field evidence: reverting is allowed only before any Porter submissions.
		await runner.query(
			`ALTER TABLE "danger_zone_proposals" DROP CONSTRAINT "CHK_danger_zone_proposals_source"`
		);
		await runner.query(`ALTER TABLE "danger_zone_proposals" ADD CONSTRAINT "CHK_danger_zone_proposals_source" CHECK (
			("source" = 'HOST' AND "incident_id" IS NULL) OR ("source" = 'INCIDENT' AND "incident_id" IS NOT NULL))`);
		await runner.query(`DROP INDEX "UQ_porter_proposal_request"`);
		await runner.query(`DROP INDEX "IDX_porter_proposal_trip"`);
		await runner.query(
			`ALTER TABLE "danger_zone_proposals" DROP COLUMN "trip_id", DROP COLUMN "client_request_id", DROP COLUMN "request_payload"`
		);
	}
}
