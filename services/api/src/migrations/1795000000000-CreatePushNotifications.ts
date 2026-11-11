import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-090 (BR-273/BR-194/BR-195/BR-197/BR-198): background push notifications.
 *
 * `push_devices` holds the push tokens the mobile app registers for its signed-in user.
 * `push_notifications` is the delivery outbox: one row per (source event, recipient), so the same
 * event is never pushed twice to the same person. Its delivery status is kept apart from the
 * business state it talks about.
 */
export class CreatePushNotifications1795000000000 implements MigrationInterface {
	name = "CreatePushNotifications1795000000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "push_devices" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"user_id" uuid NOT NULL,
				"token" varchar(512) NOT NULL,
				"platform" varchar(10) NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"last_seen_at" timestamptz NOT NULL DEFAULT now(),
				"disabled_at" timestamptz,
				CONSTRAINT "PK_push_devices" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_push_devices_token" UNIQUE ("token"),
				CONSTRAINT "CHK_push_devices_platform" CHECK ("platform" IN ('android', 'ios')),
				CONSTRAINT "FK_push_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_push_devices_active_user" ON "push_devices" ("user_id") WHERE "disabled_at" IS NULL`
		);

		await queryRunner.query(`
			CREATE TABLE "push_notifications" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"event_key" varchar(120) NOT NULL,
				"recipient_id" uuid NOT NULL,
				"category" varchar(20) NOT NULL,
				"mandatory" boolean NOT NULL DEFAULT false,
				"trip_id" uuid,
				"trip_scoped" boolean NOT NULL DEFAULT false,
				"title" varchar(120) NOT NULL,
				"body" varchar(500) NOT NULL,
				"data" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"status" varchar(10) NOT NULL DEFAULT 'pending',
				"skip_reason" varchar(40),
				"attempts" int NOT NULL DEFAULT 0,
				"next_attempt_at" timestamptz NOT NULL DEFAULT now(),
				"last_error" varchar(500),
				"sent_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_push_notifications" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_push_notifications_event_recipient" UNIQUE ("event_key", "recipient_id"),
				CONSTRAINT "CHK_push_notifications_category" CHECK ("category" IN ('booking', 'porter_assignment', 'weather', 'sos', 'emergency')),
				CONSTRAINT "CHK_push_notifications_status" CHECK ("status" IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
				CONSTRAINT "FK_push_notifications_recipient" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_push_notifications_due" ON "push_notifications" ("next_attempt_at") WHERE "status" IN ('pending', 'sending')`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "push_notifications"`);
		await queryRunner.query(`DROP TABLE "push_devices"`);
	}
}
