import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTripReviews1793490000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE trip_reviews (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
			member_id uuid NOT NULL REFERENCES booking_members(id) ON DELETE RESTRICT,
			reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
			trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
			host_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
			target varchar(4) NOT NULL CHECK (target IN ('trip','host')),
			target_id uuid NOT NULL,
			rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
			comment text CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 2000 AND btrim(comment) <> '')),
			revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
			created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			CONSTRAINT UQ_trip_reviews_participation_target UNIQUE (reviewer_id, member_id, target),
			CONSTRAINT CHK_trip_reviews_target CHECK ((target = 'trip' AND target_id = trip_id) OR (target = 'host' AND target_id = host_id))
		)`);
		await queryRunner.query(
			"CREATE INDEX IDX_trip_reviews_booking ON trip_reviews (booking_id, reviewer_id)"
		);
		await queryRunner.query(`CREATE TABLE trip_review_revisions (
			review_id uuid NOT NULL REFERENCES trip_reviews(id) ON DELETE RESTRICT,
			revision integer NOT NULL CHECK (revision > 0),
			rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
			comment text CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 2000 AND btrim(comment) <> '')),
			recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			PRIMARY KEY (review_id, revision)
		)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE trip_review_revisions");
		await queryRunner.query("DROP TABLE trip_reviews");
	}
}
