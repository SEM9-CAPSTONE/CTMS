import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrekkingRoutesTable1786800000000 implements MigrationInterface {
	name = "CreateTrekkingRoutesTable1786800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "trekking_route_difficulty" AS ENUM ('easy', 'moderate', 'hard', 'expert')`
		);
		await queryRunner.query(
			`CREATE TYPE "trekking_route_status" AS ENUM ('draft', 'pending_approval', 'active', 'closed')`
		);

		await queryRunner.query(`
			CREATE TABLE "trekking_routes" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"campsite_id" uuid NOT NULL,
				"name" varchar(150) NOT NULL,
				"description" text,
				"route_geom" geography(LineString,4326) NOT NULL,
				"length_meters" double precision NOT NULL,
				"difficulty" "trekking_route_difficulty" NOT NULL,
				"expected_duration_minutes" integer NOT NULL,
				"status" "trekking_route_status" NOT NULL DEFAULT 'draft',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trekking_routes_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trekking_routes_campsite_id" FOREIGN KEY ("campsite_id")
					REFERENCES "campsites" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_trekking_routes_minimum_vertices"
					CHECK (ST_NPoints("route_geom"::geometry) >= 2),
				CONSTRAINT "CHK_trekking_routes_valid_geometry"
					CHECK (ST_IsValid("route_geom"::geometry)),
				CONSTRAINT "CHK_trekking_routes_positive_length" CHECK ("length_meters" > 0),
				CONSTRAINT "CHK_trekking_routes_positive_duration" CHECK ("expected_duration_minutes" > 0)
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_trekking_routes_campsite_id" ON "trekking_routes" ("campsite_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_trekking_routes_status" ON "trekking_routes" ("status")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_trekking_routes_route_geom" ON "trekking_routes" USING GIST ("route_geom")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trekking_routes_route_geom"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trekking_routes_status"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trekking_routes_campsite_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trekking_routes"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trekking_route_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trekking_route_difficulty"`);
	}
}
