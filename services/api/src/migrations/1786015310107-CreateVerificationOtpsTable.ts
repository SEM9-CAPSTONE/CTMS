import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVerificationOtpsTable1786015310107 implements MigrationInterface {
	name = "CreateVerificationOtpsTable1786015310107";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "verification_otps" (
				"user_id" uuid NOT NULL,
				"code_hash" varchar NOT NULL,
				"expires_at" timestamptz NOT NULL,
				"send_count" integer NOT NULL DEFAULT 1,
				"window_started_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_verification_otps_user_id" PRIMARY KEY ("user_id"),
				CONSTRAINT "FK_verification_otps_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "verification_otps"`);
	}
}
