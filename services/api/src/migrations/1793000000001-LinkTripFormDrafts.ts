import type { MigrationInterface, QueryRunner } from "typeorm";
export class LinkTripFormDrafts1793000000001 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(
			"ALTER TABLE trip_form_drafts ADD COLUMN trip_id uuid REFERENCES trips(id) ON DELETE CASCADE"
		);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("ALTER TABLE trip_form_drafts DROP COLUMN trip_id");
	}
}
