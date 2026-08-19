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
				city: string;
				status: string;
			}> = [];

			for (const spec of input.campsites) {
				const rows = await dataSource.query(
					`INSERT INTO "campsites"
					   ("host_id", "name", "description", "latitude", "longitude", "province", "city", "policies", "operating_hours", "status")
					 VALUES ($1, $2, 'e2e fixture', $3, $4, $5, $6, 'n/a', 'n/a', $7)
					 RETURNING "id", "name", "province", "city", "status"`,
					[
						hostId,
						spec.name ?? `E2E Campsite ${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
						spec.latitude ?? "10.000000",
						spec.longitude ?? "106.000000",
						spec.province ?? "CTMS78E2E",
						spec.city ?? "FixtureCity",
						spec.status ?? "active",
					]
				);
				const campsite = rows[0];
				createdCampsites.push(campsite);

				for (const zone of spec.zones ?? []) {
					await dataSource.query(
						`INSERT INTO "zones" ("campsite_id", "name", "capacity", "location", "base_price", "amenities", "status")
						 VALUES ($1, 'E2E Zone', 4, 'n/a', $2, $3, $4)`,
						[campsite.id, zone.basePrice ?? "100.00", zone.amenities ?? [], zone.status ?? "active"]
					);
				}

				for (const image of spec.images ?? []) {
					await dataSource.query(
						`INSERT INTO "campsite_images" ("campsite_id", "url", "display_order")
						 VALUES ($1, $2, $3)`,
						[campsite.id, image.url, image.displayOrder]
					);
				}
			}

			console.log(JSON.stringify({ hostId, campsites: createdCampsites }));
		} else if (action === "clean-campsites") {
			// Mirrors cleanupCampsiteFixtures() -- children-first FK order,
			// deletes exactly the ids the spec tracked, never a marker sweep.
			const input = parseJsonArg<{ hostIds: string[]; campsiteIds: string[] }>(arg);
			if (input.campsiteIds.length > 0) {
				await dataSource.query(`DELETE FROM "campsite_images" WHERE "campsite_id" = ANY($1)`, [
					input.campsiteIds,
				]);
				await dataSource.query(`DELETE FROM "zones" WHERE "campsite_id" = ANY($1)`, [
					input.campsiteIds,
				]);
				await dataSource.query(`DELETE FROM "campsites" WHERE "id" = ANY($1)`, [input.campsiteIds]);
			}
			if (input.hostIds.length > 0) {
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
		} else if (action === "clean-user") {
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
