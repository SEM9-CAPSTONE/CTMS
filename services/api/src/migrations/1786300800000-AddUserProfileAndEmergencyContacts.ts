import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileAndEmergencyContacts1786300800000 implements MigrationInterface {
	name = "AddUserProfileAndEmergencyContacts1786300800000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TYPE "users_gender_enum" AS ENUM ('male', 'female', 'other')`);
		await queryRunner.query(`
			ALTER TABLE "users"
			ADD COLUMN "full_name" varchar(50),
			ADD COLUMN "date_of_birth" date,
			ADD COLUMN "gender" "users_gender_enum",
			ADD COLUMN "address" varchar(200),
			ADD COLUMN "bio" varchar(500)
		`);
		await queryRunner.query(`
			CREATE TABLE "emergency_contacts" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL,
				"name" varchar(80) NOT NULL,
				"relationship" varchar(40) NOT NULL,
				"phone" varchar(16) NOT NULL,
				"email" varchar(254),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_emergency_contacts_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_emergency_contacts_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_emergency_contacts_user_id" ON "emergency_contacts" ("user_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_emergency_contacts_user_id"`);
		await queryRunner.query(`DROP TABLE "emergency_contacts"`);
		await queryRunner.query(`
			ALTER TABLE "users"
			DROP COLUMN "bio",
			DROP COLUMN "address",
			DROP COLUMN "gender",
			DROP COLUMN "date_of_birth",
			DROP COLUMN "full_name"
		`);
		await queryRunner.query(`DROP TYPE "users_gender_enum"`);
	}
}
