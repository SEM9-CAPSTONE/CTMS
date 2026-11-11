import type { MigrationInterface, QueryRunner } from "typeorm";

export class DropCampsitesTables1786970000000 implements MigrationInterface {
	name = "DropCampsitesTables1786970000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "campsite_media" CASCADE`);
		await queryRunner.query(`DROP TABLE IF EXISTS "campsite_images" CASCADE`);
		await queryRunner.query(`DROP TABLE IF EXISTS "campsite_zones" CASCADE`);
		await queryRunner.query(`DROP TABLE IF EXISTS "zones" CASCADE`);
		await queryRunner.query(`DROP TABLE IF EXISTS "campsites" CASCADE`);
		await queryRunner.query(`DROP TYPE IF EXISTS "zone_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "zones_status_enum"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "campsite_status"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "campsites_status_enum"`);
	}

	public async down(): Promise<void> {
		// Campsite is intentionally retired from the current CTMS scope.
	}
}
