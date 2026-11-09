import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Penalty for a Host who did not answer a Red forecast before T-24h (policy §6, §7).
 *
 * One row per (Trip, schedule): the violation number in the last 90 days, the amount computed
 * from the paid booking value, how much was already deducted from settlements, the hosting block
 * and the force-majeure waiver request / Admin review.
 */
export class AddHostWeatherPenalties1794800000000 implements MigrationInterface {
	name = "AddHostWeatherPenalties1794800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "host_weather_penalties" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"trip_id" uuid NOT NULL,
				"host_id" uuid NOT NULL,
				"trip_title" varchar(150) NOT NULL,
				"trip_starts_at" timestamptz NOT NULL,
				"decision_id" uuid,
				"violation_number" int NOT NULL,
				"booking_value" numeric(12,2) NOT NULL,
				"rate_basis_points" int NOT NULL,
				"cap_amount" numeric(12,2) NOT NULL,
				"amount" numeric(12,2) NOT NULL,
				"deducted_amount" numeric(12,2) NOT NULL DEFAULT 0,
				"status" varchar(10) NOT NULL DEFAULT 'applied',
				"hosting_blocked_until" timestamptz,
				"waiver_deadline" timestamptz NOT NULL,
				"waiver_reason" varchar(1000),
				"waiver_evidence_urls" jsonb,
				"waiver_requested_at" timestamptz,
				"waiver_review_due_at" timestamptz,
				"waiver_decision" varchar(10),
				"waiver_reviewed_by" uuid,
				"waiver_reviewed_at" timestamptz,
				"waiver_review_note" varchar(1000),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_host_weather_penalties" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_host_weather_penalties_schedule" UNIQUE ("trip_id", "trip_starts_at"),
				CONSTRAINT "CHK_host_weather_penalties_status" CHECK ("status" IN ('applied', 'waived')),
				CONSTRAINT "CHK_host_weather_penalties_waiver_decision"
					CHECK ("waiver_decision" IS NULL OR "waiver_decision" IN ('approved', 'rejected')),
				CONSTRAINT "CHK_host_weather_penalties_amounts"
					CHECK ("amount" >= 0 AND "deducted_amount" >= 0 AND "deducted_amount" <= "amount"),
				CONSTRAINT "FK_host_weather_penalties_trip" FOREIGN KEY ("trip_id")
					REFERENCES "trips"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_host_weather_penalties_host" FOREIGN KEY ("host_id")
					REFERENCES "users"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_host_weather_penalties_decision" FOREIGN KEY ("decision_id")
					REFERENCES "trip_weather_decisions"("id") ON DELETE SET NULL,
				CONSTRAINT "FK_host_weather_penalties_reviewer" FOREIGN KEY ("waiver_reviewed_by")
					REFERENCES "users"("id") ON DELETE SET NULL
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_host_weather_penalties_host" ON "host_weather_penalties" ("host_id", "created_at" DESC)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "host_weather_penalties"`);
	}
}
