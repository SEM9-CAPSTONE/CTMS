import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiInvestigations1796500000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			CREATE TABLE ai_investigation_jobs (
				id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				feedback_id uuid NOT NULL, mutation_id uuid NOT NULL,
				rating varchar(12) CHECK (rating IN ('USEFUL', 'NOT_USEFUL')),
				priority smallint NOT NULL CHECK (priority IN (0, 1, 2)),
				status varchar(12) NOT NULL DEFAULT 'PENDING'
					CHECK (status IN ('PENDING','PROCESSING','COMPLETE','FAILED','SUPERSEDED')),
				attempts smallint NOT NULL DEFAULT 0,
				lease_token uuid, lease_until timestamptz,
				available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				UNIQUE (feedback_id, mutation_id)
			);
			CREATE INDEX ai_investigation_jobs_ready ON ai_investigation_jobs(priority, available_at, id)
				WHERE status IN ('PENDING','PROCESSING');
			CREATE INDEX ai_investigation_jobs_feedback ON ai_investigation_jobs(feedback_id, id);
			CREATE TABLE ai_investigation_cases (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(), feedback_id uuid NOT NULL UNIQUE,
				answer_id uuid NOT NULL, mode varchar(6) NOT NULL CHECK (mode IN ('ONLINE','LOCAL')),
				latest_job_id bigint NOT NULL REFERENCES ai_investigation_jobs(id),
				snapshot jsonb, report jsonb, report_reason varchar(1000), evidence_removed_at timestamptz, reported_at timestamptz,
				review_status varchar(12) CHECK (review_status IN ('pending','reviewing','actioned')),
				reviewer_id uuid, reviewed_at timestamptz, resolution_note varchar(2000),
				technical_status varchar(16) NOT NULL DEFAULT 'OPEN'
					CHECK (technical_status IN ('OPEN','HANDED_OFF','VERIFIED_FIX','JUSTIFIED_NO_FIX')),
				version integer NOT NULL DEFAULT 1, closed_at timestamptz, retention_hold boolean NOT NULL DEFAULT false,
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				CHECK ((review_status IS NULL) = (reported_at IS NULL)),
				CHECK ((snapshot IS NULL) = (evidence_removed_at IS NOT NULL)),
				CHECK ((closed_at IS NOT NULL) = (technical_status IN ('VERIFIED_FIX','JUSTIFIED_NO_FIX'))),
				CHECK (closed_at IS NULL OR review_status IS NULL OR review_status='actioned')
			);
			CREATE INDEX ai_investigation_cases_recent ON ai_investigation_cases(created_at DESC, id DESC);
			CREATE INDEX ai_investigation_cases_unsafe ON ai_investigation_cases(review_status, reported_at, id)
				WHERE review_status IS NOT NULL;
			CREATE INDEX ai_investigation_cases_cleanup ON ai_investigation_cases(closed_at)
				WHERE closed_at IS NOT NULL AND NOT retention_hold AND evidence_removed_at IS NULL;
			CREATE TABLE ai_investigation_groups (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mechanism_key text NOT NULL UNIQUE,
				classification varchar(24) NOT NULL
			);
			CREATE TABLE ai_investigation_members (
				case_id uuid NOT NULL REFERENCES ai_investigation_cases(id) ON DELETE CASCADE,
				group_id uuid NOT NULL REFERENCES ai_investigation_groups(id),
				issue_index integer NOT NULL CHECK (issue_index >= 0),
				PRIMARY KEY (case_id, issue_index)
			);
			CREATE INDEX ai_investigation_members_group ON ai_investigation_members(group_id,case_id);
			CREATE TABLE ai_investigation_history (
				audit_id uuid PRIMARY KEY REFERENCES audit_logs(id),
				case_id uuid NOT NULL REFERENCES ai_investigation_cases(id) ON DELETE CASCADE,
				version integer NOT NULL, reference varchar(300), verification varchar(2000),
				resolution_note varchar(2000), UNIQUE(case_id,version)
			);
			CREATE TABLE ai_feedback_quality_signals (
				day date PRIMARY KEY, useful_only_changes bigint NOT NULL CHECK (useful_only_changes > 0)
			);
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE ai_investigation_history, ai_investigation_members,
			ai_investigation_groups, ai_investigation_cases, ai_investigation_jobs, ai_feedback_quality_signals`);
	}
}
