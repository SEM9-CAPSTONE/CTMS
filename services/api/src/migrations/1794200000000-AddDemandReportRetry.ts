import type { MigrationInterface, QueryRunner } from "typeorm";
export class AddDemandReportRetry1794200000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(
			"ALTER TABLE demand_insight_reports ADD COLUMN manual_retries integer NOT NULL DEFAULT 0 CHECK (manual_retries BETWEEN 0 AND 1)"
		);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("ALTER TABLE demand_insight_reports DROP COLUMN manual_retries");
	}
}
