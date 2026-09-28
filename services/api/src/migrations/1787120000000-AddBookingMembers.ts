import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingMembers1787120000000 implements MigrationInterface {
	name = "AddBookingMembers1787120000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "booking_member_status" AS ENUM ('registered', 'removed', 'joined', 'no_show', 'left')`
		);
		await queryRunner.query(`
			CREATE TABLE "booking_members" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_id" uuid NOT NULL,
				"user_id" uuid,
				"is_primary" boolean NOT NULL DEFAULT false,
				"member_status" "booking_member_status" NOT NULL DEFAULT 'registered',
				"checked_in_at" timestamptz,
				"no_show_at" timestamptz,
				"left_at" timestamptz,
				"status_updated_by" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_booking_members_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_booking_members_booking_id" FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_booking_members_user_id" FOREIGN KEY ("user_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_booking_members_status_updated_by" FOREIGN KEY ("status_updated_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_booking_members_booking_id_user_id"
			ON "booking_members" ("booking_id", "user_id")
			WHERE "user_id" IS NOT NULL
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_booking_members_one_primary"
			ON "booking_members" ("booking_id")
			WHERE "is_primary" = true
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_booking_members_booking_id_status"
			ON "booking_members" ("booking_id", "member_status")
		`);

		await queryRunner.query(`
			CREATE TABLE "booking_member_initializations" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_id" uuid NOT NULL,
				"actor_id" uuid NOT NULL,
				"idempotency_key" varchar(128) NOT NULL,
				"request_fingerprint" varchar(64) NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_booking_member_initializations_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_booking_member_initializations_booking_id" UNIQUE ("booking_id"),
				CONSTRAINT "UQ_booking_member_initializations_scope" UNIQUE (
					"booking_id", "actor_id", "idempotency_key"
				),
				CONSTRAINT "FK_booking_member_initializations_booking_id" FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_booking_member_initializations_actor_id" FOREIGN KEY ("actor_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "booking_member_initializations"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_members_booking_id_status"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_booking_members_one_primary"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_booking_members_booking_id_user_id"`);
		await queryRunner.query(`DROP TABLE "booking_members"`);
		await queryRunner.query(`DROP TYPE "booking_member_status"`);
	}
}
