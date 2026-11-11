import type { MigrationInterface, QueryRunner } from "typeorm";

export class IndexIncidentSafetyLocation1793270000001 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(
			"CREATE INDEX idx_trip_incident_safety_location ON trip_incidents USING GIST (location) WHERE location IS NOT NULL"
		);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query("DROP INDEX idx_trip_incident_safety_location");
	}
}
