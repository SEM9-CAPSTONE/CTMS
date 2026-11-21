import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-099 (Subtask CTMS-401). Stores each comparison of the Weather Risk scorer with a versioned
 * manual-assessment set: dataset version and hash, the exact rule version and its thresholds,
 * metrics, release gates and the PASSED / FAILED / INVALID conclusion (BR-280, BR-282).
 */
export class CreateWeatherRiskEvaluationReportsTable1795400000000 implements MigrationInterface {
	name = "CreateWeatherRiskEvaluationReportsTable1795400000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "weather_risk_evaluation_reports" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"dataset_version" varchar(64) NOT NULL,
				"dataset_hash" char(64) NOT NULL,
				"dataset_status" varchar(16) NOT NULL,
				"config_version" varchar(64) NOT NULL,
				"rule_id" uuid,
				"rule_version" integer NOT NULL,
				"rule_snapshot" jsonb NOT NULL,
				"overall_result" varchar(16) NOT NULL,
				"evaluated_at" timestamptz NOT NULL,
				"gates" jsonb NOT NULL,
				"metrics" jsonb NOT NULL,
				"case_results" jsonb NOT NULL,
				"failure_reasons" jsonb NOT NULL DEFAULT '[]',
				"evaluator_id" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_risk_evaluation_reports_id" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_weather_risk_evaluation_reports_overall_result"
					CHECK ("overall_result" IN ('PASSED', 'FAILED', 'INVALID')),
				CONSTRAINT "CHK_weather_risk_evaluation_reports_dataset_status"
					CHECK ("dataset_status" IN ('draft', 'approved')),
				CONSTRAINT "FK_weather_risk_evaluation_reports_rule_id" FOREIGN KEY ("rule_id")
					REFERENCES "weather_risk_rules" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_weather_risk_evaluation_reports_evaluator_id" FOREIGN KEY ("evaluator_id")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_risk_evaluation_reports_overall_result" ON "weather_risk_evaluation_reports" ("overall_result")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_risk_evaluation_reports_evaluated_at" ON "weather_risk_evaluation_reports" ("evaluated_at" DESC)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_risk_evaluation_reports_context" ON "weather_risk_evaluation_reports" ("dataset_version", "rule_version")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weather_risk_evaluation_reports_context"`);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_weather_risk_evaluation_reports_evaluated_at"`
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_weather_risk_evaluation_reports_overall_result"`
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "weather_risk_evaluation_reports"`);
	}
}
