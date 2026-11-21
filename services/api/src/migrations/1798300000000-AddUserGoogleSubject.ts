import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Google account id (`sub` of a verified Google ID token) linked to a CTMS
 * account by "Đăng nhập bằng Google". Nullable: only set once the user has
 * signed in with Google; unique so one Google account maps to one CTMS account.
 */
export class AddUserGoogleSubject1798300000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`ALTER TABLE "users" ADD COLUMN "google_sub" varchar(255)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_users_google_sub" ON "users" ("google_sub") WHERE "google_sub" IS NOT NULL`
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP INDEX IF EXISTS "UQ_users_google_sub"`);
		await runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "google_sub"`);
	}
}
