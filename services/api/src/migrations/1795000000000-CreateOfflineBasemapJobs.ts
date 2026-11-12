import type { MigrationInterface, QueryRunner } from "typeorm";

/** Durable sidecar work is independent of immutable core package readiness. */
export class CreateOfflineBasemapJobs1795000000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE offline_basemap_jobs (
      package_id uuid PRIMARY KEY REFERENCES offline_packages(id) ON DELETE RESTRICT,
      status varchar(12) NOT NULL DEFAULT 'PENDING'
        CHECK(status IN ('PENDING','GENERATING','READY','FAILED')),
      attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      last_error varchar(64), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION offline_basemap_on_package() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO offline_basemap_jobs(package_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
      RETURN NEW;
    END $$;
    CREATE TRIGGER offline_basemap_on_package AFTER INSERT ON offline_packages
      FOR EACH ROW EXECUTE FUNCTION offline_basemap_on_package();
    INSERT INTO offline_basemap_jobs(package_id,status)
      SELECT p.id,CASE WHEN b.package_id IS NULL THEN 'PENDING' ELSE 'READY' END
      FROM offline_packages p LEFT JOIN offline_basemaps b ON b.package_id=p.id;`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query(`DROP TRIGGER offline_basemap_on_package ON offline_packages;
      DROP FUNCTION offline_basemap_on_package(); DROP TABLE offline_basemap_jobs;`);
	}
}
