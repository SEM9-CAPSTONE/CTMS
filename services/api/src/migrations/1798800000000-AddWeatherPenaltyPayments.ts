import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * PayOS payment links a Host opens to pay the weather penalty the settlements did not cover.
 * `order_code` is the PayOS order code the webhook and the status check refer to; a penalty has at
 * most one link waiting, so a Host clicking "Nộp phạt" twice reuses it.
 */
export class AddWeatherPenaltyPayments1798800000000 implements MigrationInterface {
	name = "AddWeatherPenaltyPayments1798800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "weather_penalty_payments" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"penalty_id" uuid NOT NULL,
				"host_id" uuid NOT NULL,
				"order_code" bigint NOT NULL,
				"amount" numeric(12,2) NOT NULL,
				"status" varchar(20) NOT NULL DEFAULT 'pending',
				"checkout_url" text NOT NULL,
				"paid_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_weather_penalty_payments_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_weather_penalty_payments_order_code" UNIQUE ("order_code"),
				CONSTRAINT "FK_weather_penalty_payments_penalty" FOREIGN KEY ("penalty_id")
					REFERENCES "host_weather_penalties"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_weather_penalty_payments_host" FOREIGN KEY ("host_id")
					REFERENCES "users"("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_weather_penalty_payments_amount" CHECK ("amount" > 0),
				CONSTRAINT "CHK_weather_penalty_payments_status"
					CHECK ("status" IN ('pending', 'succeeded', 'cancelled')),
				CONSTRAINT "CHK_weather_penalty_payments_paid_at"
					CHECK (("status" = 'succeeded') = ("paid_at" IS NOT NULL))
			)
		`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_weather_penalty_payments_pending" ON "weather_penalty_payments" ("penalty_id") WHERE "status" = 'pending'`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_weather_penalty_payments_host_status" ON "weather_penalty_payments" ("host_id", "status")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "weather_penalty_payments"`);
	}
}
