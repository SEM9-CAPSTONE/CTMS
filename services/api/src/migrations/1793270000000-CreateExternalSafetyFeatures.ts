import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateExternalSafetyFeatures1793270000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE external_safety_features (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			source varchar(64) NOT NULL, external_id varchar(200) NOT NULL,
			source_type varchar(32) NOT NULL CHECK (source_type IN ('OFFICIAL_CURRENT','BASE_HISTORICAL','RESOURCE')),
			source_reference varchar(1000) NOT NULL, permission_reference varchar(500) NOT NULL,
			hazard_type varchar(100) NOT NULL, severity varchar(16) NOT NULL
				CHECK (severity IN ('LOW','MEDIUM','HIGH','VERY_HIGH','UNKNOWN')),
			geom geography(Geometry,4326) NOT NULL,
			geometry_role varchar(100) NOT NULL, description varchar(2000) NOT NULL,
			observed_at timestamptz, issued_at timestamptz, fetched_at timestamptz NOT NULL DEFAULT now(),
			valid_from timestamptz, valid_until timestamptz,
			lifecycle_status varchar(16) NOT NULL CHECK (lifecycle_status IN ('ACTIVE','RESOLVED')),
			verification_status varchar(32) NOT NULL CHECK (verification_status IN ('SOURCE_PROVIDED','UNVERIFIED','VERIFIED')),
			accuracy_meters double precision CHECK (accuracy_meters >= 0 AND accuracy_meters < 'Infinity'::float8),
			raw_payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
			UNIQUE (source, external_id),
			CHECK (GeometryType(geom::geometry) IN ('POINT','LINESTRING','POLYGON','MULTIPOLYGON')),
			CHECK (ST_IsValid(geom::geometry) AND NOT ST_IsEmpty(geom::geometry)),
			CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until)
		)`);
		await runner.query(
			"CREATE INDEX idx_external_safety_geom ON external_safety_features USING GIST (geom)"
		);
		await runner.query(
			"CREATE INDEX idx_external_safety_validity ON external_safety_features (valid_until)"
		);
		await runner.query(`CREATE TABLE safety_import_rejections (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source varchar(64) NOT NULL,
			permission_reference varchar(500) NOT NULL, record_index integer NOT NULL,
			reason varchar(200) NOT NULL, raw_payload jsonb NOT NULL,
			recorded_at timestamptz NOT NULL DEFAULT now()
		)`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP TABLE safety_import_rejections");
		await runner.query("DROP TABLE external_safety_features");
	}
}
