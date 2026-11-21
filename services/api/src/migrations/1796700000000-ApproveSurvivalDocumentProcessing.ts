import type { MigrationInterface, QueryRunner } from "typeorm";

export class ApproveSurvivalDocumentProcessing1796700000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_versions
			 ADD COLUMN processing_approved_at timestamptz
			 CHECK (processing_approved_at IS NULL OR published_at IS NOT NULL);
			ALTER TABLE survival_document_outbox
			 DROP CONSTRAINT survival_document_outbox_event_type_check,
			 ADD CONSTRAINT survival_document_outbox_event_type_check
			  CHECK (event_type IN ('published_version_changed','source_unavailable','document_deleted','processing_approved'));
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			DELETE FROM survival_document_outbox WHERE event_type='processing_approved';
			ALTER TABLE survival_document_outbox
			 DROP CONSTRAINT survival_document_outbox_event_type_check,
			 ADD CONSTRAINT survival_document_outbox_event_type_check
			  CHECK (event_type IN ('published_version_changed','source_unavailable','document_deleted'));
			ALTER TABLE survival_document_versions DROP COLUMN processing_approved_at;
		`);
	}
}
