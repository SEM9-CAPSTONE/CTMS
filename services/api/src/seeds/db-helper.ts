import "dotenv/config";
import { randomInt } from "node:crypto";
import * as bcrypt from "bcrypt";
import dataSource from "../shared/database/data-source";

/**
 * JSON-payload actions take their `arg` base64-encoded -- a raw JSON string
 * on the command line is fragile to shell-quote correctly cross-platform.
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
			// non-Camper account to prove role-gated flows end to
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
		} else if (action === "seed-trekking-routes") {
			const input = parseJsonArg<{
				hostId: string;
				routes: Array<{
					name: string;
					status?: "draft" | "pending_approval" | "active" | "closed";
					coordinates?: Array<[number, number]>;
				}>;
			}>(arg);
			const hostRows = (await dataSource.query('SELECT "email" FROM "users" WHERE "id" = $1', [
				input.hostId,
			])) as Array<{ email: string | null }>;
			const host = hostRows[0];
			if (!host?.email?.startsWith("e2e-") && host?.email !== "host@ctms.local") {
				throw new Error("Refusing to seed trekking routes outside an E2E host");
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
					 ("host_id", "name", "description", "route_geom", "length_meters", "difficulty",
					  "expected_duration_minutes", "status")
					 SELECT $1, $2, 'e2e checkpoint route', spatial.line, ST_Length(spatial.line), 'moderate', 120, $4
					 FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography AS line) spatial
					 RETURNING "id", "name", "status"`,
					[input.hostId, spec.name, JSON.stringify(geometry), spec.status ?? "draft"]
				)) as Array<{ id: string; name: string; status: string }>;
				createdRoutes.push(rows[0]);
			}
			console.log(JSON.stringify({ routes: createdRoutes }));
		} else if (action === "count-trekking-routes") {
			const input = parseJsonArg<{ hostId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT
				 (SELECT COUNT(*)::int FROM "trekking_routes" WHERE "host_id" = $1) AS "routes",
				 (SELECT COUNT(*)::int FROM "audit_logs" WHERE "action" = 'trekking_route.created'
				    AND "target_id" IN (SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1)) AS "audits"`,
				[input.hostId]
			);
			console.log(JSON.stringify(rows[0]));
		} else if (action === "get-trekking-route") {
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "host_id" AS "hostId", "name", "status", "length_meters" AS "lengthMeters",
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
		} else if (action === "get-route-danger-zones") {
			// CTMS-23-T02 E2E. Reads authoritative PostGIS hazard rows created through the Host UI.
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "route_id" AS "routeId", "radius_m" AS "radiusMeters",
				 "description", "severity", ST_AsGeoJSON("geom"::geometry)::json AS "geometry"
				 FROM "route_danger_zones" WHERE "route_id" = $1
				 ORDER BY "created_at" ASC, "id" ASC`,
				[input.routeId]
			);
			console.log(JSON.stringify({ dangerZones: rows }));
		} else if (action === "get-weather-snapshots") {
			// CTMS-25-T02 E2E. Reads the real weather_snapshots rows for a
			// route -- proves a UI-triggered refresh persisted real data (or
			// that a rejected/forbidden attempt persisted none), the same
			// "verify the real DB row, not just the UI" rigor as
			// get-route-checkpoints above.
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "status", "observed_at" AS "observedAt", "rainfall_mm" AS "rainfallMm",
				 "wind_kph" AS "windKph", "temperature_c" AS "temperatureC", "visibility_m" AS "visibilityM",
				 "thunderstorm", "provider_response" AS "provider_response", "error_message" AS "errorMessage",
				 "created_at" AS "createdAt"
				 FROM "weather_snapshots" WHERE "route_id" = $1
				 ORDER BY "created_at" ASC`,
				[input.routeId]
			);
			console.log(JSON.stringify({ snapshots: rows }));
		} else if (action === "get-weather-risk-assessments") {
			// CTMS-27-T02 E2E. Reads the real weather_risk_assessments rows for
			// a route -- proves a UI-triggered "Tính điểm rủi ro" click
			// persisted a real, reproducible assessment (or that a
			// rejected/forbidden attempt persisted none), same "verify the
			// real DB row, not just the UI" rigor as get-weather-snapshots.
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT "id", "risk_level" AS "riskLevel", "composite_score" AS "compositeScore",
				 "criteria_scores" AS "criteriaScores", "snapshot_id" AS "snapshotId",
				 "rule_version_id" AS "ruleVersionId", "created_at" AS "createdAt"
				 FROM "weather_risk_assessments" WHERE "route_id" = $1
				 ORDER BY "created_at" ASC`,
				[input.routeId]
			);
			console.log(JSON.stringify({ assessments: rows }));
		} else if (action === "seed-weather-advice") {
			// CTMS-29-T02 E2E. There is no real OPENAI_API_KEY configured in this
			// environment yet (same deferred-LLM-call situation documented in the
			// CTMS-29 spec and services/api's own weather-advice.integration-spec.ts),
			// so the E2E "happy path" seeds a real advice row directly for a real,
			// already-calculated assessment -- clicking "Tạo lời khuyên" in the UI
			// then hits WeatherAdviceService's own idempotent-return branch (a real
			// code path, not a UI illusion) instead of a fresh, paid LLM call.
			const input = parseJsonArg<{
				assessmentId: string;
				adviceText: string;
				actions: string[];
				createdBy: string;
			}>(arg);
			const rows = await dataSource.query(
				`INSERT INTO "weather_advice" ("assessment_id", "advice_text", "actions", "created_by")
				 VALUES ($1, $2, $3::jsonb, $4)
				 ON CONFLICT ("assessment_id") DO UPDATE SET "advice_text" = EXCLUDED."advice_text"
				 RETURNING "id", "assessment_id" AS "assessmentId", "advice_text" AS "adviceText",
				           "actions", "created_by" AS "createdBy", "created_at" AS "createdAt"`,
				[input.assessmentId, input.adviceText, JSON.stringify(input.actions), input.createdBy]
			);
			console.log(JSON.stringify({ advice: rows[0] }));
		} else if (action === "get-weather-advice") {
			// CTMS-29-T02 E2E. Reads the real weather_advice rows for a route --
			// proves a UI-triggered "Tạo lời khuyên" click persisted/returned a
			// real row (or that a rejected/forbidden attempt persisted none), same
			// "verify the real DB row, not just the UI" rigor as
			// get-weather-risk-assessments.
			const input = parseJsonArg<{ routeId: string }>(arg);
			const rows = await dataSource.query(
				`SELECT wa."id", wa."assessment_id" AS "assessmentId", wa."advice_text" AS "adviceText",
				        wa."actions", wa."created_by" AS "createdBy", wa."created_at" AS "createdAt"
				 FROM "weather_advice" wa
				 JOIN "weather_risk_assessments" a ON a."id" = wa."assessment_id"
				 WHERE a."route_id" = $1
				 ORDER BY wa."created_at" ASC`,
				[input.routeId]
			);
			console.log(JSON.stringify({ advices: rows }));
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
				const dangerZoneRows = (await dataSource.query(
					'SELECT "id" FROM "route_danger_zones" WHERE "route_id" = ANY($1)',
					[input.routeIds]
				)) as Array<{ id: string }>;
				const dangerZoneIds = dangerZoneRows.map((row) => row.id);
				if (dangerZoneIds.length > 0) {
					await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
						dangerZoneIds,
					]);
					await dataSource.query('DELETE FROM "route_danger_zones" WHERE "id" = ANY($1)', [
						dangerZoneIds,
					]);
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
		} else if (action === "find-users-by-email-prefix") {
			// Generic E2E cleanup helper: some specs (e.g. Mobile's
			// verify_otp_test.dart) register accounts through the real UI with a
			// timestamp an orchestrating script can't know in advance, only a
			// fixed prefix (still required to start with "e2e-" -- reuses
			// assertE2EEmail's same safety guard as clean-user, just checked
			// against the prefix itself rather than a single exact email).
			assertE2EEmail(arg);
			const rows = await dataSource.query('SELECT "email" FROM "users" WHERE "email" LIKE $1', [
				`${arg}%`,
			]);
			console.log(JSON.stringify(rows.map((r: { email: string }) => r.email)));
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
