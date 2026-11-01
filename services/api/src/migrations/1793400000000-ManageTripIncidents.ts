import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-086. Manage Trip Incidents: adds handling states ('investigating', 'resolved', 'closed'),
 * assigned_to column on trip_incidents, and the incident_actions audit table.
 */
export class ManageTripIncidents1793400000000 implements MigrationInterface {
	name = "ManageTripIncidents1793400000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TYPE "incident_status" ADD VALUE IF NOT EXISTS 'investigating'`);
		await queryRunner.query(`ALTER TYPE "incident_status" ADD VALUE IF NOT EXISTS 'resolved'`);
		await queryRunner.query(`ALTER TYPE "incident_status" ADD VALUE IF NOT EXISTS 'closed'`);

		await queryRunner.query(`
			DO $$ BEGIN
				CREATE TYPE "incident_action_type" AS ENUM ('reported', 'assigned', 'status_changed', 'note_added');
			EXCEPTION
				WHEN duplicate_object THEN null;
			END $$;
		`);

		await queryRunner.query(`
			ALTER TABLE "trip_incidents"
			ADD COLUMN IF NOT EXISTS "assigned_to" uuid,
			ADD CONSTRAINT "FK_trip_incidents_assigned_to" FOREIGN KEY ("assigned_to")
				REFERENCES "users" ("id") ON DELETE SET NULL
		`);

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trip_incidents_assigned_to" ON "trip_incidents" ("assigned_to")`
		);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "incident_actions" (
				"id" uuid NOT NULL,
				"incident_id" uuid NOT NULL,
				"actor_id" uuid NOT NULL,
				"action" "incident_action_type" NOT NULL,
				"from_status" "incident_status",
				"to_status" "incident_status",
				"note" varchar(2000),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_incident_actions_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_incident_actions_incident_id" FOREIGN KEY ("incident_id")
					REFERENCES "trip_incidents" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_incident_actions_actor_id" FOREIGN KEY ("actor_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT
			)
		`);

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_incident_actions_incident_created_at" ON "incident_actions" ("incident_id", "created_at" ASC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_incident_actions_incident_created_at"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "incident_actions"`);
		await queryRunner.query(
			`ALTER TABLE "trip_incidents" DROP CONSTRAINT IF EXISTS "FK_trip_incidents_assigned_to"`
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_incidents_assigned_to"`);
		await queryRunner.query(`ALTER TABLE "trip_incidents" DROP COLUMN IF EXISTS "assigned_to"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "incident_action_type"`);
	}
}
