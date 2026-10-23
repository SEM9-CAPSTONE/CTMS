import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingCancellationNotices1792627200000 implements MigrationInterface {
	name = "AddBookingCancellationNotices1792627200000";
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE booking_cancellation_notices (
			id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
			recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
			trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
			trip_title varchar(150) NOT NULL,
			camper_name varchar(50),
			reason varchar(255) NOT NULL,
			read_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT "UQ_booking_cancellation_notice_recipient" UNIQUE (booking_id, recipient_id)
		)`);
		await queryRunner.query(
			"CREATE INDEX IDX_booking_cancellation_notice_inbox ON booking_cancellation_notices(recipient_id, created_at DESC)"
		);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE booking_cancellation_notices");
	}
}
