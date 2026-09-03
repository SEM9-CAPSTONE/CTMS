import { hash } from "bcrypt";
import dataSource from "../shared/database/data-source";

const BCRYPT_COST_FACTOR = 10;

async function seedWeatherRiskScenarios(): Promise<void> {
	await dataSource.initialize();
	console.log("[seed:weather-scenarios] Database initialized.");

	try {
		// 1. Host User
		const hostEmail = "host@ctms.local";
		const hostPhone = "0900000002";
		const hostPassword = "Host@123";

		const existingUser: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[hostEmail, hostPhone]
		);

		let hostId = "";
		if (existingUser.length > 0) {
			hostId = existingUser[0].id;
		} else {
			const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
			const insertedUser: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
				 VALUES ($1, $2, $3, 'host', 'active', 'Host Ban Mai')
				 RETURNING id`,
				[hostEmail, hostPhone, passwordHash]
			);
			hostId = insertedUser[0].id;
			await dataSource.query(
				`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'host') ON CONFLICT DO NOTHING`,
				[hostId]
			);
		}

		// 2. Campsite
		const campsiteName = "Khu cắm trại Ban Mai";
		const existingCampsite: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "campsites" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, campsiteName]
		);

		let campsiteId = "";
		if (existingCampsite.length > 0) {
			campsiteId = existingCampsite[0].id;
		} else {
			const insertedCampsite: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "campsites" (host_id, name, description, location, province, policies, operating_hours, status)
				 VALUES ($1, $2, 'Khu cắm trại sinh thái tuyệt vời gần núi', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography, 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'active')
				 RETURNING id`,
				[hostId, campsiteName]
			);
			campsiteId = insertedCampsite[0].id;
		}

		// 2.5 Ensure a weather_risk_rule exists
		const existingRules: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "weather_risk_rules" ORDER BY "created_at" DESC LIMIT 1'
		);
		let ruleVersionId = "";
		if (existingRules.length > 0) {
			ruleVersionId = existingRules[0].id;
		} else {
			const insertedRule: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "weather_risk_rules" (version, name, config, status, created_by)
				 VALUES ('v1.0', 'Default Risk Rule', '{}'::jsonb, 'active', $1)
				 RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		// 3. Scenario 1: GREEN Risk Route (Allowed)
		const greenRouteName = "Cung Đường An Toàn (Mức Xanh)";
		const existingGreenRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "campsite_id" = $1 AND "name" = $2',
			[campsiteId, greenRouteName]
		);

		let greenRouteId = "";
		if (existingGreenRoute.length > 0) {
			greenRouteId = existingGreenRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (campsite_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến trekking thời tiết đẹp, đủ điều kiện an toàn đăng ký', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2000, 'easy', 120, 'active')
				 RETURNING id`,
				[campsiteId, greenRouteName]
			);
			greenRouteId = res[0].id;
		}

		// Insert Snapshot & Assessment for Green
		const greenSnapshot: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
			 VALUES ($1, 'success', NOW(), 0, 10, 24, 10000, false)
			 RETURNING id`,
			[greenRouteId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
			 VALUES ($1, $2, $3, 'green', 0.00, $4, $5)`,
			[
				greenRouteId,
				greenSnapshot[0].id,
				ruleVersionId,
				JSON.stringify({
					rainfall: { value: 0, level: "green", weight: 0.3, score: 0 },
					wind: { value: 10, level: "green", weight: 0.25, score: 0 },
					temperature: { value: 24, level: "green", weight: 0.15, score: 0 },
					visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
					thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
				}),
				hostId,
			]
		);

		// 4. Scenario 2: RED Risk Route (Blocked)
		const redRouteName = "Cung Đường Bão Nguy Hiểm (Mức Đỏ)";
		const existingRedRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "campsite_id" = $1 AND "name" = $2',
			[campsiteId, redRouteName]
		);

		let redRouteId = "";
		if (existingRedRoute.length > 0) {
			redRouteId = existingRedRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (campsite_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến đường rủi ro thời tiết MỨC ĐỎ - Tạm dừng nhận đăng ký mới', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.48 11.96)'), 3500, 'hard', 240, 'active')
				 RETURNING id`,
				[campsiteId, redRouteName]
			);
			redRouteId = res[0].id;
		}

		// Insert Snapshot & Assessment for Red
		const redSnapshot: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
			 VALUES ($1, 'success', NOW(), 85.5, 75.0, 4.0, 500, true)
			 RETURNING id`,
			[redRouteId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
			 VALUES ($1, $2, $3, 'red', 1.50, $4, $5)`,
			[
				redRouteId,
				redSnapshot[0].id,
				ruleVersionId,
				JSON.stringify({
					rainfall: { value: 85.5, level: "red", weight: 0.3, score: 2 },
					wind: { value: 75.0, level: "red", weight: 0.25, score: 2 },
					temperature: { value: 4.0, level: "red", weight: 0.15, score: 2 },
					visibility: { value: 500, level: "red", weight: 0.15, score: 2 },
					thunderstorm: { value: true, level: "red", weight: 0.15, score: 2 },
				}),
				hostId,
			]
		);

		console.log("\n========================================================");
		console.log(" [seed:weather-scenarios] SUCCESS!");
		console.log(" - Host Login: host@ctms.local / Host@123");
		console.log(` - Scenario 1 (Green / Allowed Route ID): ${greenRouteId}`);
		console.log(` - Scenario 2 (Red / Blocked Route ID): ${redRouteId}`);
		console.log("========================================================\n");
	} catch (error) {
		console.error("[seed:weather-scenarios] Error seeding data:", error);
	} finally {
		await dataSource.destroy();
	}
}

seedWeatherRiskScenarios().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
