import type { MigrationInterface, QueryRunner } from "typeorm";

export class ManageTripImages1792800000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE trip_images (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
   url varchar(500) NOT NULL, storage_key text,
   content_hash text NOT NULL, media_type text NOT NULL,
   sort_order integer NOT NULL CHECK(sort_order >= 0),
   created_at timestamptz NOT NULL DEFAULT now(),
   UNIQUE(trip_id, content_hash), UNIQUE(trip_id, sort_order)
  )`);
		await q.query(`INSERT INTO trip_images(trip_id,url,content_hash,media_type,sort_order)
   SELECT id,cover_image_url,md5(cover_image_url),'legacy',0 FROM trips
   WHERE cover_image_url IS NOT NULL AND cover_image_url <> ''`);
		await q.query(`CREATE TABLE trip_image_cleanup (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), url text NOT NULL, storage_key text,
   attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now()
  )`);
		await q.query("CREATE INDEX ON trip_image_cleanup(next_attempt_at)");
		await q.query(`CREATE FUNCTION cleanup_trip_image() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
    INSERT INTO trip_image_cleanup(url,storage_key) SELECT OLD.url,OLD.storage_key
      WHERE NOT EXISTS(SELECT 1 FROM trip_images WHERE url=OLD.url);
    UPDATE trips SET cover_image_url=(SELECT url FROM trip_images WHERE trip_id=OLD.trip_id ORDER BY sort_order LIMIT 1)
     WHERE id=OLD.trip_id;
    RETURN OLD;
   END $$`);
		await q.query(`CREATE TRIGGER trip_image_deleted AFTER DELETE ON trip_images
   FOR EACH ROW EXECUTE FUNCTION cleanup_trip_image()`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE trip_images");
		await q.query("DROP FUNCTION cleanup_trip_image()");
		await q.query("DROP TABLE trip_image_cleanup");
	}
}
