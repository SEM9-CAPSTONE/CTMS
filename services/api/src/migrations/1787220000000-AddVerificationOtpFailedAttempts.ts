import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationOtpFailedAttempts1787220000000 implements MigrationInterface {
	name = "AddVerificationOtpFailedAttempts1787220000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "verification_otps"
			ADD COLUMN "failed_attempts" integer NOT NULL DEFAULT 0,
			ADD CONSTRAINT "CHK_verification_otps_failed_attempts_non_negative" CHECK ("failed_attempts" >= 0)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "verification_otps"
			DROP CONSTRAINT "CHK_verification_otps_failed_attempts_non_negative",
			DROP COLUMN "failed_attempts"
		`);
	}
}
