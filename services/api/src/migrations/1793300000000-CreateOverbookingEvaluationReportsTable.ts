import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-095 (CTMS-286, Subtask CTMS-393).
 * Stores reproducible Trip overbooking prevention evaluation evidence,
 * release gates, operational contention metrics, and pass/fail conclusions (BR-276, BR-282).
 */
export class CreateOverbookingEvaluationReportsTable1793300000000 implements MigrationInterface {
	name = "CreateOverbookingEvaluationReportsTable1793300000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "overbooking_evaluation_reports" (
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
				CONSTRAINT "PK_overbooking_evaluation_reports_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_overbooking_evaluation_reports_evaluator_id" FOREIGN KEY ("evaluator_id")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_overbooking_evaluation_reports_overall_result" ON "overbooking_evaluation_reports" ("overall_result")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_overbooking_evaluation_reports_evaluated_at" ON "overbooking_evaluation_reports" ("evaluated_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_overbooking_evaluation_reports_evaluated_at"`
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_overbooking_evaluation_reports_overall_result"`
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "overbooking_evaluation_reports"`);
	}
}
