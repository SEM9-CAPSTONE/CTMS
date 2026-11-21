import type { MigrationInterface, QueryRunner } from "typeorm";

/** Admin-written name, description and severity for a potential safety hotspot. */
export class AddSafetyHotspotDetails1798200000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE "potential_safety_hotspots"
			ADD COLUMN "name" varchar(120),
			ADD COLUMN "description" varchar(1000),
			ADD COLUMN "severity" varchar(8),
			ADD CONSTRAINT "CHK_potential_safety_hotspots_severity"
				CHECK ("severity" IS NULL OR "severity" IN ('low', 'medium', 'high'))`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE "potential_safety_hotspots"
			DROP CONSTRAINT "CHK_potential_safety_hotspots_severity",
			DROP COLUMN "name", DROP COLUMN "description", DROP COLUMN "severity"`);
	}
}
