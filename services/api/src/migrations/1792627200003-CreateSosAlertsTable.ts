import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-074, CTMS-077, CTMS-080.
 * SOS Alerts table to store emergency alerts, accidental cancellation metadata,
 * and responder lifecycle status.
 */
export class CreateSosAlertsTable1792627200003 implements MigrationInterface {
	name = "CreateSosAlertsTable1792627200003";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$ BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sos_status') THEN
					CREATE TYPE "sos_status" AS ENUM ('active', 'acknowledged', 'cancelled', 'closed');
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			DO $$ BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_type') THEN
					CREATE TYPE "emergency_type" AS ENUM ('medical', 'injury', 'lost', 'natural_hazard', 'other');
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE "sos_alerts" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"sender_id" uuid NOT NULL,
				"emergency_type" "emergency_type" NOT NULL,
				"location" geography(Point, 4326),
				"battery_level" smallint,
				"event_time" timestamptz NOT NULL,
				"status" "sos_status" NOT NULL DEFAULT 'active',
				"cancelled_by" uuid,
				"cancelled_at" timestamptz,
				"cancellation_reason" varchar(500),
				"acknowledged_by" uuid,
				"acknowledged_at" timestamptz,
				"closed_by" uuid,
				"closed_at" timestamptz,
				"resolution_note" varchar(500),
				"received_at" timestamptz NOT NULL DEFAULT now(),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_sos_alerts_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_sos_alerts_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_sos_alerts_sender_id" FOREIGN KEY ("sender_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_sos_alerts_cancelled_by" FOREIGN KEY ("cancelled_by")
					REFERENCES "users" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_sos_alerts_acknowledged_by" FOREIGN KEY ("acknowledged_by")
					REFERENCES "users" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_sos_alerts_closed_by" FOREIGN KEY ("closed_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_sos_alerts_trip_status" ON "sos_alerts" ("trip_id", "status")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_sos_alerts_sender_created" ON "sos_alerts" ("sender_id", "created_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sos_alerts_sender_created"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sos_alerts_trip_status"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "sos_alerts"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "emergency_type"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "sos_status"`);
	}
}
