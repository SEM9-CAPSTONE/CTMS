import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-063 (Jira CTMS-319): server-raised behind-schedule warnings are kept in `safety_events`
 * (spec §13.7), one row per (trip, camper, checkpoint, level).
 *
 * The new enum value is compared through `::text` in the CHECK because PostgreSQL cannot use a value
 * added by `ALTER TYPE ... ADD VALUE` inside the same transaction. The unique index predicate uses
 * `checkpoint_id IS NOT NULL` instead (index predicates must be IMMUTABLE); the CHECK guarantees that
 * only BEHIND_SCHEDULE rows carry a checkpoint.
 */
export class AddBehindScheduleSafetyEvents1794300000000 implements MigrationInterface {
	name = "AddBehindScheduleSafetyEvents1794300000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "safety_event_type" ADD VALUE IF NOT EXISTS 'BEHIND_SCHEDULE'`
		);
		await queryRunner.query(`
			DO $$ BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'behind_schedule_level') THEN
					CREATE TYPE "behind_schedule_level" AS ENUM ('BEHIND', 'SEVERELY_BEHIND');
				END IF;
			END $$;
		`);
		await queryRunner.query(`
			ALTER TABLE "safety_events"
				ADD COLUMN "checkpoint_id" uuid,
				ADD COLUMN "warning_level" "behind_schedule_level",
				ADD CONSTRAINT "FK_safety_events_checkpoint_id" FOREIGN KEY ("checkpoint_id")
					REFERENCES "checkpoints" ("id") ON DELETE RESTRICT,
				ADD CONSTRAINT "CHK_safety_events_behind_schedule" CHECK (
					("event_type"::text = 'BEHIND_SCHEDULE')
						= ("checkpoint_id" IS NOT NULL AND "warning_level" IS NOT NULL)
				)
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_safety_events_behind_schedule"
				ON "safety_events" ("trip_id", "user_id", "checkpoint_id", "warning_level")
				WHERE "checkpoint_id" IS NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DELETE FROM "safety_events" WHERE "event_type"::text = 'BEHIND_SCHEDULE'`
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_safety_events_behind_schedule"`);
		await queryRunner.query(`
			ALTER TABLE "safety_events"
				DROP CONSTRAINT IF EXISTS "CHK_safety_events_behind_schedule",
				DROP CONSTRAINT IF EXISTS "FK_safety_events_checkpoint_id",
				DROP COLUMN IF EXISTS "warning_level",
				DROP COLUMN IF EXISTS "checkpoint_id"
		`);
		await queryRunner.query(`DROP TYPE IF EXISTS "behind_schedule_level"`);
		// PostgreSQL cannot drop a single enum value; 'BEHIND_SCHEDULE' stays unused in "safety_event_type".
	}
}
