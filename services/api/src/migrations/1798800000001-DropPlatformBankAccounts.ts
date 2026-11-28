import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hosts now pay unpaid weather penalties through PayOS and the payment is recorded automatically,
 * so the Admin-managed account Hosts used to transfer to (and confirm by hand) is no longer used.
 */
export class DropPlatformBankAccounts1798800000001 implements MigrationInterface {
	name = "DropPlatformBankAccounts1798800000001";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "platform_bank_accounts"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "platform_bank_accounts" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"purpose" varchar(30) NOT NULL,
				"bank_name" varchar(100) NOT NULL,
				"account_number" varchar(50) NOT NULL,
				"account_holder_name" varchar(100) NOT NULL,
				"updated_by" uuid,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_platform_bank_accounts" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_platform_bank_accounts_purpose" UNIQUE ("purpose"),
				CONSTRAINT "CHK_platform_bank_accounts_purpose" CHECK ("purpose" IN ('weather_penalty')),
				CONSTRAINT "FK_platform_bank_accounts_updated_by" FOREIGN KEY ("updated_by")
					REFERENCES "users"("id") ON DELETE SET NULL
			)
		`);
	}
}
