import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddGlobalPorterLevelToProfiles1797700000000 implements MigrationInterface {
	name = "AddGlobalPorterLevelToProfiles1797700000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE porter_profiles
			ADD COLUMN IF NOT EXISTS porter_level porter_route_proficiency NOT NULL DEFAULT 'learning',
			ADD COLUMN IF NOT EXISTS level_verified_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
			ADD COLUMN IF NOT EXISTS level_verified_at timestamptz NULL
		`);

		// Seed default global level policy thresholds if policies exist or insert if empty
		await queryRunner.query(`
			DO $$
			DECLARE
				admin_id uuid;
			BEGIN
				SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
				IF admin_id IS NOT NULL THEN
					INSERT INTO porter_level_policies (level, definition, version, updated_by)
					VALUES
						(
							'learning',
							'{
								"name": "Học việc",
								"minExperienceYears": 0,
								"minTimesLed": 0,
								"minCompletedTrips": 0,
								"minTotalKm": 0,
								"minAverageRating": null,
								"requiredSkills": ["Giao tiếp & Ứng xử với khách cắm trại"],
								"requiredCertifications": [],
								"responsibilities": "Hỗ trợ hậu cần, mang vác trang thiết bị và đi kèm đoàn dưới sự hướng dẫn của Người hỗ trợ cấp Thành thạo hoặc Chuyên gia."
							}'::jsonb,
							1,
							admin_id
						),
						(
							'proficient',
							'{
								"name": "Thành thạo",
								"minExperienceYears": 1,
								"minTimesLed": 10,
								"minCompletedTrips": 10,
								"minTotalKm": 100,
								"minAverageRating": 4.2,
								"requiredSkills": ["Dẫn đường & Định vị GPS/Bản đồ địa hình", "Xử lý sự cố y tế & Sơ cứu khẩn cấp dã ngoại"],
								"requiredCertifications": ["wfa"],
								"responsibilities": "Đủ năng lực dẫn đoàn chính các chuyến trong ngày, hỗ trợ khóa đuôi các chuyến qua đêm và xử lý sơ cứu ban đầu trên tuyến."
							}'::jsonb,
							1,
							admin_id
						),
						(
							'expert',
							'{
								"name": "Chuyên gia",
								"minExperienceYears": 3,
								"minTimesLed": 30,
								"minCompletedTrips": 30,
								"minTotalKm": 300,
								"minAverageRating": 4.6,
								"requiredSkills": ["Dẫn đường & Định vị GPS/Bản đồ địa hình", "Quản lý an toàn đoàn & Đánh giá rủi ro thời tiết", "Xử lý sự cố y tế & Sơ cứu khẩn cấp dã ngoại", "Kỹ thuật vượt suối, dốc đứng & dây thừng"],
								"requiredCertifications": ["wfa", "rescue", "guide_card"],
								"responsibilities": "Dẫn đoàn chính mọi tuyến khó và chuyến qua đêm dài ngày, chịu trách nhiệm an toàn hiện trường, ứng phó sự cố khẩn cấp và kèm cặp Người hỗ trợ Học việc."
							}'::jsonb,
							1,
							admin_id
						)
					ON CONFLICT (level) DO UPDATE
					SET definition = porter_level_policies.definition || jsonb_build_object(
						'minCompletedTrips', COALESCE((porter_level_policies.definition->>'minCompletedTrips')::int, (EXCLUDED.definition->>'minCompletedTrips')::int),
						'minTotalKm', COALESCE((porter_level_policies.definition->>'minTotalKm')::numeric, (EXCLUDED.definition->>'minTotalKm')::numeric),
						'minAverageRating', COALESCE((porter_level_policies.definition->>'minAverageRating')::numeric, (EXCLUDED.definition->>'minAverageRating')::numeric)
					);
				END IF;
			END $$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE porter_profiles
			DROP COLUMN IF EXISTS level_verified_at,
			DROP COLUMN IF EXISTS level_verified_by,
			DROP COLUMN IF EXISTS porter_level
		`);
	}
}
