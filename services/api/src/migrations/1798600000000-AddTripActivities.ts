import type { MigrationInterface, QueryRunner } from "typeorm";
export class AddTripActivities1798600000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE trips ADD COLUMN activities text[] NOT NULL DEFAULT '{}'`);
		await runner.query(
			`ALTER TABLE camper_trip_preferences ADD COLUMN activities text[] NOT NULL DEFAULT '{}'`
		);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query("ALTER TABLE camper_trip_preferences DROP COLUMN activities");
		await runner.query("ALTER TABLE trips DROP COLUMN activities");
	}
}
