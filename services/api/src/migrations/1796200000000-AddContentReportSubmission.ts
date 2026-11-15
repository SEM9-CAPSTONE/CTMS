import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddContentReportSubmission1796200000000 implements MigrationInterface {
	name = "AddContentReportSubmission1796200000000";

	async up(queryRunner: QueryRunner): Promise<void> {
		// No legacy report is rewritten, reclassified or deleted. Duplicate open legacy cases
		// must be resolved through the existing moderation workflow before this migration.
		await queryRunner.query(`ALTER TABLE content_reports
			ADD COLUMN report_type varchar(40), ADD COLUMN idempotency_key uuid, ADD COLUMN request_hash varchar(64),
			ADD CONSTRAINT "CHK_content_reports_submission" CHECK (
			 (report_type IS NULL AND idempotency_key IS NULL AND request_hash IS NULL) OR
			 (report_type IS NOT NULL AND report_type IN ('inaccurate_information','dangerous_content')
			 AND idempotency_key IS NOT NULL AND request_hash IS NOT NULL AND request_hash ~ '^[a-f0-9]{64}$'
			 AND target_type='trip_review'))`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_content_reports_reporter_key"
			ON content_reports(reporter_id,idempotency_key)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_content_reports_open_target"
			ON content_reports(reporter_id,target_type,target_id) WHERE status IN ('pending','reviewing')`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "UQ_content_reports_open_target"`);
		await queryRunner.query(`DROP INDEX "UQ_content_reports_reporter_key"`);
		await queryRunner.query(`ALTER TABLE content_reports DROP CONSTRAINT "CHK_content_reports_submission",
			DROP COLUMN request_hash, DROP COLUMN idempotency_key, DROP COLUMN report_type`);
	}
}
