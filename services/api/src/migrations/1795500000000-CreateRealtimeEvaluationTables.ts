import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-100 (Subtask CTMS-403). Real-time performance evaluation reports (gates, metrics, scenario
 * results, versions, conclusion — BR-281, BR-282) and their per-event timing samples: sent,
 * received and acknowledged times, latency and event type, without any payload (BR-265).
 */
export class CreateRealtimeEvaluationTables1795500000000 implements MigrationInterface {
	name = "CreateRealtimeEvaluationTables1795500000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "realtime_evaluation_reports" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"scenario_version" varchar(64) NOT NULL,
				"config_version" varchar(64) NOT NULL,
				"rule_version" varchar(64) NOT NULL,
				"test_config" jsonb NOT NULL,
				"overall_result" varchar(16) NOT NULL,
				"started_at" timestamptz NOT NULL,
				"evaluated_at" timestamptz NOT NULL,
				"gates" jsonb NOT NULL,
				"metrics" jsonb NOT NULL,
				"scenario_results" jsonb NOT NULL,
				"failure_reasons" jsonb NOT NULL DEFAULT '[]',
				"evaluator_id" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_realtime_evaluation_reports_id" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_realtime_evaluation_reports_overall_result"
					CHECK ("overall_result" IN ('PASSED', 'FAILED')),
				CONSTRAINT "FK_realtime_evaluation_reports_evaluator_id" FOREIGN KEY ("evaluator_id")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_realtime_evaluation_reports_overall_result" ON "realtime_evaluation_reports" ("overall_result")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_realtime_evaluation_reports_evaluated_at" ON "realtime_evaluation_reports" ("evaluated_at" DESC)`
		);
		await queryRunner.query(`
			CREATE TABLE "realtime_latency_samples" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"report_id" uuid NOT NULL,
				"scenario" varchar(32) NOT NULL,
				"event_type" varchar(64) NOT NULL,
				"event_id" uuid,
				"sequence" bigint,
				"client_index" integer NOT NULL,
				"warmup" boolean NOT NULL DEFAULT false,
				"sent_at" timestamptz,
				"received_at" timestamptz,
				"acknowledged_at" timestamptz,
				"latency_ms" double precision,
				CONSTRAINT "PK_realtime_latency_samples_id" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_realtime_latency_samples_latency" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0),
				CONSTRAINT "FK_realtime_latency_samples_report_id" FOREIGN KEY ("report_id")
					REFERENCES "realtime_evaluation_reports" ("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_realtime_latency_samples_report" ON "realtime_latency_samples" ("report_id", "event_type")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_realtime_latency_samples_report"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "realtime_latency_samples"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_realtime_evaluation_reports_evaluated_at"`);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_realtime_evaluation_reports_overall_result"`
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "realtime_evaluation_reports"`);
	}
}
