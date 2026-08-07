import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshTokensTable1786041271406 implements MigrationInterface {
	name = "CreateRefreshTokensTable1786041271406";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "refresh_tokens" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL,
				"token_hash" varchar NOT NULL,
				"expires_at" timestamptz NOT NULL,
				"revoked_at" timestamptz,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
			)
		`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_token_hash"`);
		await queryRunner.query(`DROP TABLE "refresh_tokens"`);
	}
}
