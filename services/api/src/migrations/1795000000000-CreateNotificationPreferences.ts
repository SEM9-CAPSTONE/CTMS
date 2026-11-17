import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationPreferences1795000000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE notification_preference_versions (
			user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
		)`);
		await queryRunner.query(`CREATE TABLE notification_preferences (
			user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			category varchar(40) NOT NULL CHECK (category IN ('booking','porter_assignment','weather')),
			enabled boolean NOT NULL,
			PRIMARY KEY (user_id, category)
		)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE notification_preferences");
		await queryRunner.query("DROP TABLE notification_preference_versions");
	}
}
