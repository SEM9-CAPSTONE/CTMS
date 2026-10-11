import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingCompletedAt1787190000000 implements MigrationInterface {
	name = "AddBookingCompletedAt1787190000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "completed_at"`);
	}
}
