import type { MigrationInterface, QueryRunner } from "typeorm";

export class ShareKnowledgeEmbeddings1797200000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			CREATE TABLE knowledge_embeddings (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				document_id uuid NOT NULL REFERENCES survival_documents(id) ON DELETE CASCADE,
				config_hash varchar(64) NOT NULL,
				input_hash varchar(64) NOT NULL,
				embedding_text text NOT NULL,
				embedding double precision[] NOT NULL CHECK(cardinality(embedding)>0),
				UNIQUE(document_id,config_hash,input_hash)
			);
			ALTER TABLE knowledge_chunks
				ALTER COLUMN embedding DROP NOT NULL,
				ADD COLUMN embedding_id uuid REFERENCES knowledge_embeddings(id) DEFERRABLE INITIALLY DEFERRED,
				ADD CONSTRAINT knowledge_chunk_has_one_embedding CHECK ((embedding_id IS NULL) <> (embedding IS NULL));
			CREATE INDEX knowledge_chunk_embedding_ref ON knowledge_chunks(embedding_id) WHERE embedding_id IS NOT NULL;
			CREATE INDEX knowledge_chunk_ready_document_config ON knowledge_chunk_sets(document_id,config_hash) WHERE status='READY';
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE knowledge_chunks DROP CONSTRAINT knowledge_chunk_has_one_embedding;
			UPDATE knowledge_chunks c SET embedding=e.embedding FROM knowledge_embeddings e WHERE c.embedding_id=e.id;
			ALTER TABLE knowledge_chunks ALTER COLUMN embedding SET NOT NULL, DROP COLUMN embedding_id;
			DROP INDEX knowledge_chunk_ready_document_config;
			DROP TABLE knowledge_embeddings;
		`);
	}
}
