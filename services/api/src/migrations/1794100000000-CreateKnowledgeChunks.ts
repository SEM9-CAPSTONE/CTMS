import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateKnowledgeChunks1794100000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
		 CREATE TABLE knowledge_chunk_sets (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		  document_id uuid NOT NULL REFERENCES survival_documents(id) ON DELETE CASCADE,
		  document_version_id uuid NOT NULL,
		  source_version integer NOT NULL CHECK(source_version>0),
		  checksum varchar(64) NOT NULL, locale varchar(35) NOT NULL,
		  configuration jsonb NOT NULL, config_hash varchar(64) NOT NULL,
		  status varchar(24) NOT NULL DEFAULT 'PENDING'
		   CHECK(status IN ('PENDING','RUNNING','READY','FAILED','NEEDS_REVIEW','OBSOLETE')),
		  attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
		  next_attempt_at timestamptz NOT NULL DEFAULT now(), error_code varchar(80),
		  quality_report jsonb, chunk_count integer NOT NULL DEFAULT 0 CHECK(chunk_count>=0),
		  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
		  FOREIGN KEY(document_id,document_version_id) REFERENCES survival_document_versions(document_id,id) ON DELETE CASCADE,
		  UNIQUE(document_version_id,config_hash), UNIQUE(id,document_id),
		  UNIQUE(id,document_version_id,source_version,locale),
		  CHECK(status<>'READY' OR (chunk_count>0 AND completed_at IS NOT NULL)),
		  CHECK((status='RUNNING')=(lease_token IS NOT NULL AND lease_until IS NOT NULL))
		 );
		 CREATE INDEX knowledge_chunk_queue ON knowledge_chunk_sets(status,next_attempt_at,created_at);
		 CREATE TABLE knowledge_chunks (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chunk_set_id uuid NOT NULL,
		  document_version_id uuid NOT NULL, source_version integer NOT NULL, locale varchar(35) NOT NULL,
		  chunk_index integer NOT NULL CHECK(chunk_index>=0), content text NOT NULL CHECK(length(btrim(content))>0),
		  embedding_text text NOT NULL, metadata jsonb NOT NULL,
		  embedding double precision[] NOT NULL CHECK(cardinality(embedding)>0),
		  FOREIGN KEY(chunk_set_id,document_version_id,source_version,locale)
		   REFERENCES knowledge_chunk_sets(id,document_version_id,source_version,locale) ON DELETE CASCADE,
		  UNIQUE(chunk_set_id,chunk_index)
		 );
		 CREATE TABLE knowledge_chunk_publications (
		  document_id uuid PRIMARY KEY REFERENCES survival_documents(id) ON DELETE CASCADE,
		  chunk_set_id uuid NOT NULL,
		  FOREIGN KEY(chunk_set_id,document_id) REFERENCES knowledge_chunk_sets(id,document_id) ON DELETE CASCADE
		 );
		 -- Consumer-specific receipts do not mark events consumed for CTMS-052 or other consumers.
		 CREATE TABLE knowledge_chunk_event_receipts (
		  event_id uuid PRIMARY KEY REFERENCES survival_document_outbox(id) ON DELETE CASCADE,
		  consumed_at timestamptz NOT NULL DEFAULT now()
		 );
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE knowledge_chunk_event_receipts;
		 DROP TABLE knowledge_chunk_publications; DROP TABLE knowledge_chunks; DROP TABLE knowledge_chunk_sets;`);
	}
}
