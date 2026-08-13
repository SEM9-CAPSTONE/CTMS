import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserRolesTable1786500000000 implements MigrationInterface {
	name = "CreateUserRolesTable1786500000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "user_roles" (
				"user_id" uuid NOT NULL,
				"role" "users_role_enum" NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_user_roles_user_id_role" PRIMARY KEY ("user_id", "role"),
				CONSTRAINT "FK_user_roles_user_id_users_id" FOREIGN KEY ("user_id")
					REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(`
			INSERT INTO "user_roles" ("user_id", "role", "created_at")
			SELECT "id", "role", "created_at"
			FROM "users"
			ON CONFLICT ("user_id", "role") DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "user_roles"`);
	}
}
