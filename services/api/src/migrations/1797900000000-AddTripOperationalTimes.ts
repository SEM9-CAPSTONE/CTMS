import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTripOperationalTimes1797900000000 implements MigrationInterface {
	name = "AddTripOperationalTimes1797900000000";

	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE trips
		 ADD COLUMN actual_started_at timestamptz,
		 ADD COLUMN actual_ended_at timestamptz,
		 ADD COLUMN started_by_id uuid REFERENCES users(id) ON DELETE RESTRICT,
		 ADD COLUMN ended_by_id uuid REFERENCES users(id) ON DELETE RESTRICT,
		 ADD CONSTRAINT trip_operational_times_order CHECK (
		  actual_ended_at IS NULL OR actual_started_at IS NULL OR actual_ended_at >= actual_started_at)`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE trips DROP CONSTRAINT trip_operational_times_order,
		 DROP COLUMN ended_by_id, DROP COLUMN started_by_id,
		 DROP COLUMN actual_ended_at, DROP COLUMN actual_started_at`);
	}
}
