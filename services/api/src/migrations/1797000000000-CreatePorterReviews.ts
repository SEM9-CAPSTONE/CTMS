import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterReviews1797000000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE porter_reviews (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
			member_id uuid NOT NULL REFERENCES booking_members(id) ON DELETE RESTRICT,
			reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
			trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
			porter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
			rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
			comment text CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 2000 AND btrim(comment) <> '')),
			revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
			moderation_status varchar(7) NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible','hidden')),
			edit_expires_at timestamptz NOT NULL,
			created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			CONSTRAINT UQ_porter_reviews_participation_target UNIQUE (member_id, reviewer_id, porter_id),
			CONSTRAINT CHK_porter_reviews_deadline CHECK (created_at < edit_expires_at AND updated_at < edit_expires_at)
		)`);
		await queryRunner.query(
			"CREATE INDEX IDX_porter_reviews_booking ON porter_reviews (booking_id, reviewer_id)"
		);
		await queryRunner.query(
			"CREATE INDEX IDX_porter_reviews_rating ON porter_reviews (porter_id) WHERE moderation_status = 'visible'"
		);
		await queryRunner.query(`CREATE TABLE porter_review_revisions (
			review_id uuid NOT NULL REFERENCES porter_reviews(id) ON DELETE RESTRICT,
			revision integer NOT NULL CHECK (revision > 0),
			rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
			comment text CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 2000 AND btrim(comment) <> '')),
			recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
			PRIMARY KEY (review_id, revision)
		)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE porter_review_revisions");
		await queryRunner.query("DROP TABLE porter_reviews");
	}
}
