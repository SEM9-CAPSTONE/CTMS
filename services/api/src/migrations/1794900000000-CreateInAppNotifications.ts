import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInAppNotifications1794900000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE in_app_notifications (
			id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
			recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
			event_type varchar(50) NOT NULL CHECK (event_type IN
				('trip.review.requested', 'trip.review.reminder', 'trip.review.auto_rejected')),
			source_key varchar(250) NOT NULL,
			occurred_at timestamptz NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			read_at timestamptz,
			delivered_at timestamptz,
			UNIQUE (source_key, recipient_id)
		)`);
		await runner.query(`CREATE INDEX idx_in_app_notification_inbox
			ON in_app_notifications(recipient_id, created_at DESC, id DESC)`);
		await runner.query(`CREATE INDEX idx_in_app_notification_outbox
			ON in_app_notifications(created_at) WHERE delivered_at IS NULL`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP TABLE in_app_notifications");
	}
}
