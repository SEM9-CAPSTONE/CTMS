import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-036. Adds `trips.participation_evaluated_at` (marks a Trip the
 * auto-cancel worker already evaluated and found sufficiently funded, so it
 * is excluded from future candidate scans -- nothing else moves a Trip out
 * of `published` on its own) and a dedicated outbox table for post-commit
 * auto-cancellation notifications, mirroring `booking_expiry_outbox_events`
 * (AddBookingExpiryInfrastructure1787160000000) exactly.
 */
export class AddTripAutoCancelInfrastructure1787190000000 implements MigrationInterface {
	name = "AddTripAutoCancelInfrastructure1787190000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "trips"
			ADD COLUMN "participation_evaluated_at" timestamptz
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_trips_auto_cancel_candidates"
			ON "trips" ("booking_deadline", "id")
			WHERE "status" = 'published' AND "participation_evaluated_at" IS NULL
		`);
		await queryRunner.query(`
			CREATE TABLE "trip_auto_cancel_outbox_events" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"event_type" varchar(80) NOT NULL,
				"booking_id" uuid NOT NULL,
				"recipient_id" uuid NOT NULL,
				"trip_id" uuid NOT NULL,
				"payload" jsonb NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_auto_cancel_outbox_events_id" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_trip_auto_cancel_outbox_event_type_booking_id"
			ON "trip_auto_cancel_outbox_events" ("event_type", "booking_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "UQ_trip_auto_cancel_outbox_event_type_booking_id"`
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_auto_cancel_outbox_events"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_auto_cancel_candidates"`);
		await queryRunner.query(`
			ALTER TABLE "trips"
			DROP COLUMN "participation_evaluated_at"
		`);
	}
}
