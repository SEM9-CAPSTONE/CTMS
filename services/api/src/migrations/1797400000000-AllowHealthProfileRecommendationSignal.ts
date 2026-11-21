import type { MigrationInterface, QueryRunner } from "typeorm";

export class AllowHealthProfileRecommendationSignal1797400000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "trip_recommendation_runs"
			DROP CONSTRAINT "CHK_trip_recommendation_runs_signal",
			ADD CONSTRAINT "CHK_trip_recommendation_runs_signal"
			CHECK ("signal_type" IN ('preferences', 'history', 'preferences_and_history', 'health_profile'))`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		const rows: Array<{ count: number }> = await queryRunner.query(
			`SELECT count(*)::int AS count FROM "trip_recommendation_runs" WHERE "signal_type" = 'health_profile'`
		);
		if (rows[0].count > 0) {
			throw new Error(
				"Cannot remove health-profile signal support: preserve recommendation history."
			);
		}
		await queryRunner.query(`ALTER TABLE "trip_recommendation_runs"
			DROP CONSTRAINT "CHK_trip_recommendation_runs_signal",
			ADD CONSTRAINT "CHK_trip_recommendation_runs_signal"
			CHECK ("signal_type" IN ('preferences', 'history', 'preferences_and_history'))`);
	}
}
