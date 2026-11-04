import type { MigrationInterface, QueryRunner } from "typeorm";

export class ManageSurvivalDocuments1793500000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
		CREATE TABLE survival_documents (
		 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
		 version_count integer NOT NULL DEFAULT 1 CHECK(version_count>0), current_published_version_id uuid,
		 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
		 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE TABLE survival_document_uploads (
		 file_ref uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),version_id uuid UNIQUE
		);
		CREATE TABLE survival_document_versions (
		 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES survival_documents(id) ON DELETE RESTRICT,
		 version_number integer NOT NULL CHECK(version_number>0),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
		 status varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','REJECTED','SUPERSEDED','ARCHIVED')),
		 metadata jsonb NOT NULL,rights jsonb NOT NULL,
		 file_ref uuid NOT NULL UNIQUE REFERENCES survival_document_uploads(file_ref) ON DELETE RESTRICT,
		 original_filename varchar(180) NOT NULL,checksum varchar(64) NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
		 size integer NOT NULL CHECK(size>0 AND size<=52428800),content_type varchar(80) NOT NULL CHECK(content_type='application/pdf'),
		 original_version_id uuid REFERENCES survival_document_versions(id) ON DELETE RESTRICT,
		 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
		 reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,reviewed_at timestamptz,
		 published_by uuid REFERENCES users(id) ON DELETE RESTRICT,published_at timestamptz,reason varchar(2000),
		 UNIQUE(document_id,version_number),UNIQUE(document_id,id),
		 CHECK(status NOT IN ('APPROVED','PUBLISHED','SUPERSEDED') OR
		  (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rights->>'rightsReviewStatus'='PERMITTED'
		   AND rights->>'sourceReviewConfirmed'='true' AND rights->>'internalRagUseAllowed'='true'))
		);
		ALTER TABLE survival_documents ADD CONSTRAINT survival_document_current_version FOREIGN KEY(id,current_published_version_id)
		 REFERENCES survival_document_versions(document_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
		ALTER TABLE survival_document_uploads ADD CONSTRAINT survival_upload_version FOREIGN KEY(version_id) REFERENCES survival_document_versions(id) ON DELETE RESTRICT;
		CREATE UNIQUE INDEX survival_document_one_published ON survival_document_versions(document_id) WHERE status='PUBLISHED';
		CREATE INDEX survival_document_version_queue ON survival_document_versions(status,created_at DESC);
		CREATE TABLE survival_document_outbox (
		 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES survival_documents(id) ON DELETE RESTRICT,
		 version_id uuid NOT NULL REFERENCES survival_document_versions(id) ON DELETE RESTRICT,
		 previous_version_id uuid REFERENCES survival_document_versions(id) ON DELETE RESTRICT,
		 event_type varchar(40) NOT NULL CHECK(event_type IN ('published_version_changed','source_unavailable')),
		 payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(version_id,event_type)
		);
		CREATE FUNCTION survival_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
		 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source versions cannot be deleted'; END IF;
		 IF NEW.status<>OLD.status AND NOT (
		  (OLD.status='DRAFT' AND NEW.status='IN_REVIEW') OR
		  (OLD.status='IN_REVIEW' AND NEW.status IN ('APPROVED','REJECTED')) OR
		  (OLD.status='APPROVED' AND NEW.status='PUBLISHED') OR
		  (OLD.status='PUBLISHED' AND NEW.status IN ('SUPERSEDED','ARCHIVED')))
		 THEN RAISE EXCEPTION 'Illegal source lifecycle transition'; END IF;
		 IF (NEW.id,NEW.document_id,NEW.version_number,NEW.file_ref,NEW.original_filename,NEW.checksum,NEW.size,NEW.content_type,NEW.created_by,NEW.created_at)
		  IS DISTINCT FROM (OLD.id,OLD.document_id,OLD.version_number,OLD.file_ref,OLD.original_filename,OLD.checksum,OLD.size,OLD.content_type,OLD.created_by,OLD.created_at)
		 THEN RAISE EXCEPTION 'Source file identity is immutable'; END IF;
		 IF OLD.status IN ('APPROVED','PUBLISHED','SUPERSEDED','ARCHIVED','REJECTED') AND
		  (NEW.metadata,NEW.rights,NEW.original_version_id,NEW.reviewed_by,NEW.reviewed_at) IS DISTINCT FROM
		  (OLD.metadata,OLD.rights,OLD.original_version_id,OLD.reviewed_by,OLD.reviewed_at)
		 THEN RAISE EXCEPTION 'Reviewed source provenance is immutable'; END IF;
		 IF OLD.published_at IS NOT NULL AND (NEW.published_at,NEW.published_by) IS DISTINCT FROM (OLD.published_at,OLD.published_by)
		 THEN RAISE EXCEPTION 'Publication provenance is immutable'; END IF;
		 RETURN NEW; END $$;
		CREATE TRIGGER survival_version_immutable BEFORE UPDATE OR DELETE ON survival_document_versions FOR EACH ROW EXECUTE FUNCTION survival_version_immutable();
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE survival_document_outbox;
		ALTER TABLE survival_documents DROP CONSTRAINT survival_document_current_version;
		ALTER TABLE survival_document_uploads DROP CONSTRAINT survival_upload_version;
		DROP TABLE survival_document_versions; DROP FUNCTION survival_version_immutable();
		DROP TABLE survival_document_uploads; DROP TABLE survival_documents;`);
	}
}
