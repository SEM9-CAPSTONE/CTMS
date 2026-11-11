import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTripReviewModerationDecisionsAndStatus1794500000001
	implements MigrationInterface
{
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
			ALTER TABLE trip_reviews 
				ADD COLUMN moderation_status varchar(16) NOT NULL DEFAULT 'visible' 
					CHECK (moderation_status IN ('visible', 'hidden')),
				ADD COLUMN hidden_at timestamptz,
				ADD COLUMN hidden_reason varchar(50) 
					CHECK (hidden_reason IS NULL OR hidden_reason IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment', 'inappropriate_image')),
				ADD COLUMN hidden_by uuid REFERENCES users(id) ON DELETE RESTRICT,
				ADD COLUMN hidden_revision integer,
				ADD COLUMN image_storage_state varchar(24) NOT NULL DEFAULT 'live' 
					CHECK (image_storage_state IN ('live', 'quarantine_pending', 'quarantined', 'restore_pending', 'quarantine_failed', 'restore_failed'));

			CREATE INDEX IDX_trip_reviews_moderation ON trip_reviews (host_id, moderation_status) 
				WHERE moderation_status = 'hidden';

			CREATE TABLE trip_review_moderation_decisions (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				review_id uuid NOT NULL,
				revision integer NOT NULL,
				host_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				decision varchar(16) NOT NULL CHECK (decision IN ('keep', 'hide', 'restore')),
				reason varchar(50) CHECK (reason IS NULL OR reason IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment', 'inappropriate_image')),
				note text,
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				
				FOREIGN KEY (review_id, revision) REFERENCES trip_review_revisions(review_id, revision) ON DELETE RESTRICT,
				CONSTRAINT UQ_host_decision_per_revision UNIQUE (review_id, revision, host_id)
			);

			CREATE INDEX IDX_moderation_decisions_review ON trip_review_moderation_decisions (review_id, created_at DESC);
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
			DROP TABLE IF EXISTS trip_review_moderation_decisions;
			DROP INDEX IF EXISTS IDX_trip_reviews_moderation;
			ALTER TABLE trip_reviews 
				DROP COLUMN IF EXISTS image_storage_state,
				DROP COLUMN IF EXISTS hidden_revision,
				DROP COLUMN IF EXISTS hidden_by,
				DROP COLUMN IF EXISTS hidden_reason,
				DROP COLUMN IF EXISTS hidden_at,
				DROP COLUMN IF EXISTS moderation_status;
		`);
	}
}
