import type { MigrationInterface, QueryRunner } from "typeorm";

export class IndexSurvivalDocumentChecksum1793700000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		// Existing duplicates remain part of their document and version histories.
		await runner.query(
			"CREATE INDEX survival_document_versions_checksum_idx ON survival_document_versions(checksum)"
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP INDEX survival_document_versions_checksum_idx");
	}
}
