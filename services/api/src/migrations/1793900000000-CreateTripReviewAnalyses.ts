import type { MigrationInterface, QueryRunner } from "typeorm";
export class CreateTripReviewAnalyses1793900000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE trip_review_analysis_controls (
   trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE, last_batch_at timestamptz)`);
		await q.query(`CREATE TABLE trip_review_analysis_suppressions (
   review_id uuid PRIMARY KEY REFERENCES trip_reviews(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
		await q.query(`CREATE TABLE trip_review_analysis_batches (
   id uuid PRIMARY KEY, trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
   requester_id uuid REFERENCES users(id) ON DELETE SET NULL,
   provider varchar(40) NOT NULL, model varchar(200) NOT NULL, config_version varchar(100) NOT NULL, prompt_version varchar(40) NOT NULL,
   status varchar(16) NOT NULL CHECK (status IN ('pending','running','succeeded','partial','failed')),
   created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz)`);
		await q.query(
			"CREATE UNIQUE INDEX UQ_review_analysis_active_trip ON trip_review_analysis_batches(trip_id) WHERE status IN ('pending','running')"
		);
		await q.query(`CREATE TABLE trip_review_analysis_items (
   id uuid PRIMARY KEY, review_id uuid NOT NULL, source_revision integer NOT NULL,
   provider varchar(40) NOT NULL, model varchar(200) NOT NULL, config_version varchar(100) NOT NULL, prompt_version varchar(40) NOT NULL,
   status varchar(16) NOT NULL CHECK (status IN ('pending','running','succeeded','failed','skipped','suppressed')),
   attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3), lease_token uuid, lease_until timestamptz,
   next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
   sentiment varchar(16) CHECK (sentiment IN ('positive','neutral','negative','mixed')),
   topics jsonb CHECK (jsonb_typeof(topics) = 'array' AND jsonb_array_length(topics) <= 5),
   summary text CHECK (char_length(summary) <= 500), confidence double precision CHECK (confidence >= 0 AND confidence <= 1 AND confidence <> 'NaN'::float8),
   actual_model varchar(200), request_id varchar(200), usage jsonb, input_hash varchar(64), error_code varchar(60),
   created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
   FOREIGN KEY (review_id,source_revision) REFERENCES trip_review_revisions(review_id,revision) ON DELETE CASCADE,
   CONSTRAINT UQ_review_analysis_source UNIQUE(review_id,source_revision,provider,model,config_version,prompt_version))`);
		await q.query(
			"CREATE INDEX IDX_review_analysis_queue ON trip_review_analysis_items(next_attempt_at) WHERE status='pending'"
		);
		await q.query(`CREATE TABLE trip_review_analysis_batch_items (
   batch_id uuid NOT NULL REFERENCES trip_review_analysis_batches(id) ON DELETE CASCADE,
   item_id uuid NOT NULL REFERENCES trip_review_analysis_items(id) ON DELETE CASCADE,
   start_attempt integer NOT NULL DEFAULT 0, end_attempt integer, terminal_status varchar(16), terminal_error_code varchar(60), PRIMARY KEY(batch_id,item_id))`);
		await q.query(`CREATE TABLE trip_review_analysis_attempts (
   item_id uuid NOT NULL REFERENCES trip_review_analysis_items(id) ON DELETE CASCADE, attempt integer NOT NULL,
   token uuid NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz,
   outcome varchar(24) NOT NULL, error_code varchar(60), PRIMARY KEY(item_id,attempt))`);
		await q.query(`CREATE TABLE trip_review_analysis_slots (
   id integer PRIMARY KEY CHECK (id IN (1,2)), item_id uuid REFERENCES trip_review_analysis_items(id) ON DELETE SET NULL,
   lease_token uuid, lease_until timestamptz)`);
		await q.query("INSERT INTO trip_review_analysis_slots(id) VALUES (1),(2)");
	}
	async down(q: QueryRunner): Promise<void> {
		for (const table of [
			"slots",
			"attempts",
			"batch_items",
			"items",
			"batches",
			"suppressions",
			"controls",
		]) {
			await q.query(`DROP TABLE trip_review_analysis_${table}`);
		}
	}
}
