import type { DataSource } from "typeorm";
import dataSource from "../shared/database/data-source";

/** Populate the main local account without replacing health notes entered through the app. */
export async function seedCamperHealthProfile(ds: DataSource = dataSource): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("Health profile seed is development-only");
	}
	if (!ds.isInitialized) await ds.initialize();
	await ds.transaction(async (manager) => {
		const [camper]: Array<{ id: string }> = await manager.query(
			"SELECT id FROM users WHERE email = $1 AND role = 'camper' AND status = 'active'",
			["camper@ctms.local"]
		);
		if (!camper) throw new Error("Không tìm thấy tài khoản camper@ctms.local đang hoạt động.");
		const activity = JSON.stringify({
			comfortableDistanceKm: 8,
			comfortableWalkingMinutes: 180,
			activityNotes: null,
			confirmedAt: new Date().toISOString(),
		});
		await manager.query(
			`INSERT INTO health_profiles
			 (user_id, blood_type, physical_fitness_level, activity_profile,
			  emergency_notes, medical_conditions,
			  is_consent_granted, consent_granted_at)
			 VALUES ($1, 'O+', 'INTERMEDIATE', $2::jsonb,
			  'Có tiền sử hạ đường huyết nhẹ khi vận động cường độ cao liên tục',
			  '[]'::jsonb, true, now())
			 ON CONFLICT (user_id) DO UPDATE SET
			 blood_type = EXCLUDED.blood_type,
			 physical_fitness_level = EXCLUDED.physical_fitness_level,
			 activity_profile = EXCLUDED.activity_profile,
			 emergency_notes = EXCLUDED.emergency_notes,
			 version = health_profiles.version + 1, updated_at = now()
			 WHERE health_profiles.activity_profile IS NULL
			 AND health_profiles.blood_type = 'UNKNOWN'
			 AND health_profiles.physical_fitness_level = 'BEGINNER'
			 AND health_profiles.dietary_restrictions IS NULL
			 AND health_profiles.emergency_notes IS NULL
			 AND health_profiles.allergies = '[]'::jsonb
			 AND health_profiles.medical_conditions = '[]'::jsonb`,
			[camper.id, activity]
		);
		// Supply only missing activity facts, retaining existing health notes.
		await manager.query(
			`UPDATE health_profiles SET
			 activity_profile = COALESCE(activity_profile, $2::jsonb),
			 version = version + 1, updated_at = now()
			 WHERE user_id = $1 AND activity_profile IS NULL`,
			[camper.id, activity]
		);
	});
	console.log("Đã bổ sung hồ sơ sức khỏe cho camper@ctms.local.");
}

if (require.main === module) {
	seedCamperHealthProfile()
		.catch((error: unknown) => {
			console.error(error);
			process.exitCode = 1;
		})
		.finally(async () => {
			if (dataSource.isInitialized) await dataSource.destroy();
		});
}
