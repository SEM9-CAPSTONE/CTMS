import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-097 (CTMS-288, Subtask CTMS-397).
 * Stores reproducible offline-buffer and synchronization evaluation evidence,
 * release gates, observational metrics, and pass/fail conclusions (BR-278, BR-282, BR-436).
 */
export class CreateSyncEvaluationReportsTable1793100000000 implements MigrationInterface {
	name = "CreateSyncEvaluationReportsTable1793100000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "sync_evaluation_reports" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"dataset_version" varchar(64) NOT NULL,
				"config_version" varchar(32) NOT NULL,
				"rule_version" varchar(64) NOT NULL,
				"overall_result" varchar(16) NOT NULL,
				"evaluated_at" timestamptz NOT NULL,
				"gates" jsonb NOT NULL,
				"metrics" jsonb NOT NULL,
				"scenario_results" jsonb NOT NULL,
				"failure_reasons" jsonb NOT NULL DEFAULT '[]',
				"evaluator_id" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_sync_evaluation_reports_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_sync_evaluation_reports_evaluator_id" FOREIGN KEY ("evaluator_id")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_sync_evaluation_reports_overall_result" ON "sync_evaluation_reports" ("overall_result")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_sync_evaluation_reports_evaluated_at" ON "sync_evaluation_reports" ("evaluated_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sync_evaluation_reports_evaluated_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sync_evaluation_reports_overall_result"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "sync_evaluation_reports"`);
	}
}
