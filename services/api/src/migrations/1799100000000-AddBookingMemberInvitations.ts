import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingMemberInvitations1799100000000 implements MigrationInterface {
	name = "AddBookingMemberInvitations1799100000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_member_invitation_status') THEN
					CREATE TYPE "booking_member_invitation_status" AS ENUM (
						'pending',
						'accepted',
						'declined',
						'revoked',
						'expired'
					);
				END IF;
			END
			$$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "booking_member_invitations" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_id" uuid NOT NULL,
				"invited_by_user_id" uuid NOT NULL,
				"invited_email" varchar(254) NOT NULL,
				"invited_user_id" uuid,
				"token" varchar(128) NOT NULL,
				"status" "booking_member_invitation_status" NOT NULL DEFAULT 'pending',
				"expires_at" timestamptz NOT NULL,
				"responded_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_booking_member_invitations_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_booking_member_invitations_token" UNIQUE ("token"),
				CONSTRAINT "FK_booking_member_invitations_booking_id" FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_booking_member_invitations_invited_by_user_id" FOREIGN KEY ("invited_by_user_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_booking_member_invitations_invited_user_id" FOREIGN KEY ("invited_user_id")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "UQ_booking_member_invitations_pending_email"
			ON "booking_member_invitations" ("booking_id", LOWER("invited_email"))
			WHERE "status" = 'pending'
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_booking_member_invitations_email_status"
			ON "booking_member_invitations" (LOWER("invited_email"), "status")
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_booking_member_invitations_booking_id"
			ON "booking_member_invitations" ("booking_id", "created_at" ASC)
		`);

		// Backfill missing primary member rows for active bookings so single-person
		// and uninitialized bookings participate in roster, offline maps, GPS, and health profile checks.
		await queryRunner.query(`
			INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
			SELECT b."id", b."user_id", true, 'registered'::booking_member_status
			FROM "bookings" b
			WHERE b."status" IN ('pending_payment', 'confirmed')
			  AND NOT EXISTS (
				SELECT 1 FROM "booking_members" bm
				WHERE bm."booking_id" = b."id"
			  )
			ON CONFLICT DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_member_invitations_booking_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_member_invitations_email_status"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_booking_member_invitations_pending_email"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "booking_member_invitations"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "booking_member_invitation_status"`);
	}
}
