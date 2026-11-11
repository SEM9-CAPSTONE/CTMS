import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRejectedTripStatus1787180000000 implements MigrationInterface {
	name = "AddRejectedTripStatus1787180000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TYPE "trip_status" ADD VALUE IF NOT EXISTS 'rejected'`);
	}

	public async down(): Promise<void> {
		// PostgreSQL cannot safely remove enum values while rows may reference them.
	}
}
