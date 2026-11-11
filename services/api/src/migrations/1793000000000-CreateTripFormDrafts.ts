import type { MigrationInterface, QueryRunner } from "typeorm";
export class CreateTripFormDrafts1793000000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE trip_form_drafts (
   id uuid PRIMARY KEY,host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   form_values jsonb NOT NULL,completed_trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
   created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
  )`);
		await q.query("CREATE INDEX ON trip_form_drafts(host_id,updated_at DESC)");
		await q.query(`CREATE TABLE trip_form_draft_images (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),draft_id uuid NOT NULL REFERENCES trip_form_drafts(id) ON DELETE CASCADE,
   filename varchar(255) NOT NULL,media_type varchar(20) NOT NULL,content_hash varchar(64) NOT NULL,
   bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 5242880),
   sort_order integer NOT NULL CHECK(sort_order BETWEEN 0 AND 4),UNIQUE(draft_id,sort_order),UNIQUE(draft_id,content_hash)
  )`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE trip_form_draft_images");
		await q.query("DROP TABLE trip_form_drafts");
	}
}
