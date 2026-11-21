import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Weather auto-cancel at T-6h (leader decision, 2026-11-12): the system may now record a weather
 * decision itself (`decider_role = 'system'`, `decided_by` NULL) and tell the Host and Admins with
 * an `auto_cancelled` reminder.
 */
export class AllowSystemWeatherAutoCancel1795300000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE "trip_weather_decisions"
			DROP CONSTRAINT "CHK_trip_weather_decisions_role",
			ADD CONSTRAINT "CHK_trip_weather_decisions_role"
				CHECK ("decider_role" IN ('host', 'admin', 'system')),
			ADD CONSTRAINT "CHK_trip_weather_decisions_system"
				CHECK ("decider_role" <> 'system' OR ("decided_by" IS NULL AND "decision" = 'cancel'))`);
		await q.query(`ALTER TABLE "trip_weather_decision_alerts"
			DROP CONSTRAINT "CHK_trip_weather_decision_alerts_milestone",
			ADD CONSTRAINT "CHK_trip_weather_decision_alerts_milestone"
				CHECK ("milestone" IN ('host_t48', 'admin_t24', 'admin_t12', 'admin_t6', 'admin_kept', 'auto_cancelled'))`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(
			`DELETE FROM "trip_weather_decision_alerts" WHERE "milestone" = 'auto_cancelled'`
		);
		await q.query(`DELETE FROM "trip_weather_decisions" WHERE "decider_role" = 'system'`);
		await q.query(`ALTER TABLE "trip_weather_decision_alerts"
			DROP CONSTRAINT "CHK_trip_weather_decision_alerts_milestone",
			ADD CONSTRAINT "CHK_trip_weather_decision_alerts_milestone"
				CHECK ("milestone" IN ('host_t48', 'admin_t24', 'admin_t12', 'admin_t6', 'admin_kept'))`);
		await q.query(`ALTER TABLE "trip_weather_decisions"
			DROP CONSTRAINT "CHK_trip_weather_decisions_system",
			DROP CONSTRAINT "CHK_trip_weather_decisions_role",
			ADD CONSTRAINT "CHK_trip_weather_decisions_role" CHECK ("decider_role" IN ('host', 'admin'))`);
	}
}
