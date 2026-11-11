import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingCancellationMetadata1787150000000 implements MigrationInterface {
	name = "AddBookingCancellationMetadata1787150000000";

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "bookings"
			ADD COLUMN "cancelled_at" timestamptz,
			ADD COLUMN "cancellation_reason" varchar(255)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "bookings"
			DROP COLUMN "cancellation_reason", DROP COLUMN "cancelled_at"`);
	}
}
