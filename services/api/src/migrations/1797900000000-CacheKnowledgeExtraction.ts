import type { MigrationInterface, QueryRunner } from "typeorm";

export class CacheKnowledgeExtraction1797900000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		// Private, version/configuration-bound extraction cache. Review summaries
		// stay in quality_report; source files and publication rows are unchanged.
		await runner.query("ALTER TABLE knowledge_chunk_sets ADD COLUMN extraction_snapshot jsonb");
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query("ALTER TABLE knowledge_chunk_sets DROP COLUMN extraction_snapshot");
	}
}
