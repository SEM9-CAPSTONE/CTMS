import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterVerifications1787250000000 implements MigrationInterface {
	name = "CreatePorterVerifications1787250000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "porter_verification_status" AS ENUM ('pending_documents', 'pending_review', 'approved', 'rejected')`
		);
		await queryRunner.query(`
			CREATE TABLE "porter_verifications" (
				"porter_id" uuid NOT NULL,
				"status" "porter_verification_status" NOT NULL DEFAULT 'pending_documents',
				"submitted_at" timestamptz,
				"reviewed_by" uuid,
				"reviewed_at" timestamptz,
				"rejection_reason" varchar(500),
				"version" integer NOT NULL DEFAULT 1,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_porter_verifications_porter_id" PRIMARY KEY ("porter_id"),
				CONSTRAINT "FK_porter_verifications_porter_id" FOREIGN KEY ("porter_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_porter_verifications_reviewed_by" FOREIGN KEY ("reviewed_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_porter_verifications_version" CHECK ("version" >= 1),
				CONSTRAINT "CHK_porter_verifications_review_time" CHECK (
					("status" IN ('approved', 'rejected')) = ("reviewed_at" IS NOT NULL)
				),
				CONSTRAINT "CHK_porter_verifications_rejection_reason" CHECK (
					("status" = 'rejected') = ("rejection_reason" IS NOT NULL)
				)
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_porter_verifications_status_submitted_at"
			ON "porter_verifications" ("status", "submitted_at")
		`);
		await queryRunner.query(`
			CREATE TABLE "porter_verification_documents" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"porter_id" uuid NOT NULL,
				"file_url" varchar(1000) NOT NULL,
				"file_key" varchar(500),
				"original_name" varchar(255) NOT NULL,
				"mime_type" varchar(100) NOT NULL,
				"size_bytes" integer NOT NULL,
				"uploaded_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_porter_verification_documents_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_porter_verification_documents_porter_id" FOREIGN KEY ("porter_id")
					REFERENCES "porter_verifications" ("porter_id") ON DELETE CASCADE,
				CONSTRAINT "CHK_porter_verification_documents_size" CHECK ("size_bytes" > 0)
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_porter_verification_documents_porter_id"
			ON "porter_verification_documents" ("porter_id", "uploaded_at")
		`);
		// Porters that already exist were onboarded before document review existed;
		// keep them operational. reviewed_by stays NULL to mark the system backfill.
		await queryRunner.query(`
			INSERT INTO "porter_verifications" ("porter_id", "status", "reviewed_at")
			SELECT u."id", 'approved', now()
			FROM "users" u
			WHERE EXISTS (
				SELECT 1 FROM "user_roles" r WHERE r."user_id" = u."id" AND r."role" = 'porter'
			)
			OR (
				NOT EXISTS (SELECT 1 FROM "user_roles" r WHERE r."user_id" = u."id")
				AND u."role" = 'porter'
			)
			ON CONFLICT DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "porter_verification_documents"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "porter_verifications"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "porter_verification_status"`);
	}
}
