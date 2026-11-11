import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWeatherAdviceTable1786940000000 implements MigrationInterface {
	name = "CreateWeatherAdviceTable1786940000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "weather_advice" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"assessment_id" uuid NOT NULL,
				"advice_text" text NOT NULL,
				"actions" jsonb NOT NULL,
				"created_by" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_advice_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_weather_advice_assessment_id" FOREIGN KEY ("assessment_id")
					REFERENCES "weather_risk_assessments" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_weather_advice_created_by" FOREIGN KEY ("created_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "UQ_weather_advice_assessment_id" UNIQUE ("assessment_id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_weather_advice_assessment_id" ON "weather_advice" ("assessment_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weather_advice_assessment_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "weather_advice"`);
	}
}
