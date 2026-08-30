import { hash } from "bcrypt";
import dataSource from "../shared/database/data-source";

const BCRYPT_COST_FACTOR = 10;

async function seedDevHostAndRoute(): Promise<void> {
	await dataSource.initialize();
	console.log("[seed:dev-host] Database initialized.");

	try {
		// 1. Create Host user
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
			console.log(`[seed:dev-host] Host already exists with ID: ${hostId}`);
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
			console.log(`[seed:dev-host] Created Host user with ID: ${hostId}`);
		}

		// 2. Create Campsite
		const campsiteName = "Khu cắm trại Ban Mai";
		const existingCampsite: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "campsites" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, campsiteName]
		);

		let campsiteId = "";
		if (existingCampsite.length > 0) {
			campsiteId = existingCampsite[0].id;
			console.log(`[seed:dev-host] Campsite already exists with ID: ${campsiteId}`);
		} else {
			const insertedCampsite: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "campsites" (host_id, name, description, location, province, policies, operating_hours, status)
				 VALUES ($1, $2, 'Khu cắm trại sinh thái tuyệt vời gần núi', ST_SetSRID(ST_MakePoint(108.45, 11.94), 4326)::geography, 'Lam Dong', '{}'::jsonb, '{}'::jsonb, 'active')
				 RETURNING id`,
				[hostId, campsiteName]
			);
			campsiteId = insertedCampsite[0].id;
			console.log(`[seed:dev-host] Created Campsite with ID: ${campsiteId}`);
		}

		// 3. Create active Trekking Route
		const routeName = "Đỉnh Núi Bidoup Trail";
		const existingRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "campsite_id" = $1 AND "name" = $2',
			[campsiteId, routeName]
		);

		if (existingRoute.length > 0) {
			console.log(`[seed:dev-host] Route already exists with ID: ${existingRoute[0].id}`);
		} else {
			const insertedRoute: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (campsite_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Cung đường trekking chinh phục đỉnh núi Bidoup', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2500, 'moderate', 180, 'active')
				 RETURNING id`,
				[campsiteId, routeName]
			);
			console.log(`[seed:dev-host] Created active Trekking Route with ID: ${insertedRoute[0].id}`);
		}

		console.log("[seed:dev-host] Seeding completed successfully!");
	} catch (error) {
		console.error("[seed:dev-host] Error seeding data:", error);
	} finally {
		await dataSource.destroy();
	}
}

seedDevHostAndRoute().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
