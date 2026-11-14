import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-106 follow-up. Keeps the "Số năm kinh nghiệm" and "Kinh nghiệm trekking" fields of the
 * Camper profile, which the profile form already collects but never saved. Both are optional and
 * existing accounts start empty. Same limits as the profile form.
 */
export class AddCamperExperience1796100000000 implements MigrationInterface {
	name = "AddCamperExperience1796100000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "users"
				ADD COLUMN "camping_experience_years" smallint,
				ADD COLUMN "trekking_experience_details" varchar(300),
				ADD CONSTRAINT "CHK_users_camping_experience_years"
					CHECK ("camping_experience_years" IS NULL OR "camping_experience_years" BETWEEN 0 AND 50)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "users"
				DROP CONSTRAINT "CHK_users_camping_experience_years",
				DROP COLUMN "trekking_experience_details",
				DROP COLUMN "camping_experience_years"
		`);
	}
}
