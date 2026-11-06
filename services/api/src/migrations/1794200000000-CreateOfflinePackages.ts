import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOfflinePackages1794200000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
		 CREATE TABLE offline_packages (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
		  package_version integer NOT NULL CHECK(package_version>0),
		  generation_key varchar(64) NOT NULL CHECK(generation_key ~ '^[a-f0-9]{64}$'),
		  schema_version integer NOT NULL CHECK(schema_version=1),
		  manifest jsonb NOT NULL, provenance jsonb NOT NULL,
		  sha256 varchar(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
		  size_bytes integer NOT NULL CHECK(size_bytes>0 AND size_bytes<=20971520),
		  artifact_key varchar(68) NOT NULL CHECK(artifact_key=sha256 || '.zip'),
		  generated_at timestamptz NOT NULL,
		  UNIQUE(trip_id,package_version), UNIQUE(trip_id,generation_key), UNIQUE(id,trip_id)
		 );
		 CREATE TABLE offline_package_jobs (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		  request_key varchar(80) NOT NULL,
		  status varchar(24) NOT NULL DEFAULT 'PENDING'
		   CHECK(status IN ('PENDING','GENERATING','READY','BLOCKED','RETRYABLE_FAILED','FAILED')),
		  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
		  reason_codes jsonb NOT NULL DEFAULT '[]',
		  lease_token uuid, lease_until timestamptz,
		  next_attempt_at timestamptz NOT NULL DEFAULT now(),
		  package_id uuid, created_at timestamptz NOT NULL DEFAULT now(), generation_started_at timestamptz, completed_at timestamptz,
		  FOREIGN KEY(package_id,trip_id) REFERENCES offline_packages(id,trip_id),
		  UNIQUE(trip_id,request_key),
		  CHECK((status='GENERATING')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)),
		  CHECK((status='READY')=(package_id IS NOT NULL)),
		  CHECK(status NOT IN ('READY','BLOCKED','FAILED') OR completed_at IS NOT NULL)
		 );
		 CREATE INDEX offline_package_queue ON offline_package_jobs(status,next_attempt_at,created_at);
		 CREATE TABLE offline_package_audit (
		  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  job_id uuid NOT NULL REFERENCES offline_package_jobs(id) ON DELETE CASCADE,
		  status varchar(24) NOT NULL, reason_codes jsonb NOT NULL DEFAULT '[]',
		  created_at timestamptz NOT NULL DEFAULT now()
		 );
		 -- Retain cleanup receipts: a late stale writer is collected again on the next sweep.
		 CREATE TABLE offline_package_artifact_cleanup (
		  artifact_key varchar(68) PRIMARY KEY CHECK(artifact_key ~ '^[a-f0-9]{64}\\.zip$'),
		  job_id uuid REFERENCES offline_package_jobs(id) ON DELETE SET NULL,
		  next_cleanup_at timestamptz NOT NULL DEFAULT now()+interval '1 hour'
		 );
		 CREATE FUNCTION offline_package_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
		 BEGIN RAISE EXCEPTION 'READY offline packages are immutable'; END $$;
		 CREATE TRIGGER offline_package_immutable BEFORE UPDATE OR DELETE ON offline_packages
		 FOR EACH ROW EXECUTE FUNCTION offline_package_immutable();
		 -- The request and publication commit/roll back together, including non-service publishers.
		 CREATE FUNCTION offline_package_on_publication() RETURNS trigger LANGUAGE plpgsql AS $$
		 BEGIN
		  IF NEW.status='published' THEN
		   INSERT INTO offline_package_jobs(trip_id,request_key) VALUES(NEW.id,'initial')
		   ON CONFLICT(trip_id,request_key) DO NOTHING;
		  END IF;
		  RETURN NEW;
		 END $$;
		 CREATE TRIGGER offline_package_on_publication AFTER INSERT OR UPDATE OF status ON trips
		 FOR EACH ROW EXECUTE FUNCTION offline_package_on_publication();
		 INSERT INTO offline_package_jobs(trip_id,request_key)
		 SELECT id,'initial' FROM trips WHERE status='published'
		 ON CONFLICT(trip_id,request_key) DO NOTHING;
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
		 DROP TRIGGER offline_package_on_publication ON trips;
		 DROP FUNCTION offline_package_on_publication();
		 DROP TABLE offline_package_artifact_cleanup,offline_package_audit,offline_package_jobs,offline_packages;
		 DROP FUNCTION offline_package_immutable();
		`);
	}
}
