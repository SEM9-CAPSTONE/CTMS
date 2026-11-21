import type { MigrationInterface, QueryRunner } from "typeorm";

/** Field photos a Porter attaches to a danger-zone report as evidence for the Admin review. */
export class AddDangerZoneProposalPhotos1798100000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "danger_zone_proposal_photos" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			"proposal_id" uuid NOT NULL REFERENCES "danger_zone_proposals"("id") ON DELETE CASCADE,
			"url" varchar(512) NOT NULL,
			"content_type" varchar(32) NOT NULL,
			"size_bytes" integer NOT NULL CHECK ("size_bytes" > 0),
			"sha256" char(64) NOT NULL,
			"created_at" timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT "UQ_danger_zone_proposal_photo" UNIQUE ("proposal_id", "sha256")
		)`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE "danger_zone_proposal_photos"`);
	}
}
