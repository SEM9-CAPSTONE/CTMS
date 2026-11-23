import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Weather penalty the settlements could not cover (policy §6): the Host pays it within 7 days and
 * an Admin confirms the bank transfer. `payment_due_at` is the deadline (existing rows: 7 days after
 * they were created), `collected_*` records the confirmed payment. Deducted plus collected never
 * exceeds the penalty amount.
 */
export class AddWeatherPenaltyPayment1798400000000 implements MigrationInterface {
	name = "AddWeatherPenaltyPayment1798400000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "host_weather_penalties"
				ADD COLUMN "payment_due_at" timestamptz,
				ADD COLUMN "collected_amount" numeric(12,2) NOT NULL DEFAULT 0,
				ADD COLUMN "collected_at" timestamptz,
				ADD COLUMN "collected_by" uuid,
				ADD COLUMN "collection_reference" varchar(100),
				ADD COLUMN "collection_note" varchar(500)
		`);
		await queryRunner.query(
			`UPDATE "host_weather_penalties" SET "payment_due_at" = "created_at" + interval '7 days'`
		);
		await queryRunner.query(
			`ALTER TABLE "host_weather_penalties" ALTER COLUMN "payment_due_at" SET NOT NULL`
		);
		await queryRunner.query(`
			ALTER TABLE "host_weather_penalties"
				DROP CONSTRAINT "CHK_host_weather_penalties_amounts",
				ADD CONSTRAINT "CHK_host_weather_penalties_amounts" CHECK (
					"amount" >= 0 AND "deducted_amount" >= 0 AND "collected_amount" >= 0
					AND "deducted_amount" + "collected_amount" <= "amount"
				),
				ADD CONSTRAINT "FK_host_weather_penalties_collector" FOREIGN KEY ("collected_by")
					REFERENCES "users"("id") ON DELETE SET NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "host_weather_penalties"
				DROP CONSTRAINT IF EXISTS "FK_host_weather_penalties_collector",
				DROP CONSTRAINT "CHK_host_weather_penalties_amounts",
				ADD CONSTRAINT "CHK_host_weather_penalties_amounts"
					CHECK ("amount" >= 0 AND "deducted_amount" >= 0 AND "deducted_amount" <= "amount")
		`);
		await queryRunner.query(`
			ALTER TABLE "host_weather_penalties"
				DROP COLUMN "collection_note",
				DROP COLUMN "collection_reference",
				DROP COLUMN "collected_by",
				DROP COLUMN "collected_at",
				DROP COLUMN "collected_amount",
				DROP COLUMN "payment_due_at"
		`);
	}
}
