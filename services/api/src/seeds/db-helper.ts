import "dotenv/config";
import { randomInt } from "node:crypto";
import * as bcrypt from "bcrypt";
import dataSource from "../shared/database/data-source";

/**
 * The newer JSON-payload actions (create-account/seed-campsites/
 * clean-campsites) take their `arg` base64-encoded -- a raw JSON string on
 * the command line is fragile to shell-quote correctly cross-platform
 * (Windows vs POSIX), especially from execSync. Plain-string actions
 * (email, etc.) are unaffected and keep taking `arg` as-is.
 */
function parseJsonArg<T>(base64Arg: string): T {
	return JSON.parse(Buffer.from(base64Arg, "base64").toString("utf8")) as T;
}

function assertE2EEmail(email: string): void {
	if (!email.startsWith("e2e-")) {
		throw new Error(`Refusing to delete non-E2E user: ${email}`);
	}
}

async function main() {
	const action = process.argv[2];
	const arg = process.argv[3];

	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}

	try {
		if (action === "get-user") {
			const rows = await dataSource.query(
				'SELECT "id", "email", "phone", "status", "role" FROM "users" WHERE "email" = $1',
				[arg]
			);
			if (rows.length === 0) {
				console.log(JSON.stringify({ user: null, hasOtp: false }));
				return;
			}
			const user = rows[0];
			const otpRows = await dataSource.query(
				'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
				[user.id]
			);
			console.log(JSON.stringify({ user, hasOtp: otpRows.length > 0 }));
		} else if (action === "get-otp") {
			const rows = await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [arg]);
			if (rows.length === 0) {
				throw new Error(`User not found: ${arg}`);
			}
			const userId = rows[0].id;

			const ttlMinutes = 10;
			const windowMinutes = 1440;
			const maxAttempts = 5;

			const code = randomInt(100000, 1000000).toString();
			const codeHash = await bcrypt.hash(code, 10);
			const now = new Date();
			const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

			const existing = await dataSource.query(
				'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
				[userId]
			);

			let sendCount = 1;
			let windowStartedAt = now;

			if (existing.length > 0) {
				const ext = existing[0];
				const windowElapsed =
					now.getTime() - new Date(ext.window_started_at).getTime() > windowMinutes * 60_000;
				if (!windowElapsed) {
					if (ext.send_count >= maxAttempts) {
						throw new Error("OTP resend limit reached");
					}
					sendCount = ext.send_count + 1;
					windowStartedAt = new Date(ext.window_started_at);
				}
			}

			await dataSource.query(
				`INSERT INTO "verification_otps" (user_id, code_hash, expires_at, send_count, window_started_at)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (user_id) DO UPDATE 
				 SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, 
				     send_count = EXCLUDED.send_count, window_started_at = EXCLUDED.window_started_at`,
				[userId, codeHash, expiresAt, sendCount, windowStartedAt]
			);

			console.log(JSON.stringify({ otp: code }));
		} else if (action === "get-logs") {
			const logs = await dataSource.query(
				`SELECT "actor_id" AS "actorId", "action", "target_type" AS "targetType", 
				        "target_id" AS "targetId", "before", "after", "reason", "created_at" AS "createdAt"
				 FROM "audit_logs" 
				 WHERE "actor_id" = $1 OR "target_id" = $1
				 ORDER BY "created_at" ASC`,
				[arg]
			);
			console.log(JSON.stringify({ logs }));
		} else if (action === "get-seed-accounts") {
			const rows = await dataSource.query(
				`SELECT u.email, u.phone, u.status, u.role AS "primaryRole",
				        array_remove(array_agg(ur.role ORDER BY ur.role), NULL) AS roles
				 FROM "users" u
				 LEFT JOIN "user_roles" ur ON ur.user_id = u.id
				 WHERE u.email IN ('admin@ctms.local', 'host@ctms.local', 'porter@ctms.local')
				 GROUP BY u.id
				 ORDER BY u.email`
			);
			console.log(JSON.stringify({ accounts: rows }));
		} else if (action === "create-account") {
			// CTMS-17-T02 (CTMS-78). Generic account fixture, reusable beyond
			// this story: creates a user with an explicit role/status/password
			// so an E2E spec can log in as it via the real UI form (e.g. a
			// non-Camper account to prove Search Campsites' role gate end to
			// end). Mirrors dev-admin.seed.ts's hashing, not a shortcut.
			const input = parseJsonArg<{
				email: string;
				phone: string;
				password: string;
				role: "camper" | "host" | "porter" | "admin";
				status?: "pending_verification" | "active" | "suspended" | "deleted";
			}>(arg);
			const passwordHash = await bcrypt.hash(input.password, 10);
			const rows = await dataSource.query(
				`INSERT INTO "users" ("email", "phone", "password_hash", "role", "status")
				 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
				[input.email, input.phone, passwordHash, input.role, input.status ?? "active"]
			);
			const userId = rows[0].id;
			await dataSource.query(
				`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
				[userId, input.role]
			);
			console.log(JSON.stringify({ id: userId }));
		} else if (action === "seed-campsites") {
			// CTMS-17-T02 (CTMS-78). CTMS-77 has no Create Campsite API, so E2E
			// fixtures for Search Campsites must be inserted directly -- this
			// mirrors services/api/test/support/campsite-fixtures.ts's Jest
			// helper (Step 5 of CTMS-77), reimplemented as a CLI action since
			// Playwright drives this process via execSync, not a ts-jest import.
			const input = parseJsonArg<{
				hostId?: string;
				campsites: Array<{
					name?: string;
					province?: string;
					city?: string;
					latitude?: string;
					longitude?: string;
					status?: string;
					zones?: Array<{
						amenities?: string[];
						basePrice?: string;
						status?: string;
					}>;
					images?: Array<{ url: string; displayOrder: number }>;
				}>;
			}>(arg);

			let hostId = input.hostId;
			if (!hostId) {
				const hostPasswordHash = await bcrypt.hash("S3curePass!", 10);
				const hostRows = await dataSource.query(
					`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
					 VALUES ($1, $2, 'host', 'active', 'E2E Fixture Host') RETURNING "id"`,
					[
						`e2e-ctms78-host-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`,
						hostPasswordHash,
					]
				);
				hostId = hostRows[0].id;
				await dataSource.query(
					`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, 'host') ON CONFLICT ("user_id", "role") DO NOTHING`,
					[hostId]
				);
			}

			const createdCampsites: Array<{
				id: string;
				name: string;
				province: string;
				status: string;
			}> = [];

			for (const spec of input.campsites) {
				const rows = await dataSource.query(
					`INSERT INTO "campsites"
					   ("host_id", "name", "description", "location", "province", "policies", "operating_hours", "status")
					 VALUES (
					   $1,
					   $2,
					   'e2e fixture',
					   ST_SetSRID(ST_MakePoint($3::double precision, $4::double precision), 4326)::geography,
					   $5,
					   '{"rules":"n/a"}'::jsonb,
					   '{"opensAt":"08:00","closesAt":"18:00"}'::jsonb,
					   $6
					 )
					 RETURNING "id", "name", "province", "status"`,
					[
						hostId,
						spec.name ?? `E2E Campsite ${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
						spec.longitude ?? "106.000000",
						spec.latitude ?? "10.000000",
						spec.province ?? "CTMS78E2E",
						spec.status ?? "active",
					]
				);
				const campsite = rows[0];
				createdCampsites.push(campsite);

				for (const zone of spec.zones ?? []) {
					await dataSource.query(
						`INSERT INTO "campsite_zones"
						   ("campsite_id", "name", "location", "max_tents", "max_people", "base_price", "amenities", "status")
						 VALUES (
						   $1,
						   'E2E Zone',
						   ST_SetSRID(ST_MakePoint(106::double precision, 10::double precision), 4326)::geography,
						   4,
						   12,
						   $2,
						   $3::jsonb,
						   $4
						 )`,
						[
							campsite.id,
							zone.basePrice ?? "100.00",
							JSON.stringify(zone.amenities ?? []),
							zone.status ?? "active",
						]
					);
				}

				for (const image of spec.images ?? []) {
					await dataSource.query(
						`INSERT INTO "campsite_media" ("campsite_id", "url", "type", "sort_order")
						 VALUES ($1, $2, $3, $4)`,
						[campsite.id, image.url, "photo", image.displayOrder]
					);
				}
			}

			console.log(JSON.stringify({ hostId, campsites: createdCampsites }));
		} else if (action === "clean-campsites") {
			// Mirrors cleanupCampsiteFixtures() -- children-first FK order,
			// deletes exactly the ids the spec tracked, never a marker sweep.
			const input = parseJsonArg<{ hostIds: string[]; campsiteIds: string[] }>(arg);
			if (input.campsiteIds.length > 0) {
				const campsiteRows = (await dataSource.query(
					`SELECT "id", "name", "province" FROM "campsites" WHERE "id" = ANY($1)`,
					[input.campsiteIds]
				)) as Array<{ id: string; name: string; province: string }>;
				const unsafeCampsite = campsiteRows.find(
					(row) =>
						!row.province.startsWith("CTMS") &&
						!row.name.startsWith("CTMS") &&
						!row.name.startsWith("E2E") &&
						!row.name.startsWith("Pine Camp CTMS")
				);
				if (unsafeCampsite) {
					throw new Error(
						`Refusing to delete non-E2E campsite: ${unsafeCampsite.id} ${unsafeCampsite.name}`
					);
				}
				await dataSource.query(`DELETE FROM "campsite_media" WHERE "campsite_id" = ANY($1)`, [
					input.campsiteIds,
				]);
				await dataSource.query(`DELETE FROM "campsite_zones" WHERE "campsite_id" = ANY($1)`, [
					input.campsiteIds,
				]);
				await dataSource.query(`DELETE FROM "campsites" WHERE "id" = ANY($1)`, [input.campsiteIds]);
			}
			if (input.hostIds.length > 0) {
				const hostRows = (await dataSource.query(
					`SELECT "id", "email" FROM "users" WHERE "id" = ANY($1)`,
					[input.hostIds]
				)) as Array<{ id: string; email: string | null }>;
				const unsafeHost = hostRows.find((row) => !row.email?.startsWith("e2e-"));
				if (unsafeHost) {
					throw new Error(`Refusing to delete non-E2E host: ${unsafeHost.id}`);
				}
				await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1)`, [
					input.hostIds,
				]);
				await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [input.hostIds]);
			}
			console.log(JSON.stringify({ success: true }));
		} else if (action === "count-campsites") {
			// Used by E2E to assert an invalid-filter request created zero
			// mutation -- a plain count of everything under the fixture marker.
			const rows = await dataSource.query(
				`SELECT count(*) FROM "campsites" WHERE "province" = $1`,
				[arg]
			);
			console.log(JSON.stringify({ count: Number(rows[0].count) }));
		} else if (action === "count-campsites-json") {
			const input = parseJsonArg<{ province: string }>(arg);
			const rows = await dataSource.query(
				`SELECT count(*) FROM "campsites" WHERE "province" = $1`,
				[input.province]
			);
			console.log(JSON.stringify({ count: Number(rows[0].count) }));
		} else if (action === "get-campsite") {
			const input = parseJsonArg<{ campsiteId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "name", "province", "status" FROM "campsites" WHERE "id" = $1`,
				[input.campsiteId]
			);
			console.log(JSON.stringify({ campsite: rows[0] ?? null }));
		} else if (action === "get-campsite-details") {
			const input = parseJsonArg<{ campsiteId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT
				    "id",
				    "host_id" AS "hostId",
				    "name",
				    "description",
				    "province",
				    "policies",
				    "operating_hours" AS "operatingHours",
				    "status",
				    "updated_at" AS "updatedAt"
				  FROM "campsites"
				  WHERE "id" = $1`,
				[input.campsiteId]
			);
			const campsite = rows[0] ?? null;
			if (campsite) {
				const mediaRows = await dataSource.query(
					`SELECT "url", "sort_order" AS "sortOrder" FROM "campsite_media" WHERE "campsite_id" = $1 ORDER BY "sort_order" ASC`,
					[input.campsiteId]
				);
				campsite.media = mediaRows;
			}
			console.log(JSON.stringify({ campsite }));
		} else if (action === "seed-trekking-routes") {
			const input = parseJsonArg<{
				campsiteId: string;
				routes: Array<{
					name: string;
					status?: "draft" | "pending_approval" | "active" | "closed";
					coordinates?: Array<[number, number]>;
				}>;
			}>(arg);
			const campsiteRows = (await dataSource.query(
				'SELECT "name", "province" FROM "campsites" WHERE "id" = $1',
				[input.campsiteId]
			)) as Array<{ name: string; province: string }>;
			const campsite = campsiteRows[0];
			if (
				!campsite ||
				(!campsite.province.startsWith("CTMS") &&
					!campsite.name.startsWith("CTMS") &&
					!campsite.name.startsWith("E2E"))
			) {
				throw new Error("Refusing to seed trekking routes outside an E2E campsite");
			}
			const createdRoutes: Array<{ id: string; name: string; status: string }> = [];
			for (const spec of input.routes) {
				if (!spec.name.startsWith("E2E") && !spec.name.startsWith("CTMS")) {
					throw new Error(`Refusing to seed non-E2E trekking route: ${spec.name}`);
				}
				const geometry = {
					type: "LineString",
					coordinates: spec.coordinates ?? [
						[108.45, 11.94],
						[108.47, 11.94],
					],
				};
				const rows = (await dataSource.query(
					`INSERT INTO "trekking_routes"
					 ("campsite_id", "name", "description", "route_geom", "length_meters", "difficulty",
					  "expected_duration_minutes", "status")
					 SELECT $1, $2, 'e2e checkpoint route', spatial.line, ST_Length(spatial.line), 'moderate', 120, $4
					 FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography AS line) spatial
					 RETURNING "id", "name", "status"`,
					[input.campsiteId, spec.name, JSON.stringify(geometry), spec.status ?? "draft"]
				)) as Array<{ id: string; name: string; status: string }>;
				createdRoutes.push(rows[0]);
			}
			console.log(JSON.stringify({ routes: createdRoutes }));
		} else if (action === "count-trekking-routes") {
			const input = parseJsonArg<{ campsiteId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT
				 (SELECT COUNT(*)::int FROM "trekking_routes" WHERE "campsite_id" = $1) AS "routes",
				 (SELECT COUNT(*)::int FROM "audit_logs" WHERE "action" = 'trekking_route.created'
				    AND "target_id" IN (SELECT "id" FROM "trekking_routes" WHERE "campsite_id" = $1)) AS "audits"`,
				[input.campsiteId]
			);
			console.log(JSON.stringify(rows[0]));
		} else if (action === "get-trekking-route") {
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "campsite_id" AS "campsiteId", "name", "status", "length_meters" AS "lengthMeters",
				 ST_AsGeoJSON("route_geom"::geometry)::json AS "geometry"
				 FROM "trekking_routes" WHERE "id" = $1`,
				[input.routeId]
			);
			console.log(JSON.stringify({ route: rows[0] ?? null }));
		} else if (action === "get-route-checkpoints") {
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "name", "radius_m" AS "radiusMeters", "type",
				 "expected_arrival_offset" AS "expectedArrivalOffset", "instructions",
				 "nearby_water_or_shelter" AS "nearbyWaterOrShelter", "route_position" AS "routePosition",
				 ST_AsGeoJSON("location"::geometry)::json AS "location"
				 FROM "checkpoints" WHERE "route_id" = $1
				 ORDER BY "route_position" ASC, "created_at" ASC, "id" ASC`,
				[input.routeId]
			);
			console.log(JSON.stringify({ checkpoints: rows }));
		} else if (action === "clean-trekking-routes") {
			const input = parseJsonArg<{ routeIds: string[] }>(arg);
			if (input.routeIds.length > 0) {
				const rows = (await dataSource.query(
					`SELECT "id", "name" FROM "trekking_routes" WHERE "id" = ANY($1)`,
					[input.routeIds]
				)) as Array<{ id: string; name: string }>;
				const unsafe = rows.find(
					(row) => !row.name.startsWith("E2E") && !row.name.startsWith("CTMS")
				);
				if (unsafe)
					throw new Error(`Refusing to delete non-E2E trekking route: ${unsafe.id} ${unsafe.name}`);
				const checkpointRows = (await dataSource.query(
					'SELECT "id" FROM "checkpoints" WHERE "route_id" = ANY($1)',
					[input.routeIds]
				)) as Array<{ id: string }>;
				const checkpointIds = checkpointRows.map((row) => row.id);
				if (checkpointIds.length > 0) {
					await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
						checkpointIds,
					]);
					await dataSource.query('DELETE FROM "checkpoints" WHERE "id" = ANY($1)', [checkpointIds]);
				}
				await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
					input.routeIds,
				]);
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [
					input.routeIds,
				]);
			}
			console.log(JSON.stringify({ success: true }));
		} else if (action === "clean-user") {
			assertE2EEmail(arg);
			const rows = await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [arg]);
			if (rows.length > 0) {
				const userId = rows[0].id;
				await dataSource.transaction(async (manager) => {
					await manager.query('DELETE FROM "refresh_tokens" WHERE "user_id" = $1', [userId]);
					await manager.query('DELETE FROM "verification_otps" WHERE "user_id" = $1', [userId]);
					await manager.query(
						'DELETE FROM "audit_logs" WHERE "actor_id" = $1 OR "target_id" = $1',
						[userId]
					);
					await manager.query('DELETE FROM "users" WHERE "id" = $1', [userId]);
				});
				console.log(JSON.stringify({ success: true }));
			} else {
				console.log(JSON.stringify({ success: false, reason: "not_found" }));
			}
		} else {
			throw new Error(`Unknown action: ${action}`);
		}
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
		}
	}
}

main().catch((error) => {
	console.error("DB Helper error:", error);
	process.exit(1);
});
