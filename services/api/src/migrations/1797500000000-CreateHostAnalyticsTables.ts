import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHostAnalyticsTables1797500000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
			CREATE TABLE IF NOT EXISTS host_analytics_suggestion_jobs (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				host_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				period_from     TIMESTAMPTZ NOT NULL,
				period_to       TIMESTAMPTZ NOT NULL,
				area_code       VARCHAR(32) NULL REFERENCES geo_areas(code) ON DELETE RESTRICT,
				status          VARCHAR(16) NOT NULL
					CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
				source_hash     VARCHAR(64) NOT NULL,
				prompt_version  VARCHAR(32) NOT NULL DEFAULT 'host-planning-v1',
				attempts        INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
				error_code      VARCHAR(64) NULL,
				lease_token     UUID NULL,
				lease_until     TIMESTAMPTZ NULL,
				next_attempt_at TIMESTAMPTZ NULL,
				created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
				started_at      TIMESTAMPTZ NULL,
				finished_at     TIMESTAMPTZ NULL
			);

			CREATE UNIQUE INDEX IF NOT EXISTS uq_host_analytics_active_job_per_host
				ON host_analytics_suggestion_jobs (host_id)
				WHERE status IN ('queued', 'running');

			CREATE INDEX IF NOT EXISTS idx_host_analytics_jobs_host_created
				ON host_analytics_suggestion_jobs (host_id, created_at DESC);

			CREATE INDEX IF NOT EXISTS idx_host_analytics_jobs_poll
				ON host_analytics_suggestion_jobs (status, next_attempt_at, created_at);

			CREATE TABLE IF NOT EXISTS host_trip_suggestions (
				id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				job_id                     UUID NOT NULL REFERENCES host_analytics_suggestion_jobs(id) ON DELETE CASCADE,
				host_id                    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				route_id                   UUID NOT NULL REFERENCES trekking_routes(id) ON DELETE RESTRICT,
				area_code                  VARCHAR(32) NULL REFERENCES geo_areas(code) ON DELETE RESTRICT,
				trip_type                  VARCHAR(16) NOT NULL CHECK (trip_type IN ('day_trip', 'overnight')),
				month_hint                 VARCHAR(7) NOT NULL CHECK (month_hint ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
				price_band                 VARCHAR(32) NULL,
				capacity_band              VARCHAR(32) NULL,
				suggested_price_per_person BIGINT NULL
					CHECK (suggested_price_per_person IS NULL OR suggested_price_per_person >= 0),
				suggested_capacity_min     INT NULL
					CHECK (suggested_capacity_min IS NULL OR suggested_capacity_min >= 1),
				rationale_codes            JSONB NOT NULL DEFAULT '[]'::jsonb,
				missing_data               JSONB NOT NULL DEFAULT '[]'::jsonb,
				created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
			);

			CREATE INDEX IF NOT EXISTS idx_host_trip_suggestions_job
				ON host_trip_suggestions (job_id);

			CREATE INDEX IF NOT EXISTS idx_host_trip_suggestions_host
				ON host_trip_suggestions (host_id, created_at DESC);

			CREATE TABLE IF NOT EXISTS host_analytics_control (
				host_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
				last_created_at TIMESTAMPTZ NULL,
				daily_date_vn   DATE NOT NULL,
				daily_count     INT NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
				updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
			DROP TABLE IF EXISTS host_analytics_control;
			DROP TABLE IF EXISTS host_trip_suggestions;
			DROP TABLE IF EXISTS host_analytics_suggestion_jobs;
		`);
	}
}
