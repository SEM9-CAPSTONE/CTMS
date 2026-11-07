import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTripReviewModerationPipeline1794500000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
			CREATE TABLE trip_review_moderation_runs (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				review_id uuid NOT NULL,
				source_revision integer NOT NULL,
				provider varchar(40) NOT NULL,
				model varchar(200) NOT NULL,
				config_version varchar(100) NOT NULL,
				prompt_version varchar(40) NOT NULL,
				
				text_scan_status varchar(16) NOT NULL DEFAULT 'pending' 
					CHECK (text_scan_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
				image_scan_status varchar(16) NOT NULL DEFAULT 'pending' 
					CHECK (image_scan_status IN ('pending', 'running', 'completed', 'failed', 'unsupported', 'not_applicable')),
				aspects_status varchar(16) NOT NULL DEFAULT 'pending' 
					CHECK (aspects_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
				incidents_status varchar(16) NOT NULL DEFAULT 'pending' 
					CHECK (incidents_status IN ('pending', 'running', 'completed', 'failed', 'not_applicable')),
					
				lease_token uuid,
				lease_until timestamptz,
				attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
				error_code varchar(60),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				completed_at timestamptz,
				
				FOREIGN KEY (review_id, source_revision) REFERENCES trip_review_revisions(review_id, revision) ON DELETE RESTRICT,
				CONSTRAINT UQ_moderation_run_source UNIQUE (review_id, source_revision, provider, model, config_version, prompt_version),
				CONSTRAINT UQ_moderation_run_identity UNIQUE (id, review_id, source_revision)
			);

			CREATE INDEX IDX_moderation_runs_queue ON trip_review_moderation_runs (created_at) 
				WHERE text_scan_status IN ('pending', 'running') OR image_scan_status IN ('pending', 'running')
				   OR aspects_status IN ('pending', 'running') OR incidents_status IN ('pending', 'running');

			CREATE TABLE trip_review_moderation_image_items (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				run_id uuid NOT NULL,
				review_id uuid NOT NULL,
				source_revision integer NOT NULL,
				image_index integer NOT NULL CHECK (image_index >= 0 AND image_index < 5),
				storage_key varchar(255) NOT NULL,
				scan_status varchar(16) NOT NULL 
					CHECK (scan_status IN ('pending', 'running', 'completed', 'failed', 'unsupported')),
				has_violation boolean,
				flag_type varchar(50) CHECK (flag_type IS NULL OR flag_type = 'inappropriate_image'),
				confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
				evidence text,
				error_code varchar(60),
				scanned_at timestamptz,
				
				FOREIGN KEY (run_id, review_id, source_revision) 
					REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
				CONSTRAINT UQ_moderation_image_item UNIQUE (run_id, image_index),
				CONSTRAINT CHK_image_item_scan_violation CHECK (
					(scan_status = 'completed' AND has_violation IS NOT NULL AND (
						(has_violation = true AND flag_type IS NOT NULL) OR
						(has_violation = false AND flag_type IS NULL)
					))
					OR
					(scan_status <> 'completed' AND has_violation IS NULL AND flag_type IS NULL)
				)
			);

			CREATE TABLE trip_review_moderation_flags (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				run_id uuid NOT NULL,
				review_id uuid NOT NULL,
				source_revision integer NOT NULL,
				channel varchar(16) NOT NULL CHECK (channel IN ('text', 'image')),
				target_image_index integer,
				flag_type varchar(50) NOT NULL 
					CHECK (flag_type IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment', 'inappropriate_image')),
				detection_source varchar(10) NOT NULL CHECK (detection_source IN ('model', 'rule')),
				confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
				evidence text NOT NULL,
				quote text CHECK (quote IS NULL OR char_length(quote) BETWEEN 1 AND 500),
				lifecycle_status varchar(16) NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'superseded', 'resolved')),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				resolved_at timestamptz,
				resolved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
				
				FOREIGN KEY (run_id, review_id, source_revision) 
					REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
				CONSTRAINT CHK_flag_source_rules CHECK (
					(detection_source = 'model' AND confidence IS NOT NULL AND flag_type <> 'personal_data_leak') OR
					(detection_source = 'rule' AND confidence IS NULL AND flag_type = 'personal_data_leak')
				),
				CONSTRAINT CHK_flag_channel_consistency CHECK (
					(channel = 'image' AND target_image_index IS NOT NULL AND target_image_index BETWEEN 0 AND 4 AND quote IS NULL AND flag_type = 'inappropriate_image') OR
					(channel = 'text' AND target_image_index IS NULL AND quote IS NOT NULL AND btrim(quote) <> '' AND flag_type IN ('profanity_or_insult', 'personal_data_leak', 'spam_or_irrelevant', 'harassment'))
				)
			);

			CREATE UNIQUE INDEX UQ_moderation_flag_run_item 
			ON trip_review_moderation_flags (run_id, channel, flag_type, (COALESCE(target_image_index, -1)));

			CREATE UNIQUE INDEX UQ_active_flag_per_review 
			ON trip_review_moderation_flags (review_id, channel, flag_type, (COALESCE(target_image_index, -1)))
			WHERE lifecycle_status = 'active';

			CREATE INDEX IDX_moderation_flags_active ON trip_review_moderation_flags (review_id) 
			WHERE lifecycle_status = 'active';

			CREATE TABLE trip_review_aspect_sentiments (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				run_id uuid NOT NULL,
				review_id uuid NOT NULL,
				source_revision integer NOT NULL,
				aspect varchar(30) NOT NULL CHECK (aspect IN ('safety', 'guide_support', 'equipment', 'value')),
				sentiment varchar(16) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
				confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
				quote text CHECK (quote IS NULL OR char_length(quote) BETWEEN 1 AND 500),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				
				FOREIGN KEY (run_id, review_id, source_revision) 
					REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT,
				CONSTRAINT UQ_aspect_sentiment UNIQUE (run_id, aspect)
			);

			CREATE TABLE trip_review_incident_signals (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				run_id uuid NOT NULL,
				review_id uuid NOT NULL,
				source_revision integer NOT NULL,
				incident_type varchar(40) NOT NULL CHECK (incident_type IN ('fall_slip', 'injury', 'lost_path', 'weather_hazard', 'other')),
				occurred varchar(10) NOT NULL CHECK (occurred IN ('yes', 'warning', 'unknown')),
				severity varchar(16) NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe', 'unknown')),
				quote text NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 500),
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				
				FOREIGN KEY (run_id, review_id, source_revision) 
					REFERENCES trip_review_moderation_runs(id, review_id, source_revision) ON DELETE RESTRICT
			);

			CREATE UNIQUE INDEX UQ_incident_signal_item 
			ON trip_review_incident_signals (run_id, incident_type, md5(quote));

			CREATE TABLE trip_review_moderation_outbox (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				review_id uuid NOT NULL REFERENCES trip_reviews(id) ON DELETE RESTRICT,
				source_revision integer NOT NULL,
				config_version varchar(100) NOT NULL,
				created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
				processed_at timestamptz,
				CONSTRAINT UQ_moderation_outbox UNIQUE (review_id, source_revision, config_version)
			);

			CREATE INDEX IDX_moderation_outbox_pending ON trip_review_moderation_outbox (created_at) 
			WHERE processed_at IS NULL;

			CREATE OR REPLACE FUNCTION delete_moderation_outbox_before_review_delete()
			RETURNS trigger AS $$
			BEGIN
				DELETE FROM trip_review_moderation_outbox WHERE review_id = OLD.id;
				RETURN OLD;
			END;
			$$ LANGUAGE plpgsql;

			CREATE TRIGGER trg_delete_moderation_outbox_before_review_delete
			BEFORE DELETE ON trip_reviews
			FOR EACH ROW EXECUTE FUNCTION delete_moderation_outbox_before_review_delete();
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
			DROP TRIGGER IF EXISTS trg_delete_moderation_outbox_before_review_delete ON trip_reviews;
			DROP FUNCTION IF EXISTS delete_moderation_outbox_before_review_delete();
			DROP TABLE IF EXISTS trip_review_moderation_outbox;
			DROP TABLE IF EXISTS trip_review_incident_signals;
			DROP TABLE IF EXISTS trip_review_aspect_sentiments;
			DROP TABLE IF EXISTS trip_review_moderation_flags;
			DROP TABLE IF EXISTS trip_review_moderation_image_items;
			DROP TABLE IF EXISTS trip_review_moderation_runs;
		`);
	}
}
