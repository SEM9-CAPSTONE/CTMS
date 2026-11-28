import type { MigrationInterface, QueryRunner } from "typeorm";

export class RequeueKnowledgeTransportFailures1798900000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		// Native fetch's five-minute headers deadline exhausted all recovery rounds
		// before long PDFs returned an extraction snapshot. Retry those empty jobs
		// once after deploying the transport fix; retain the normal retry cap.
		await runner.query(`
			UPDATE knowledge_chunk_sets s
			SET status='PENDING', attempts=0, recovery_round=0, error_code=NULL,
				retryable_failure=false, next_attempt_at=clock_timestamp(), completed_at=NULL,
				lease_token=NULL, lease_until=NULL
			FROM survival_documents d, survival_document_versions v
			WHERE s.document_id=d.id AND s.document_version_id=d.current_published_version_id
				AND v.id=s.document_version_id AND v.document_id=d.id AND v.status='PUBLISHED'
				AND s.status='FAILED' AND s.error_code='ingestion_transport' AND s.retryable_failure
				AND s.attempts>=3 AND s.recovery_round>=2
				AND s.configuration->>'pipeline_version'='ctms-content-integrity-v5'
				AND s.extraction_snapshot IS NULL AND s.quality_report IS NULL AND s.chunk_count=0
				AND NOT EXISTS (
					SELECT 1 FROM knowledge_chunk_sets newer
					WHERE newer.document_version_id=s.document_version_id
						AND (newer.created_at,newer.id)>(s.created_at,s.id)
				)
		`);
	}

	async down(): Promise<void> {
		// A requeued job may already be processing or complete. Rolling back must
		// not overwrite its subsequent state or discard extracted content.
	}
}
