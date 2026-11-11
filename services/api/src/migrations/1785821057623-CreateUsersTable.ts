import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1785821057623 implements MigrationInterface {
	name = "CreateUsersTable1785821057623";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('camper', 'host', 'porter')`);
		await queryRunner.query(
			`CREATE TYPE "users_status_enum" AS ENUM ('pending_verification', 'active', 'suspended', 'deleted')`
		);
		await queryRunner.query(`
			CREATE TABLE "users" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"email" varchar(254),
				"phone" varchar(16),
				"password_hash" varchar NOT NULL,
				"role" "users_role_enum" NOT NULL,
				"status" "users_status_enum" NOT NULL DEFAULT 'pending_verification',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_users_email" UNIQUE ("email"),
				CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`DROP TYPE "users_status_enum"`);
		await queryRunner.query(`DROP TYPE "users_role_enum"`);
	}
}
