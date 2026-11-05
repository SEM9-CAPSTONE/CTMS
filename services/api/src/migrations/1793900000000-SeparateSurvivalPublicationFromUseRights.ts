import type { MigrationInterface, QueryRunner } from "typeorm";

const verifiedRights = `reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
	rights @> '{"rightsReviewStatus":"PERMITTED","sourceReviewConfirmed":true,"internalRagUseAllowed":true}'::jsonb AND
	COALESCE(length(btrim(rights->>'evidence')),0)>=10`;

export class SeparateSurvivalPublicationFromUseRights1793900000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_versions
			DROP CONSTRAINT survival_document_versions_publication_rights_check,
			ADD CONSTRAINT survival_document_versions_publication_rights_check
			CHECK(status='DRAFT' OR
			 (published_by IS NOT NULL AND published_at IS NOT NULL AND
			  (rights->>'rightsReviewStatus' IS DISTINCT FROM 'PERMITTED' OR (${verifiedRights}))))
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_versions
			DROP CONSTRAINT survival_document_versions_publication_rights_check,
			ADD CONSTRAINT survival_document_versions_publication_rights_check
			CHECK(status='DRAFT' OR
			 (published_by IS NOT NULL AND published_at IS NOT NULL AND ${verifiedRights}))
		`);
	}
}
