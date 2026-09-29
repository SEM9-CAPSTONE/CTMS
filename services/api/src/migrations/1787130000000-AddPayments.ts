import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-032-T01. Creates `payments` and `payment_transactions` tables.
 *
 * Key constraints:
 *  - `CHK_payments_amount_positive`      — amount > 0 (no zero-value charges).
 *  - `CHK_payments_refund_has_parent`    — refunds must reference a parent charge.
 *  - `UQ_payments_booking_id_idempotency_key` — one Payment per (booking, key) scope (BR-178).
 */
export class AddPayments1787130000000 implements MigrationInterface {
	name = "AddPayments1787130000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// -----------------------------------------------------------------------
		// Enum types
		// -----------------------------------------------------------------------
		await queryRunner.query(`CREATE TYPE "payment_type" AS ENUM ('charge', 'refund')`);
		await queryRunner.query(
			`CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed')`
		);
		await queryRunner.query(
			`CREATE TYPE "payment_transaction_status" AS ENUM ('pending', 'succeeded', 'failed')`
		);

		// -----------------------------------------------------------------------
		// payments
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "payments" (
				"id"                   uuid        NOT NULL DEFAULT gen_random_uuid(),
				"booking_id"           uuid        NOT NULL,
				"amount"               numeric(12,2) NOT NULL,
				"type"                 "payment_type" NOT NULL,
				"status"               "payment_status" NOT NULL DEFAULT 'pending',
				"idempotency_key"      varchar(128),
				"request_fingerprint"  varchar(64),
				"provider_reference"   varchar(255),
				"parent_payment_id"    uuid,
				"created_at"           timestamptz NOT NULL DEFAULT now(),
				"updated_at"           timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_payments_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "FK_payments_booking_id"
					FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_payments_parent_payment_id"
					FOREIGN KEY ("parent_payment_id")
					REFERENCES "payments" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_payments_amount_positive"
					CHECK ("amount" > 0),
				CONSTRAINT "CHK_payments_refund_has_parent"
					CHECK ("type" <> 'refund' OR "parent_payment_id" IS NOT NULL),
				CONSTRAINT "CHK_payments_idempotency_fingerprint"
					CHECK (
						("idempotency_key" IS NULL AND "request_fingerprint" IS NULL)
						OR ("idempotency_key" IS NOT NULL AND "request_fingerprint" IS NOT NULL)
					)
			)
		`);

		// Idempotency uniqueness — one authoritative Payment per (booking, key) (BR-178).
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_payments_booking_id_idempotency_key"
			ON "payments" ("booking_id", "idempotency_key")
			WHERE "idempotency_key" IS NOT NULL
		`);

		// Fast lookup of all Payments for a Booking.
		await queryRunner.query(`
			CREATE INDEX "IDX_payments_booking_id_type_status"
			ON "payments" ("booking_id", "type", "status")
		`);

		// -----------------------------------------------------------------------
		// payment_transactions
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "payment_transactions" (
				"id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
				"payment_id"      uuid        NOT NULL,
				"transaction_ref" varchar(255),
				"status"          "payment_transaction_status" NOT NULL DEFAULT 'pending',
				"raw_payload"     jsonb,
				"created_at"      timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_payment_transactions_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "FK_payment_transactions_payment_id"
					FOREIGN KEY ("payment_id")
					REFERENCES "payments" ("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_payment_transactions_payment_id"
			ON "payment_transactions" ("payment_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_transactions_payment_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_transactions"`);

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_booking_id_type_status"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_booking_id_idempotency_key"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);

		await queryRunner.query(`DROP TYPE IF EXISTS "payment_transaction_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "payment_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "payment_type"`);
	}
}
