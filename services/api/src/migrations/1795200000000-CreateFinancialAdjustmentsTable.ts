import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-114 (CTMS-302 / BR-345).
 * Reconcile financial exceptions after settlement or payout without modifying historical records.
 */
export class CreateFinancialAdjustmentsTable1795200000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "financial_adjustments" (
				"id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
				"settlement_id"    uuid,
				"payout_id"        uuid,
				"booking_id"       uuid          NOT NULL,
				"trip_id"          uuid          NOT NULL,
				"host_id"          uuid          NOT NULL,
				"type"             varchar(50)   NOT NULL,
				"amount"           numeric(12,2) NOT NULL,
				"reason"           text          NOT NULL,
				"status"           varchar(32)   NOT NULL DEFAULT 'pending',
				"idempotency_key"  varchar(255)  NOT NULL,
				"actor_id"         uuid,
				"notes"            text,
				"created_at"       timestamptz   NOT NULL DEFAULT now(),
				"updated_at"       timestamptz   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_financial_adjustments_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "UQ_financial_adjustments_idem_key"
					UNIQUE ("idempotency_key"),
				CONSTRAINT "FK_financial_adjustments_booking"
					FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_financial_adjustments_trip"
					FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_financial_adjustments_host"
					FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_financial_adjustments_settle"
					FOREIGN KEY ("settlement_id")
					REFERENCES "settlements" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_financial_adjustments_payout"
					FOREIGN KEY ("payout_id")
					REFERENCES "payouts" ("id") ON DELETE SET NULL,
				CHECK ("amount" > 0)
			);

			CREATE INDEX "IDX_financial_adjustments_trip_id"
				ON "financial_adjustments" ("trip_id");
			CREATE INDEX "IDX_financial_adjustments_host_id"
				ON "financial_adjustments" ("host_id");
			CREATE INDEX "IDX_financial_adjustments_status"
				ON "financial_adjustments" ("status");
		`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "financial_adjustments"`);
	}
}
