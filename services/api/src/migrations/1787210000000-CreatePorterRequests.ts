import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterRequests1787210000000 implements MigrationInterface {
	name = "CreatePorterRequests1787210000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'porter_request_status') THEN
					CREATE TYPE "porter_request_status" AS ENUM (
						'pending',
						'accepted',
						'declined',
						'cancelled',
						'expired'
					);
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "porter_requests" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"porter_id" uuid NOT NULL,
				"requested_by" uuid NOT NULL,
				"requested_role" varchar(20) NOT NULL,
				"note" varchar(500),
				"status" "porter_request_status" NOT NULL DEFAULT 'pending',
				"expires_at" timestamptz NOT NULL,
				"responded_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "FK_porter_requests_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_porter_requests_porter_id" FOREIGN KEY ("porter_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_porter_requests_requested_by" FOREIGN KEY ("requested_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_porter_requests_requested_role"
					CHECK ("requested_role" IN ('lead', 'support')),
				CONSTRAINT "CHK_porter_requests_note_not_blank"
					CHECK ("note" IS NULL OR length(btrim("note")) > 0)
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "UQ_porter_requests_pending_trip_porter"
			ON "porter_requests" ("trip_id", "porter_id")
			WHERE "status" = 'pending'
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_porter_requests_porter_status_expires"
			ON "porter_requests" ("porter_id", "status", "expires_at")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_porter_requests_porter_status_expires"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_porter_requests_pending_trip_porter"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "porter_requests"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "porter_request_status"`);
	}
}
