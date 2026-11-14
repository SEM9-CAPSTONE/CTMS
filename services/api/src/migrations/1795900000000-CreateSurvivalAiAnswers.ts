import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSurvivalAiAnswers1795900000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE ai_answers (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				request_id uuid NOT NULL,
				request_hash char(64) NOT NULL,
				locale varchar(16) NOT NULL,
				answer text NOT NULL,
				retrieved_evidence jsonb NOT NULL,
				cited_chunk_ids uuid[] NOT NULL,
				generation jsonb NOT NULL,
				retrieval_config_version varchar(100) NOT NULL,
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '30 days'),
				UNIQUE(user_id, request_id)
			);
			CREATE INDEX ai_answers_expiry_idx ON ai_answers(expires_at);
			CREATE TABLE ai_answer_request_limits (
				user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
				next_request_at timestamptz NOT NULL,
				lease_id uuid,
				lease_until timestamptz NOT NULL
			);
		`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE ai_answer_request_limits, ai_answers");
	}
}
