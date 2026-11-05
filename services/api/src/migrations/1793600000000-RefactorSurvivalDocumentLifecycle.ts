import type { MigrationInterface, QueryRunner } from "typeorm";

function versionGuard(transition: string, frozenStatuses: string): string {
	return `CREATE OR REPLACE FUNCTION survival_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
	 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source versions cannot be deleted'; END IF;
	 IF NEW.status<>OLD.status AND NOT (${transition})
	 THEN RAISE EXCEPTION 'Illegal source lifecycle transition'; END IF;
	 IF (NEW.id,NEW.document_id,NEW.version_number,NEW.file_ref,NEW.original_filename,NEW.checksum,NEW.size,NEW.content_type,NEW.created_by,NEW.created_at)
	  IS DISTINCT FROM (OLD.id,OLD.document_id,OLD.version_number,OLD.file_ref,OLD.original_filename,OLD.checksum,OLD.size,OLD.content_type,OLD.created_by,OLD.created_at)
	 THEN RAISE EXCEPTION 'Source file identity is immutable'; END IF;
	 IF OLD.status IN (${frozenStatuses}) AND
	  (NEW.metadata,NEW.rights,NEW.original_version_id,NEW.reviewed_by,NEW.reviewed_at) IS DISTINCT FROM
	  (OLD.metadata,OLD.rights,OLD.original_version_id,OLD.reviewed_by,OLD.reviewed_at)
	 THEN RAISE EXCEPTION 'Source provenance is immutable'; END IF;
	 IF OLD.published_at IS NOT NULL AND (NEW.published_at,NEW.published_by) IS DISTINCT FROM (OLD.published_at,OLD.published_by)
	 THEN RAISE EXCEPTION 'Publication provenance is immutable'; END IF;
	 RETURN NEW; END $$;`;
}

export class RefactorSurvivalDocumentLifecycle1793600000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
		ALTER TABLE survival_document_versions DISABLE TRIGGER survival_version_immutable;
		ALTER TABLE survival_document_versions
		 DROP CONSTRAINT survival_document_versions_status_check,
		 DROP CONSTRAINT survival_document_versions_check;

		INSERT INTO audit_logs(action,target_type,target_id,"before","after")
		 SELECT 'survival_document.reopen_legacy_draft','survival_document',document_id,
		  jsonb_build_object('versionId',id,'status',status,'revision',revision,
		   'rightsReviewStatus',rights->>'rightsReviewStatus'),
		  jsonb_build_object('versionId',id,'status','DRAFT','revision',revision+1)
		 FROM survival_document_versions WHERE status IN ('IN_REVIEW','APPROVED','REJECTED');

		WITH reopened AS (
		 UPDATE survival_document_versions SET
		  status='DRAFT',revision=revision+1,
		  rights=CASE WHEN status='APPROVED' THEN rights ELSE jsonb_build_object(
		   'rightsReviewStatus',CASE WHEN status='REJECTED' THEN 'RESTRICTED' ELSE 'NOT_REVIEWED' END,
		   'sourceReviewConfirmed',false,'internalRagUseAllowed',false,
		   'offlineRedistributionAllowed',false,'translationAllowed',false,
		   'medicalContentReviewStatus','NOT_REVIEWED','evidence',COALESCE(rights->>'evidence','')) END
		 WHERE status IN ('IN_REVIEW','APPROVED','REJECTED') RETURNING document_id
		)
		UPDATE survival_documents SET revision=revision+1,updated_at=now()
		 WHERE id IN (SELECT document_id FROM reopened);

		ALTER TABLE survival_document_versions
		 ADD CONSTRAINT survival_document_versions_status_check
		  CHECK(status IN ('DRAFT','PUBLISHED','SUPERSEDED','ARCHIVED')),
		 ADD CONSTRAINT survival_document_versions_publication_rights_check
		  CHECK(status='DRAFT' OR
		   (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
		    published_by IS NOT NULL AND published_at IS NOT NULL AND
		    rights @> '{"rightsReviewStatus":"PERMITTED","sourceReviewConfirmed":true,"internalRagUseAllowed":true}'::jsonb AND
		    COALESCE(length(btrim(rights->>'evidence')),0)>=10));

		${versionGuard(
			`(OLD.status='DRAFT' AND NEW.status='PUBLISHED') OR
			 (OLD.status='PUBLISHED' AND NEW.status IN ('SUPERSEDED','ARCHIVED'))`,
			"'PUBLISHED','SUPERSEDED','ARCHIVED'"
		)}
		ALTER TABLE survival_document_versions ENABLE TRIGGER survival_version_immutable;
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
		ALTER TABLE survival_document_versions DISABLE TRIGGER survival_version_immutable;
		ALTER TABLE survival_document_versions
		 DROP CONSTRAINT survival_document_versions_status_check,
		 DROP CONSTRAINT survival_document_versions_publication_rights_check,
		 ADD CONSTRAINT survival_document_versions_status_check
		  CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','REJECTED','SUPERSEDED','ARCHIVED')),
		 ADD CONSTRAINT survival_document_versions_check
		  CHECK(status NOT IN ('APPROVED','PUBLISHED','SUPERSEDED') OR
		   (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rights->>'rightsReviewStatus'='PERMITTED'
		    AND rights->>'sourceReviewConfirmed'='true' AND rights->>'internalRagUseAllowed'='true'));

		WITH legacy AS (
		 SELECT DISTINCT ON ("after"->>'versionId') "before","after"
		 FROM audit_logs WHERE action='survival_document.reopen_legacy_draft'
		 ORDER BY "after"->>'versionId',created_at DESC,id DESC
		), restored AS (
		 UPDATE survival_document_versions v SET status=legacy."before"->>'status',revision=v.revision+1
		 FROM legacy WHERE v.id=(legacy."after"->>'versionId')::uuid AND v.status='DRAFT'
		  AND v.revision=(legacy."after"->>'revision')::integer RETURNING v.document_id
		)
		UPDATE survival_documents SET revision=revision+1,updated_at=now()
		 WHERE id IN (SELECT document_id FROM restored);

		${versionGuard(
			`(OLD.status='DRAFT' AND NEW.status='IN_REVIEW') OR
			 (OLD.status='IN_REVIEW' AND NEW.status IN ('APPROVED','REJECTED')) OR
			 (OLD.status='APPROVED' AND NEW.status='PUBLISHED') OR
			 (OLD.status='PUBLISHED' AND NEW.status IN ('SUPERSEDED','ARCHIVED'))`,
			"'APPROVED','PUBLISHED','SUPERSEDED','ARCHIVED','REJECTED'"
		)}
		ALTER TABLE survival_document_versions ENABLE TRIGGER survival_version_immutable;
		`);
	}
}
