import type { MigrationInterface, QueryRunner } from "typeorm";

export class IndexVisibleHostReputation1797100000000 implements MigrationInterface {
	transaction = false;

	async up(queryRunner: QueryRunner): Promise<void> {
		// A failed concurrent build may leave an invalid index behind.
		const [existing]: Array<{ valid: boolean }> = await queryRunner.query(
			"SELECT indisvalid AS valid FROM pg_index WHERE indexrelid=to_regclass('idx_trip_reviews_host_reputation')"
		);
		if (existing && !existing.valid) {
			await queryRunner.query("DROP INDEX CONCURRENTLY IF EXISTS IDX_trip_reviews_host_reputation");
		}
		await queryRunner.query(
			"CREATE INDEX CONCURRENTLY IF NOT EXISTS IDX_trip_reviews_host_reputation ON trip_reviews (host_id) WHERE target = 'host' AND moderation_status = 'visible'"
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP INDEX CONCURRENTLY IF EXISTS IDX_trip_reviews_host_reputation");
	}
}
