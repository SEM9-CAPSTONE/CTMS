import type { MigrationInterface, QueryRunner } from "typeorm";

const EXISTING_EVENTS = `
	'trip.review.requested',
	'trip.review.reminder',
	'trip.review.auto_rejected',
	'trip.review.moderation_flagged',
	'trip.review.auto_hidden',
	'trip.review.moderation_unverified',
	'trip.review.moderation_reminder',
	'trip.review.moderation_escalated'
`;
const APPROVAL_EVENT = "'trekking_route.approved'";

export class AddTrekkingRouteApprovalNotification1798700000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			ALTER TABLE in_app_notifications
				ADD COLUMN trekking_route_id uuid REFERENCES trekking_routes(id) ON DELETE SET NULL,
				DROP CONSTRAINT CHK_in_app_notifications_event_type,
				ADD CONSTRAINT CHK_in_app_notifications_event_type
					CHECK (event_type IN (${EXISTING_EVENTS}, ${APPROVAL_EVENT}))
		`);
		await runner.query(`
			CREATE INDEX idx_in_app_notification_trekking_route
			ON in_app_notifications(trekking_route_id) WHERE trekking_route_id IS NOT NULL
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DELETE FROM in_app_notifications WHERE event_type = ${APPROVAL_EVENT}`);
		await runner.query(`
			ALTER TABLE in_app_notifications
				DROP COLUMN trekking_route_id,
				DROP CONSTRAINT CHK_in_app_notifications_event_type,
				ADD CONSTRAINT CHK_in_app_notifications_event_type
					CHECK (event_type IN (${EXISTING_EVENTS}))
		`);
	}
}
