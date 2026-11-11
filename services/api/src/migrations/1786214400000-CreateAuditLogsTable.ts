import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogsTable1786214400000 implements MigrationInterface {
	name = "CreateAuditLogsTable1786214400000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "audit_logs" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"actor_id" uuid,
				"action" varchar(80) NOT NULL,
				"target_type" varchar(80) NOT NULL,
				"target_id" uuid NOT NULL,
				"before" jsonb,
				"after" jsonb,
				"reason" varchar(255),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_audit_logs_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users" ("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_audit_logs_target" ON "audit_logs" ("target_type", "target_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_audit_logs_target"`);
		await queryRunner.query(`DROP TABLE "audit_logs"`);
	}
}
