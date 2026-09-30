import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripRescheduleState1787140000000 implements MigrationInterface {
	name = "AddTripRescheduleState1787140000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'pending_reconfirmation'`
		);

		await queryRunner.query(`
			ALTER TABLE "bookings"
				ADD COLUMN IF NOT EXISTS "reconfirmation_deadline" timestamptz,
				ADD COLUMN IF NOT EXISTS "reconfirmed_at" timestamptz,
				ADD COLUMN IF NOT EXISTS "declined_at" timestamptz
		`);

		await queryRunner.query(`
			ALTER TABLE "trips"
				ADD COLUMN IF NOT EXISTS "rescheduled_at" timestamptz,
				ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
				ADD COLUMN IF NOT EXISTS "cancellation_reason" varchar(500)
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_porter_status') THEN
					CREATE TYPE "trip_porter_status" AS ENUM (
						'assigned',
						'pending_reconfirmation',
						'unassigned'
					);
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			ALTER TABLE "trip_porters"
				ADD COLUMN IF NOT EXISTS "status" "trip_porter_status" NOT NULL DEFAULT 'assigned',
				ADD COLUMN IF NOT EXISTS "reconfirmation_deadline" timestamptz,
				ADD COLUMN IF NOT EXISTS "reconfirmed_at" timestamptz,
				ADD COLUMN IF NOT EXISTS "declined_at" timestamptz
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_reservation_status') THEN
					CREATE TYPE "equipment_reservation_status" AS ENUM ('active', 'cancelled');
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			ALTER TABLE "equipment_reservations"
				ADD COLUMN IF NOT EXISTS "status" "equipment_reservation_status" NOT NULL DEFAULT 'active',
				ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
				ADD COLUMN IF NOT EXISTS "cancellation_reason" varchar(500)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payments_booking_refund_idempotency"
			ON "payments" ("booking_id", "idempotency_key")
			WHERE "type" = 'refund' AND "idempotency_key" IS NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_booking_refund_idempotency"`);
		await queryRunner.query(`
			ALTER TABLE "equipment_reservations"
				DROP COLUMN IF EXISTS "cancellation_reason",
				DROP COLUMN IF EXISTS "cancelled_at",
				DROP COLUMN IF EXISTS "status"
		`);
		await queryRunner.query(`DROP TYPE IF EXISTS "equipment_reservation_status"`);
		await queryRunner.query(`
			ALTER TABLE "trip_porters"
				DROP COLUMN IF EXISTS "declined_at",
				DROP COLUMN IF EXISTS "reconfirmed_at",
				DROP COLUMN IF EXISTS "reconfirmation_deadline",
				DROP COLUMN IF EXISTS "status"
		`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trip_porter_status"`);
		await queryRunner.query(`
			ALTER TABLE "trips"
				DROP COLUMN IF EXISTS "cancellation_reason",
				DROP COLUMN IF EXISTS "cancelled_at",
				DROP COLUMN IF EXISTS "rescheduled_at"
		`);
		await queryRunner.query(`
			ALTER TABLE "bookings"
				DROP COLUMN IF EXISTS "declined_at",
				DROP COLUMN IF EXISTS "reconfirmed_at",
				DROP COLUMN IF EXISTS "reconfirmation_deadline"
		`);
	}
}
