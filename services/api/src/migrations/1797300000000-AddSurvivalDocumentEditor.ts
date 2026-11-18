import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSurvivalDocumentEditor1797300000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			CREATE TABLE survival_document_edit_drafts (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				document_id uuid NOT NULL REFERENCES survival_documents(id) ON DELETE CASCADE,
				base_version_id uuid NOT NULL,
				base_revision integer NOT NULL,
				created_by uuid NOT NULL,
				revision integer NOT NULL DEFAULT 1,
				snapshot jsonb NOT NULL,
				confirmed_revision integer,
				materialized_version_id uuid UNIQUE,
				UNIQUE(document_id,base_version_id,base_revision,created_by),
				FOREIGN KEY(document_id,base_version_id) REFERENCES survival_document_versions(document_id,id) ON DELETE CASCADE,
				FOREIGN KEY(document_id,materialized_version_id) REFERENCES survival_document_versions(document_id,id) ON DELETE CASCADE
			);
			CREATE TABLE survival_document_edit_requests (
				draft_id uuid NOT NULL REFERENCES survival_document_edit_drafts(id) ON DELETE CASCADE,
				request_id uuid NOT NULL,
				fingerprint varchar(64) NOT NULL,
				PRIMARY KEY(draft_id,request_id)
			);
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP TABLE survival_document_edit_requests, survival_document_edit_drafts");
	}
}
