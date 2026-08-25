import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCheckpointsTable1786900000000 implements MigrationInterface {
	name = "CreateCheckpointsTable1786900000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "checkpoint_type" AS ENUM ('start', 'rest', 'water', 'dangerous', 'emergency_shelter', 'finish')`
		);
		await queryRunner.query(`
			CREATE TABLE "checkpoints" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"route_id" uuid NOT NULL,
				"name" varchar(150) NOT NULL,
				"location" geography(Point,4326) NOT NULL,
				"radius_m" integer NOT NULL,
				"type" "checkpoint_type" NOT NULL,
				"expected_arrival_offset" integer NOT NULL,
				"instructions" varchar(1000) NOT NULL,
				"nearby_water_or_shelter" boolean NOT NULL,
				"route_position" double precision NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_checkpoints_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_checkpoints_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_checkpoints_radius_m" CHECK ("radius_m" BETWEEN 10 AND 500),
				CONSTRAINT "CHK_checkpoints_expected_arrival_offset" CHECK ("expected_arrival_offset" >= 0),
				CONSTRAINT "CHK_checkpoints_route_position" CHECK ("route_position" >= 0 AND "route_position" <= 1)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_checkpoints_route_order" ON "checkpoints" ("route_id", "route_position", "created_at", "id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_checkpoints_location" ON "checkpoints" USING GIST ("location")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checkpoints_location"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checkpoints_route_order"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "checkpoints"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "checkpoint_type"`);
	}
}
