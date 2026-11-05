import type { MigrationInterface, QueryRunner } from "typeorm";

export class IndexSurvivalDocumentFilename1793800000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(
			"CREATE INDEX survival_document_versions_filename_idx ON survival_document_versions (lower(btrim(normalize(original_filename))))"
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP INDEX survival_document_versions_filename_idx");
	}
}
