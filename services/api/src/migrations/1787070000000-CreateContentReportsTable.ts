import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateContentReportsTable1787070000000 implements MigrationInterface {
	name = "CreateContentReportsTable1787070000000";

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "content_reports_status_enum" AS ENUM ('pending', 'reviewing', 'actioned', 'rejected')`
		);
		await queryRunner.query(`
			CREATE TABLE "content_reports" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"reporter_id" uuid NOT NULL,
				"target_type" varchar(100) NOT NULL,
				"target_id" uuid NOT NULL,
				"reason" varchar(1000) NOT NULL,
				"status" "content_reports_status_enum" NOT NULL DEFAULT 'pending',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_content_reports_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_content_reports_reporter_id" FOREIGN KEY ("reporter_id") REFERENCES "users" ("id"),
				CONSTRAINT "CHK_content_reports_target_type" CHECK ("target_type" <> '' AND "target_type" !~ '^[[:space:]]|[[:space:]]$'),
				CONSTRAINT "CHK_content_reports_reason" CHECK ("reason" <> '' AND "reason" !~ '^[[:space:]]|[[:space:]]$')
			)
		`);
		// T01 reads/locks by primary key only; no speculative list/target indexes.
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "content_reports"`);
		await queryRunner.query(`DROP TYPE "content_reports_status_enum"`);
	}
}
