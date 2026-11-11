import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-082 (BR-263): protected real-time events kept for a short window so a reconnecting client
 * can recover the ones it missed.
 *
 * `id` is the event identity sent with the live copy (dedupe); `sequence` is the cursor. The
 * audience is frozen when the event is published (user ids, role names, Trip), but recovery checks
 * the caller's current roles and Trip membership again.
 */
export class CreateRealtimeEvents1794900000000 implements MigrationInterface {
	name = "CreateRealtimeEvents1794900000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "realtime_events" (
				"id" uuid NOT NULL,
				"sequence" bigserial NOT NULL,
				"event_name" varchar(80) NOT NULL,
				"payload" jsonb NOT NULL,
				"user_ids" uuid[] NOT NULL DEFAULT '{}',
				"roles" varchar(20)[] NOT NULL DEFAULT '{}',
				"trip_id" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_realtime_events" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_realtime_events_sequence" UNIQUE ("sequence")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_realtime_events_created_at" ON "realtime_events" ("created_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_realtime_events_user_ids" ON "realtime_events" USING GIN ("user_ids")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "realtime_events"`);
	}
}
