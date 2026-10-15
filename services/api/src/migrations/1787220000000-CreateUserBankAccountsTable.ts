import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserBankAccountsTable1787220000000 implements MigrationInterface {
	name = "CreateUserBankAccountsTable1787220000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "user_bank_accounts" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL,
				"bank_name" varchar(100) NOT NULL,
				"account_number" varchar(50) NOT NULL,
				"account_holder_name" varchar(100) NOT NULL,
				"is_default" boolean NOT NULL DEFAULT false,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_user_bank_accounts_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_user_bank_accounts_user_id" FOREIGN KEY ("user_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_user_bank_accounts_user_bank_acc" UNIQUE ("user_id", "bank_name", "account_number")
			);
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_user_bank_accounts_user_id" ON "user_bank_accounts" ("user_id");
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_bank_accounts_user_id";`);
		await queryRunner.query(`DROP TABLE IF EXISTS "user_bank_accounts";`);
	}
}
