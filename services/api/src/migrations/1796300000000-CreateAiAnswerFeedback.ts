import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiAnswerFeedback1796300000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE ai_answers ADD COLUMN question varchar(2000);
			CREATE TABLE ai_answer_feedback (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				answer_id uuid REFERENCES ai_answers(id) ON DELETE CASCADE,
				installation_id uuid,
				local_answer_id uuid,
				local_evidence jsonb,
				rating varchar(12) CHECK (rating IN ('USEFUL', 'NOT_USEFUL')),
				reported_unsafe boolean NOT NULL,
				reason varchar(1000),
				reported_at timestamptz,
				review_status varchar(12) CHECK (review_status IN ('pending', 'reviewing', 'actioned')),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				expires_at timestamptz NOT NULL,
				CHECK (rating IS NOT NULL OR reported_unsafe),
				CHECK (reported_unsafe = (reported_at IS NOT NULL) AND reported_unsafe = (review_status IS NOT NULL)),
				CHECK (
					(answer_id IS NOT NULL AND installation_id IS NULL AND local_answer_id IS NULL AND local_evidence IS NULL)
					OR
					(answer_id IS NULL AND installation_id IS NOT NULL AND local_answer_id IS NOT NULL AND local_evidence IS NOT NULL)
				),
				UNIQUE (user_id, answer_id),
				UNIQUE (user_id, installation_id, local_answer_id),
				UNIQUE (user_id, id)
			);
			CREATE INDEX ai_answer_feedback_expiry ON ai_answer_feedback(expires_at);
			CREATE INDEX ai_answer_feedback_online ON ai_answer_feedback(answer_id);
			CREATE INDEX ai_answer_feedback_unsafe ON ai_answer_feedback(review_status, reported_at)
				WHERE reported_unsafe;
			CREATE TABLE ai_answer_feedback_mutations (
				user_id uuid NOT NULL,
				mutation_id uuid NOT NULL,
				feedback_id uuid NOT NULL,
				client_feedback_id uuid NOT NULL,
				revision integer NOT NULL CHECK (revision > 0),
				request_hash char(64) NOT NULL,
				client_created_at timestamptz NOT NULL,
				ack jsonb NOT NULL,
				PRIMARY KEY (user_id, mutation_id),
				UNIQUE (user_id, client_feedback_id, revision),
				FOREIGN KEY (user_id, feedback_id) REFERENCES ai_answer_feedback(user_id, id)
					ON DELETE CASCADE
			);
			CREATE INDEX ai_answer_feedback_mutations_target ON ai_answer_feedback_mutations(user_id, feedback_id);
		`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP TABLE ai_answer_feedback_mutations, ai_answer_feedback;
			ALTER TABLE ai_answers DROP COLUMN question;
		`);
	}
}
