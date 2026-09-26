import type { MigrationInterface, QueryRunner } from "typeorm";

export class PrepareBookingsForCreation1787100000000 implements MigrationInterface {
	name = "PrepareBookingsForCreation1787100000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TYPE "booking_status" AS ENUM (
				'pending_payment', 'confirmed', 'cancelled', 'expired', 'completed'
			)
		`);
		await queryRunner.query(`
			CREATE TYPE "booking_payment_status" AS ENUM ('not_required', 'unpaid', 'paid')
		`);

		await queryRunner.query(`
			ALTER TABLE "bookings"
				ADD COLUMN "num_people" integer,
				ADD COLUMN "status" "booking_status",
				ADD COLUMN "payment_status" "booking_payment_status",
				ADD COLUMN "hold_expires_at" timestamptz,
				ADD COLUMN "trip_starts_at_snapshot" timestamptz,
				ADD COLUMN "trip_ends_at_snapshot" timestamptz,
				ADD COLUMN "base_price" numeric(12,2),
				ADD COLUMN "cancellation_policy_snapshot" jsonb,
				ADD COLUMN "idempotency_key" varchar(128),
				ADD COLUMN "request_fingerprint" varchar(64)
		`);

		await queryRunner.query(`
			ALTER TABLE "bookings"
				ADD CONSTRAINT "CHK_bookings_num_people"
					CHECK ("num_people" IS NULL OR "num_people" > 0),
				ADD CONSTRAINT "CHK_bookings_base_price"
					CHECK ("base_price" IS NULL OR "base_price" >= 0),
				ADD CONSTRAINT "CHK_bookings_snapshot_schedule"
					CHECK (
						"trip_starts_at_snapshot" IS NULL
						OR "trip_ends_at_snapshot" IS NULL
						OR "trip_starts_at_snapshot" < "trip_ends_at_snapshot"
					),
				ADD CONSTRAINT "CHK_bookings_pending_payment"
					CHECK (
						"status" IS NULL
						OR "status" <> 'pending_payment'
						OR ("payment_status" = 'unpaid' AND "hold_expires_at" IS NOT NULL)
					),
				ADD CONSTRAINT "CHK_bookings_idempotency_fingerprint"
					CHECK (
						("idempotency_key" IS NULL AND "request_fingerprint" IS NULL)
						OR ("idempotency_key" IS NOT NULL AND "request_fingerprint" IS NOT NULL)
					)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_bookings_trip_id_status_num_people"
			ON "bookings" ("trip_id", "status") INCLUDE ("num_people")
		`);
		await queryRunner.query(`CREATE INDEX "IDX_bookings_user_id" ON "bookings" ("user_id")`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_bookings_user_id_idempotency_key"
			ON "bookings" ("user_id", "idempotency_key")
			WHERE "idempotency_key" IS NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_bookings_user_id_idempotency_key"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_user_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_trip_id_status_num_people"`);
		await queryRunner.query(`
			ALTER TABLE "bookings"
				DROP CONSTRAINT IF EXISTS "CHK_bookings_idempotency_fingerprint",
				DROP CONSTRAINT IF EXISTS "CHK_bookings_pending_payment",
				DROP CONSTRAINT IF EXISTS "CHK_bookings_snapshot_schedule",
				DROP CONSTRAINT IF EXISTS "CHK_bookings_base_price",
				DROP CONSTRAINT IF EXISTS "CHK_bookings_num_people",
				DROP COLUMN IF EXISTS "request_fingerprint",
				DROP COLUMN IF EXISTS "idempotency_key",
				DROP COLUMN IF EXISTS "cancellation_policy_snapshot",
				DROP COLUMN IF EXISTS "base_price",
				DROP COLUMN IF EXISTS "trip_ends_at_snapshot",
				DROP COLUMN IF EXISTS "trip_starts_at_snapshot",
				DROP COLUMN IF EXISTS "hold_expires_at",
				DROP COLUMN IF EXISTS "payment_status",
				DROP COLUMN IF EXISTS "status",
				DROP COLUMN IF EXISTS "num_people"
		`);
		await queryRunner.query(`DROP TYPE IF EXISTS "booking_payment_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "booking_status"`);
	}
}
