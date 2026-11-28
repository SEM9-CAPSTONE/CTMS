import type { MigrationInterface, QueryRunner } from "typeorm";

export class PrepareDraftKnowledge1799000000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE survival_document_versions
			 ADD COLUMN knowledge_revision integer NOT NULL DEFAULT 1 CHECK(knowledge_revision>0),
			 ADD COLUMN preparation_confirmed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
			 ADD COLUMN preparation_confirmed_at timestamptz,
			 ADD COLUMN restored_from_version_id uuid,
			 ADD COLUMN restoration_reason text,
			 ADD CONSTRAINT survival_restoration_source FOREIGN KEY(document_id,restored_from_version_id)
			  REFERENCES survival_document_versions(document_id,id) DEFERRABLE INITIALLY DEFERRED,
			 ADD CONSTRAINT survival_restoration_reason CHECK((restored_from_version_id IS NULL AND restoration_reason IS NULL)
			  OR (restored_from_version_id IS NOT NULL AND restoration_reason IS NOT NULL AND length(btrim(restoration_reason))>=10));
			ALTER TABLE knowledge_chunk_sets
			 ADD COLUMN input_revision integer NOT NULL DEFAULT 1 CHECK(input_revision>0),
			 ADD COLUMN source_title text;
			UPDATE knowledge_chunk_sets s SET source_title=v.metadata->>'sourceTitle'
			 FROM survival_document_versions v WHERE v.id=s.document_version_id;
			ALTER TABLE knowledge_chunk_sets
			 DROP CONSTRAINT knowledge_chunk_sets_document_version_id_config_hash_key,
			 ADD CONSTRAINT knowledge_chunk_sets_input_identity UNIQUE(document_version_id,config_hash,input_revision);
			ALTER TABLE survival_document_outbox
			 DROP CONSTRAINT survival_document_outbox_version_id_event_type_key,
			 DROP CONSTRAINT survival_document_outbox_event_type_check,
			 ADD CONSTRAINT survival_document_outbox_event_type_check CHECK(event_type IN
			 ('published_version_changed','source_unavailable','document_deleted','processing_approved','draft_preparation_requested'));
			-- Existing publications, chunks, active pointers and shared vectors are retained.
			-- Preparation deliveries are idempotent by exact version/configuration/input revision.
			CREATE UNIQUE INDEX survival_document_lifecycle_event ON survival_document_outbox(version_id,event_type)
			 WHERE event_type<>'draft_preparation_requested';
			CREATE UNIQUE INDEX survival_document_preparation_event ON survival_document_outbox(version_id,(payload->>'inputRevision'))
			 WHERE event_type='draft_preparation_requested';
			CREATE FUNCTION survival_preparation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
			 IF OLD.status<>'DRAFT' AND
			 (NEW.knowledge_revision,NEW.preparation_confirmed_by,NEW.preparation_confirmed_at,NEW.restored_from_version_id,NEW.restoration_reason)
			 IS DISTINCT FROM
			 (OLD.knowledge_revision,OLD.preparation_confirmed_by,OLD.preparation_confirmed_at,OLD.restored_from_version_id,OLD.restoration_reason)
			 THEN RAISE EXCEPTION 'Published preparation and restoration provenance is immutable'; END IF;
			 RETURN NEW; END $$;
			CREATE TRIGGER survival_preparation_immutable BEFORE UPDATE ON survival_document_versions
			 FOR EACH ROW EXECUTE FUNCTION survival_preparation_immutable();
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		// Do not discard distinct extraction histories to make the older unique key fit.
		await runner.query(`DO $$ BEGIN
		 IF EXISTS(SELECT 1 FROM knowledge_chunk_sets GROUP BY document_version_id,config_hash HAVING count(*)>1)
		 OR EXISTS(SELECT 1 FROM knowledge_chunk_sets WHERE input_revision<>1)
		 OR EXISTS(SELECT 1 FROM survival_document_versions WHERE knowledge_revision<>1)
		 OR EXISTS(SELECT 1 FROM survival_document_versions WHERE restored_from_version_id IS NOT NULL)
		 THEN RAISE EXCEPTION 'Retained preparation revisions require the current schema'; END IF;
		 END $$;
		 DELETE FROM survival_document_outbox WHERE event_type='draft_preparation_requested';
		 DROP TRIGGER survival_preparation_immutable ON survival_document_versions;
		 DROP FUNCTION survival_preparation_immutable();
		 DROP INDEX survival_document_preparation_event;
		 DROP INDEX survival_document_lifecycle_event;
		 ALTER TABLE survival_document_outbox DROP CONSTRAINT survival_document_outbox_event_type_check,
		 ADD UNIQUE(version_id,event_type),
		 ADD CONSTRAINT survival_document_outbox_event_type_check CHECK(event_type IN
		 ('published_version_changed','source_unavailable','document_deleted','processing_approved'));
		 ALTER TABLE knowledge_chunk_sets DROP CONSTRAINT knowledge_chunk_sets_input_identity,
		 ADD UNIQUE(document_version_id,config_hash), DROP COLUMN input_revision, DROP COLUMN source_title;
		 ALTER TABLE survival_document_versions DROP COLUMN knowledge_revision,
		 DROP COLUMN preparation_confirmed_by, DROP COLUMN preparation_confirmed_at,
		 DROP COLUMN restored_from_version_id, DROP COLUMN restoration_reason;`);
	}
}
