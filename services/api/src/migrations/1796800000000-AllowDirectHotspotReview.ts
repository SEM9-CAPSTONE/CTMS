import type { MigrationInterface, QueryRunner } from "typeorm";

/** Direct Admin decisions, while retaining the validity of historical review steps. */
export class AllowDirectHotspotReview1796800000000 implements MigrationInterface {
	name = "AllowDirectHotspotReview1796800000000";

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "hotspot_reviews"
			DROP CONSTRAINT "CHK_hotspot_reviews_transition",
			ADD CONSTRAINT "CHK_hotspot_reviews_transition" CHECK (
				("from_status" = 'DETECTED' AND "to_status" IN ('UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'))
				OR ("from_status" = 'UNDER_REVIEW' AND "to_status" IN ('CONFIRMED', 'DISMISSED'))
			)
		`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		const [row] = (await queryRunner.query(`
			SELECT EXISTS (
				SELECT 1 FROM "hotspot_reviews"
				WHERE "from_status" = 'DETECTED' AND "to_status" IN ('CONFIRMED', 'DISMISSED')
			) AS "hasDirectDecisions"
		`)) as Array<{ hasDirectDecisions: boolean }>;
		if (row.hasDirectDecisions) {
			throw new Error(
				"Cannot revert direct hotspot review while direct decisions exist; preserve review history."
			);
		}
		await queryRunner.query(`
			ALTER TABLE "hotspot_reviews"
			DROP CONSTRAINT "CHK_hotspot_reviews_transition",
			ADD CONSTRAINT "CHK_hotspot_reviews_transition" CHECK (
				("from_status" = 'DETECTED' AND "to_status" = 'UNDER_REVIEW')
				OR ("from_status" = 'UNDER_REVIEW' AND "to_status" IN ('CONFIRMED', 'DISMISSED'))
			)
		`);
	}
}
