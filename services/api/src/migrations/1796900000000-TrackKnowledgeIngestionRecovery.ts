import type { MigrationInterface, QueryRunner } from "typeorm";

export class TrackKnowledgeIngestionRecovery1796900000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE knowledge_chunk_sets
			  ADD COLUMN retryable_failure boolean NOT NULL DEFAULT false,
			  ADD COLUMN recovery_round integer NOT NULL DEFAULT 0 CHECK (recovery_round >= 0);

			UPDATE knowledge_chunk_sets s SET status='OBSOLETE',error_code='source_changed_or_unavailable',
			  lease_token=NULL,lease_until=NULL,completed_at=clock_timestamp()
			WHERE s.status IN ('PENDING','RUNNING') AND NOT EXISTS (
			  SELECT 1 FROM survival_documents d
			  WHERE d.id=s.document_id AND d.current_published_version_id=s.document_version_id
			);

			UPDATE knowledge_chunk_sets SET retryable_failure=true
			WHERE status='FAILED' AND error_code IS NOT NULL AND (
			  error_code IN ('lease_expired','ingestion_transport','ingestion_not_configured','ingestion_http_401','ingestion_http_429')
			  OR error_code ~ '^ingestion_http_5[0-9]{2}$'
			);

			CREATE INDEX knowledge_chunk_recovery ON knowledge_chunk_sets (next_attempt_at,id)
			  WHERE status='FAILED' AND retryable_failure;
			CREATE INDEX knowledge_chunk_expired_leases ON knowledge_chunk_sets (lease_until,id)
			  WHERE status='RUNNING';
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			DROP INDEX knowledge_chunk_expired_leases;
			DROP INDEX knowledge_chunk_recovery;
			ALTER TABLE knowledge_chunk_sets DROP COLUMN recovery_round, DROP COLUMN retryable_failure;
		`);
	}
}
