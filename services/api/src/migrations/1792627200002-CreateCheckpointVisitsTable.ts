import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-056 / BR-234. Checkpoint arrival confirmation and operational progress.
 * Upserts checkpoint visits for joined members with arrival time and GPS metadata when available.
 * Unique constraint on (trip_id, checkpoint_id, member_id) guarantees repeated confirmations
 * and resynced offline events do not duplicate records.
 */
export class CreateCheckpointVisitsTable1792627200002 implements MigrationInterface {
	name = "CreateCheckpointVisitsTable1792627200002";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "checkpoint_visits" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"checkpoint_id" uuid NOT NULL,
				"member_id" uuid NOT NULL,
				"confirmed_by_id" uuid NOT NULL,
				"arrived_at" timestamptz NOT NULL,
				"location" geography(Point, 4326),
				"captured_offline" boolean NOT NULL DEFAULT false,
				"sync_id" varchar(128),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_checkpoint_visits_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_checkpoint_visits_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_checkpoint_visits_checkpoint_id" FOREIGN KEY ("checkpoint_id")
					REFERENCES "checkpoints" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_checkpoint_visits_member_id" FOREIGN KEY ("member_id")
					REFERENCES "booking_members" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_checkpoint_visits_confirmed_by_id" FOREIGN KEY ("confirmed_by_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "UQ_checkpoint_visits_trip_checkpoint_member"
					UNIQUE ("trip_id", "checkpoint_id", "member_id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_checkpoint_visits_trip_checkpoint" ON "checkpoint_visits" ("trip_id", "checkpoint_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_checkpoint_visits_trip_member" ON "checkpoint_visits" ("trip_id", "member_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_checkpoint_visits_sync_id" ON "checkpoint_visits" ("sync_id") WHERE "sync_id" IS NOT NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checkpoint_visits_sync_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checkpoint_visits_trip_member"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checkpoint_visits_trip_checkpoint"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "checkpoint_visits"`);
	}
}
