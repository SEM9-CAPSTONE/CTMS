import type { MigrationInterface, QueryRunner } from "typeorm";

export class AllowSurvivalDocumentDeletion1794000000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_versions
			 DROP CONSTRAINT survival_document_versions_document_id_fkey,
			 DROP CONSTRAINT survival_document_versions_original_version_id_fkey,
			 ADD FOREIGN KEY (document_id) REFERENCES survival_documents(id) ON DELETE CASCADE,
			 ADD FOREIGN KEY (original_version_id) REFERENCES survival_document_versions(id);

			DROP TRIGGER survival_version_immutable ON survival_document_versions;
			CREATE TRIGGER survival_version_immutable BEFORE UPDATE ON survival_document_versions
			 FOR EACH ROW EXECUTE FUNCTION survival_version_immutable();
			CREATE FUNCTION survival_version_require_parent_delete() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
			 IF EXISTS (SELECT 1 FROM survival_documents WHERE id=OLD.document_id) THEN
			  RAISE EXCEPTION 'Delete the entire survival document to remove its versions';
			 END IF;
			 RETURN OLD;
			END $$;
			CREATE TRIGGER survival_version_require_parent_delete BEFORE DELETE ON survival_document_versions
			 FOR EACH ROW EXECUTE FUNCTION survival_version_require_parent_delete();

			-- Outbox IDs describe the original event and must survive deletion of its source.
			ALTER TABLE survival_document_outbox
			 DROP CONSTRAINT survival_document_outbox_document_id_fkey,
			 DROP CONSTRAINT survival_document_outbox_version_id_fkey,
			 DROP CONSTRAINT survival_document_outbox_previous_version_id_fkey,
			 DROP CONSTRAINT survival_document_outbox_event_type_check,
			 ADD CONSTRAINT survival_document_outbox_event_type_check
			  CHECK(event_type IN ('published_version_changed','source_unavailable','document_deleted'));
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_outbox
			 DROP CONSTRAINT survival_document_outbox_event_type_check,
			 ADD CONSTRAINT survival_document_outbox_event_type_check
			  CHECK(event_type IN ('published_version_changed','source_unavailable')),
			 ADD FOREIGN KEY (document_id) REFERENCES survival_documents(id) ON DELETE RESTRICT,
			 ADD FOREIGN KEY (version_id) REFERENCES survival_document_versions(id) ON DELETE RESTRICT,
			 ADD FOREIGN KEY (previous_version_id) REFERENCES survival_document_versions(id) ON DELETE RESTRICT;

			DROP TRIGGER survival_version_require_parent_delete ON survival_document_versions;
			DROP FUNCTION survival_version_require_parent_delete();
			DROP TRIGGER survival_version_immutable ON survival_document_versions;
			CREATE TRIGGER survival_version_immutable BEFORE UPDATE OR DELETE ON survival_document_versions
			 FOR EACH ROW EXECUTE FUNCTION survival_version_immutable();
			ALTER TABLE survival_document_versions
			 DROP CONSTRAINT survival_document_versions_document_id_fkey,
			 DROP CONSTRAINT survival_document_versions_original_version_id_fkey,
			 ADD FOREIGN KEY (document_id) REFERENCES survival_documents(id) ON DELETE RESTRICT,
			 ADD FOREIGN KEY (original_version_id) REFERENCES survival_document_versions(id) ON DELETE RESTRICT;
		`);
	}
}
