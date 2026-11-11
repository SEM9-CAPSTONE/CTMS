import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRouteDangerZonesTable1786950000000 implements MigrationInterface {
	name = "CreateRouteDangerZonesTable1786950000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "route_danger_zone_severity" AS ENUM ('low', 'medium', 'high')`
		);
		await queryRunner.query(`
			CREATE TABLE "route_danger_zones" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"route_id" uuid NOT NULL,
				"geom" geography(Geometry,4326) NOT NULL,
				"radius_m" double precision,
				"description" varchar(1000) NOT NULL,
				"severity" "route_danger_zone_severity" NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_route_danger_zones_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_route_danger_zones_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_route_danger_zones_geometry_type"
					CHECK (GeometryType("geom"::geometry) IN ('POINT', 'POLYGON')),
				CONSTRAINT "CHK_route_danger_zones_srid"
					CHECK (ST_SRID("geom"::geometry) = 4326),
				CONSTRAINT "CHK_route_danger_zones_valid_geometry"
					CHECK (ST_IsValid("geom"::geometry) AND NOT ST_IsEmpty("geom"::geometry)),
				CONSTRAINT "CHK_route_danger_zones_radius_contract" CHECK (
					(
						GeometryType("geom"::geometry) = 'POINT'
						AND "radius_m" IS NOT NULL
						AND "radius_m" > 0
						AND "radius_m" < 'Infinity'::double precision
					)
					OR (
						GeometryType("geom"::geometry) = 'POLYGON'
						AND "radius_m" IS NULL
					)
				),
				CONSTRAINT "CHK_route_danger_zones_description_nonblank"
					CHECK (BTRIM("description") <> '')
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_route_danger_zones_route_id" ON "route_danger_zones" ("route_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_route_danger_zones_geom" ON "route_danger_zones" USING GIST ("geom")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_route_danger_zones_geom"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_route_danger_zones_route_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "route_danger_zones"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "route_danger_zone_severity"`);
	}
}
