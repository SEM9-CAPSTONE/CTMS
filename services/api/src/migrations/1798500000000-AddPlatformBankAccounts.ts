import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bank accounts the platform receives money on, managed by Admins. One row per purpose; the only
 * purpose today is `weather_penalty`: where Hosts transfer a weather penalty the settlements did
 * not cover (policy §6).
 */
export class AddPlatformBankAccounts1798500000000 implements MigrationInterface {
	name = "AddPlatformBankAccounts1798500000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
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

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "platform_bank_accounts"`);
	}
}
