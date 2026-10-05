import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingExpiryInfrastructure1787160000000 implements MigrationInterface {
	name = "AddBookingExpiryInfrastructure1787160000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX "IDX_bookings_expiry_candidates"
			ON "bookings" ("hold_expires_at", "id")
			WHERE "status" = 'pending_payment' AND "payment_status" = 'unpaid'
		`);
		await queryRunner.query(`
			CREATE TABLE "booking_expiry_outbox_events" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"event_type" varchar(80) NOT NULL,
				"booking_id" uuid NOT NULL,
				"recipient_id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"payload" jsonb NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_booking_expiry_outbox_events_id" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_booking_expiry_outbox_event_type_booking_id"
			ON "booking_expiry_outbox_events" ("event_type", "booking_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "UQ_booking_expiry_outbox_event_type_booking_id"`
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "booking_expiry_outbox_events"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_expiry_candidates"`);
	}
}
