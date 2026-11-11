import type { MigrationInterface, QueryRunner } from "typeorm";
export class CreateDemandInsights1794100000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE demand_insight_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), month varchar(7) NOT NULL UNIQUE,
 window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 source_hash text NOT NULL, config_hash text NOT NULL, configuration jsonb NOT NULL,
 release jsonb NOT NULL, suggestions jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL CHECK(status IN ('pending','running','succeeded','failed','insufficient_data')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 error_code text, generated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(month,source_hash,config_hash)
 )`);
		await q.query(
			"CREATE TABLE demand_insight_control (id integer PRIMARY KEY CHECK(id=1), last_created_at timestamptz); INSERT INTO demand_insight_control(id) VALUES(1)"
		);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE demand_insight_reports; DROP TABLE demand_insight_control");
	}
}
