import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRejectionReasonToCampsites1786910000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "campsites" ADD COLUMN "rejection_reason" text`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "campsites" DROP COLUMN "rejection_reason"`);
	}
}
