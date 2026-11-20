import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddHealthActivityProfile1797500000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		// Existing profiles remain unknown until their owners supply and confirm their activity facts.
		await runner.query('ALTER TABLE "health_profiles" ADD COLUMN "activity_profile" jsonb');
	}
	async down(runner: QueryRunner): Promise<void> {
		const rows: Array<{ count: number }> = await runner.query(
			'SELECT count(*)::int AS count FROM "health_profiles" WHERE "activity_profile" IS NOT NULL'
		);
		if (rows[0].count > 0)
			throw new Error(
				"Cannot remove activity profiles: preserve user-provided health information."
			);
		await runner.query('ALTER TABLE "health_profiles" DROP COLUMN "activity_profile"');
	}
}
