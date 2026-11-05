import type { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripReviewImages1793800000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		for (const table of ["trip_reviews", "trip_review_revisions"]) {
			await q.query(
				`ALTER TABLE ${table} ADD COLUMN images jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 5)`
			);
		}
		await q.query(
			"CREATE TABLE trip_review_uploads (id uuid PRIMARY KEY, reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, url text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT clock_timestamp())"
		);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE trip_review_uploads");
		for (const table of ["trip_review_revisions", "trip_reviews"])
			await q.query(`ALTER TABLE ${table} DROP COLUMN images`);
	}
}
