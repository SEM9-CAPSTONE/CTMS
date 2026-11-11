import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOfflineBasemaps1794900000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE offline_basemaps (
      package_id uuid PRIMARY KEY REFERENCES offline_packages(id) ON DELETE RESTRICT,
      sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
      size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
      bounds jsonb NOT NULL CHECK (jsonb_array_length(bounds)=4),
      min_zoom integer NOT NULL CHECK(min_zoom>=0),
      max_zoom integer NOT NULL CHECK(max_zoom>=min_zoom AND max_zoom<=20),
      attribution text NOT NULL, license_url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER offline_basemaps_immutable BEFORE UPDATE OR DELETE ON offline_basemaps
      FOR EACH ROW EXECUTE FUNCTION offline_package_immutable();`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE offline_basemaps");
	}
}
