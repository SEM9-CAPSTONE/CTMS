import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAiAutoModerationAndNotificationSupport1797400000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
			ALTER TABLE trip_reviews
				ALTER COLUMN hidden_by DROP NOT NULL,
				ADD COLUMN IF NOT EXISTS first_hidden_at timestamptz,
				ADD COLUMN IF NOT EXISTS hidden_source varchar(16)
					CHECK (hidden_source IS NULL OR hidden_source IN ('ai', 'host', 'admin')),
				ADD COLUMN IF NOT EXISTS moderation_verification_status varchar(24) NOT NULL DEFAULT 'verified'
					CHECK (moderation_verification_status IN ('pending', 'verified', 'unverified'));

			UPDATE trip_reviews
			SET first_hidden_at = COALESCE(first_hidden_at, hidden_at, updated_at),
				hidden_source = COALESCE(
					hidden_source,
					CASE WHEN hidden_by IS NOT NULL THEN 'host' ELSE 'ai' END
				)
			WHERE moderation_status = 'hidden'
				AND (first_hidden_at IS NULL OR hidden_source IS NULL);

			CREATE INDEX IF NOT EXISTS IDX_trip_reviews_moderation_verification
				ON trip_reviews (moderation_verification_status)
				WHERE moderation_verification_status <> 'verified';

			ALTER TABLE in_app_notifications
				ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES trip_reviews(id) ON DELETE SET NULL;

			DO $$
			DECLARE
				constraint_name text;
			BEGIN
				FOR constraint_name IN
					SELECT conname
					FROM pg_constraint
					WHERE conrelid = 'in_app_notifications'::regclass
						AND contype = 'c'
						AND pg_get_constraintdef(oid) LIKE '%event_type%'
				LOOP
					EXECUTE format('ALTER TABLE in_app_notifications DROP CONSTRAINT %I', constraint_name);
				END LOOP;
			END $$;

			ALTER TABLE in_app_notifications
				ADD CONSTRAINT CHK_in_app_notifications_event_type
				CHECK (event_type IN (
					'trip.review.requested',
					'trip.review.reminder',
					'trip.review.auto_rejected',
					'trip.review.moderation_flagged',
					'trip.review.auto_hidden',
					'trip.review.moderation_unverified',
					'trip.review.moderation_reminder',
					'trip.review.moderation_escalated'
				));

			CREATE INDEX IF NOT EXISTS idx_in_app_notification_review
				ON in_app_notifications(review_id)
				WHERE review_id IS NOT NULL;

			INSERT INTO in_app_notifications (
				recipient_id,
				trip_id,
				review_id,
				event_type,
				source_key,
				occurred_at
			)
			SELECT
				r.host_id,
				r.trip_id,
				r.id,
				'trip.review.moderation_flagged',
				'review-moderation:flagged:' || r.id::text || ':rev:' || r.revision::text,
				MAX(f.created_at)
			FROM trip_reviews r
			INNER JOIN trip_review_moderation_flags f
				ON f.review_id = r.id
				AND f.source_revision = r.revision
				AND f.lifecycle_status = 'active'
			WHERE r.moderation_status = 'visible'
				AND NOT EXISTS (
					SELECT 1
					FROM trip_review_moderation_decisions d
					WHERE d.review_id = r.id AND d.revision = r.revision
				)
			GROUP BY r.id, r.host_id, r.trip_id, r.revision
			ON CONFLICT (source_key, recipient_id) DO NOTHING;
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
			DELETE FROM in_app_notifications
			WHERE event_type IN (
				'trip.review.moderation_flagged',
				'trip.review.auto_hidden',
				'trip.review.moderation_unverified',
				'trip.review.moderation_reminder',
				'trip.review.moderation_escalated'
			);

			DROP INDEX IF EXISTS idx_in_app_notification_review;

			ALTER TABLE in_app_notifications
				DROP CONSTRAINT IF EXISTS CHK_in_app_notifications_event_type;

			ALTER TABLE in_app_notifications
				ADD CONSTRAINT in_app_notifications_event_type_check
				CHECK (event_type IN (
					'trip.review.requested',
					'trip.review.reminder',
					'trip.review.auto_rejected'
				));

			ALTER TABLE in_app_notifications
				DROP COLUMN IF EXISTS review_id;

			DROP INDEX IF EXISTS IDX_trip_reviews_moderation_verification;

			ALTER TABLE trip_reviews
				DROP COLUMN IF EXISTS moderation_verification_status,
				DROP COLUMN IF EXISTS hidden_source,
				DROP COLUMN IF EXISTS first_hidden_at;
		`);
	}
}
