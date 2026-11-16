import type { DataSource } from "typeorm";
import { ROUTE_DEVIATION_ANALYSIS_VERSION } from "../modules/route-deviation-analysis/route-deviation-analysis.constants";
import { SafetyHotspotsRepository } from "../modules/safety-hotspots/safety-hotspots.repository";
import { SafetyHotspotsService } from "../modules/safety-hotspots/safety-hotspots.service";

/**
 * CTMS-116/117/118 seed: route-deviation evidence on host@ctms.local's Sơn Trà route, the
 * hotspots the real CTMS-116 detector finds in it, and a review state for each, so the Admin
 * "Điểm nóng an toàn" page has a CONFIRMED hotspot to correct.
 *
 * Rules (AGENTS.md):
 * - Reuses host@ctms.local, admin@ctms.local and the members already booked on completed Trips;
 *   never creates accounts, Routes or Trips.
 * - Deviation events sit at two real spots of the route (the slippery cliff slope and the Suối Đá
 *   water station) and carry fixed GPS-log ids, so a re-run inserts nothing new.
 * - Hotspots come from SafetyHotspotsService.detect (BR-417 criteria), not hand-written rows.
 * - CTMS-117 (review) is not built yet; this seed records its outcome only for hotspots still in
 *   DETECTED, so a status an Admin changed later is kept. Review notes read like real operations.
 */

const ROUTE_NAME = "Bán Đảo Sơn Trà Discovery";
const HOST_EMAIL = "host@ctms.local";
const ADMIN_EMAIL = "admin@ctms.local";
const METERS_PER_DEGREE_LAT = 111_320;

interface Spot {
	/** Fixed prefix of the GPS-log ids, keeps every event unique and re-runs idempotent. */
	key: string;
	lng: number;
	lat: number;
	routeFraction: number;
	reviewStatus: "CONFIRMED" | "UNDER_REVIEW";
	reviewNote: string;
}

/** Two places on the route where several groups left the trail in the last weeks. */
const SPOTS: Spot[] = [
	{
		key: "a1180000-0000-4000-8118-0000000001",
		lng: 108.2899,
		lat: 16.1154,
		routeFraction: 0.74,
		reviewStatus: "CONFIRMED",
		reviewNote:
			"Đối chiếu nhật ký của Host: sau mưa các đoàn tránh đoạn dốc trơn bằng lối mòn sát mép vực ở Dốc Vọng Cảnh. Xác nhận là điểm nguy hiểm cần cập nhật hướng dẫn.",
	},
	{
		key: "a1180000-0000-4000-8118-0000000002",
		lng: 108.2803,
		lat: 16.1207,
		routeFraction: 0.5,
		reviewStatus: "UNDER_REVIEW",
		reviewNote:
			"Đang hỏi Host về việc đoàn rẽ xuống suối lấy nước tại Trạm Suối Đá; cần xác minh lối xuống suối có an toàn không.",
	},
];

/** Offsets in metres (north, east) of each event's start from the spot; all within 25 m. */
const OFFSETS: Array<[number, number]> = [
	[0, 0],
	[8, -6],
	[-10, 4],
	[14, 9],
	[-6, -12],
	[4, 15],
];

interface Participant {
	tripId: string;
	userId: string;
	startsAt: Date;
}

export async function seedSafetyHotspotScenarios(ds: DataSource): Promise<void> {
	const [route] = (await ds.query(
		`SELECT r."id", md5(ST_AsBinary(r."route_geom")) AS "routeVersion"
		 FROM "trekking_routes" r JOIN "users" u ON u."id" = r."host_id"
		 WHERE u."email" = $1 AND r."name" = $2`,
		[HOST_EMAIL, ROUTE_NAME]
	)) as Array<{ id: string; routeVersion: string }>;
	const [admin] = (await ds.query(`SELECT "id" FROM "users" WHERE "email" = $1`, [
		ADMIN_EMAIL,
	])) as Array<{
		id: string;
	}>;
	if (!route || !admin) {
		console.log(`   ⚠️  Bỏ qua: chưa có tuyến "${ROUTE_NAME}" hoặc tài khoản ${ADMIN_EMAIL}.`);
		return;
	}

	// Two members from each of the three completed Trips with the most joined members.
	const participants = (await ds.query(
		`WITH members AS (
		   SELECT t."id" AS "tripId", bm."user_id" AS "userId", t."starts_at" AS "startsAt",
		          row_number() OVER (PARTITION BY t."id" ORDER BY bm."user_id") AS rn,
		          count(*) OVER (PARTITION BY t."id") AS total
		   FROM "trips" t
		   JOIN "bookings" b ON b."trip_id" = t."id" AND b."status" IN ('completed', 'confirmed')
		   JOIN "booking_members" bm ON bm."booking_id" = b."id" AND bm."user_id" IS NOT NULL
		   WHERE t."route_id" = $1 AND t."status" = 'completed'
		     AND t."starts_at" > now() - interval '28 days'
		 ), trips AS (
		   SELECT "tripId" FROM members GROUP BY "tripId" ORDER BY max(total) DESC, "tripId" LIMIT 3
		 )
		 SELECT "tripId", "userId", "startsAt" FROM members
		 WHERE "tripId" IN (SELECT "tripId" FROM trips) AND rn <= 2
		 ORDER BY "tripId", "userId"`,
		[route.id]
	)) as Participant[];
	const tripCount = new Set(participants.map((p) => p.tripId)).size;
	const memberCount = new Set(participants.map((p) => p.userId)).size;
	if (tripCount < 3 || memberCount < 3 || participants.length < 5) {
		console.log(
			"   ⚠️  Bỏ qua: tuyến Sơn Trà cần ít nhất 3 chuyến đã hoàn thành trong 28 ngày qua có thành viên tham gia."
		);
		return;
	}

	await ds.transaction(async (manager) => {
		const analysisIds = new Map<string, string>();
		for (const tripId of new Set(participants.map((p) => p.tripId))) {
			await manager.query(
				`INSERT INTO "route_deviation_trip_analyses"
				   ("trip_id", "analysis_version", "route_id", "route_version", "runtime_context",
				    "participants", "samples_total", "samples_used", "episodes", "analyzed_at")
				 SELECT $1, $2, $3, $4, '{}'::jsonb, $5, 0, 0, 0, t."ends_at" + interval '1 hour'
				 FROM "trips" t WHERE t."id" = $1
				 ON CONFLICT ("trip_id", "analysis_version") DO NOTHING`,
				[
					tripId,
					ROUTE_DEVIATION_ANALYSIS_VERSION,
					route.id,
					route.routeVersion,
					participants.filter((p) => p.tripId === tripId).length,
				]
			);
			const [row] = (await manager.query(
				`SELECT "id" FROM "route_deviation_trip_analyses" WHERE "trip_id" = $1 AND "analysis_version" = $2`,
				[tripId, ROUTE_DEVIATION_ANALYSIS_VERSION]
			)) as Array<{ id: string }>;
			analysisIds.set(tripId, row.id);
		}

		for (const spot of SPOTS) {
			for (const [index, participant] of participants.entries()) {
				const [north, east] = OFFSETS[index % OFFSETS.length];
				const lat = spot.lat + north / METERS_PER_DEGREE_LAT;
				const lng =
					spot.lng + east / (METERS_PER_DEGREE_LAT * Math.cos((spot.lat * Math.PI) / 180));
				const suffix = String(index).padStart(2, "0");
				// Events start 2–4 hours into the Trip, a few minutes apart per member.
				const startedAt = new Date(
					new Date(participant.startsAt).getTime() + (2 * 60 + index * 7) * 60_000
				);
				await manager.query(
					`INSERT INTO "route_deviation_events"
					   ("analysis_id", "analysis_version", "config_version", "trip_id", "route_id", "route_version",
					    "package_version", "user_id", "participant_role", "started_at", "confirmed_at", "ended_at",
					    "end_reason", "sample_count", "valid_sample_count", "max_distance_meters", "avg_distance_meters",
					    "start_location", "max_distance_location", "start_route_fraction", "start_gps_log_id",
					    "end_gps_log_id", "runtime_context", "authoritative", "context_issues")
					 VALUES ($1, $2, 'v3', $3, $4, $5, '1', $6, 'camper', $7,
					   $7::timestamptz + interval '1 minute', $7::timestamptz + interval '9 minutes', 'RECOVERED',
					   18, 16, $8, $9,
					   ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography,
					   ST_SetSRID(ST_MakePoint($10, $11 + 0.0006), 4326)::geography,
					   $12, $13, $14, '{}'::jsonb, true, '{}'::text[])
					 ON CONFLICT ("analysis_version", "start_gps_log_id") DO NOTHING`,
					[
						analysisIds.get(participant.tripId),
						ROUTE_DEVIATION_ANALYSIS_VERSION,
						participant.tripId,
						route.id,
						route.routeVersion,
						participant.userId,
						startedAt,
						72 + index * 6,
						58 + index * 4,
						lng,
						lat,
						spot.routeFraction,
						`${spot.key}${suffix}`,
						`${spot.key.slice(0, -2)}99${suffix}`,
					]
				);
			}
		}
	});

	// Real CTMS-116 detection over the evidence; idempotent, it skips places already covered.
	const detection = await new SafetyHotspotsService(new SafetyHotspotsRepository(ds)).detect(
		admin.id
	);
	console.log(
		`   • Phát hiện điểm nóng: ${detection.candidatesCreated} mới từ ${detection.eventsConsidered} lần lệch tuyến.`
	);

	// Stand-in for the CTMS-117 review outcome; only DETECTED hotspots are moved.
	for (const spot of SPOTS) {
		const reviewed = (await ds.query(
			`UPDATE "potential_safety_hotspots" SET "status" = $5, "status_changed_at" = now()
			 WHERE "route_id" = $1 AND "route_version" = $2 AND "status" = 'DETECTED'
			   AND ST_DWithin("center", ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 60)
			 RETURNING "id"`,
			[route.id, route.routeVersion, spot.lng, spot.lat, spot.reviewStatus]
		)) as [Array<{ id: string }>, number];
		for (const { id } of reviewed[0]) {
			await ds.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after", "reason")
				 VALUES ($1, 'safety_hotspot.reviewed', 'potential_safety_hotspot', $2, $3::jsonb, $4::jsonb, $5)`,
				[
					admin.id,
					id,
					JSON.stringify({ status: "DETECTED" }),
					JSON.stringify({ status: spot.reviewStatus }),
					spot.reviewNote.slice(0, 255),
				]
			);
		}
	}

	const summary = (await ds.query(
		`SELECT "status", count(*)::int AS "count" FROM "potential_safety_hotspots"
		 WHERE "route_id" = $1 GROUP BY "status" ORDER BY "status"`,
		[route.id]
	)) as Array<{ status: string; count: number }>;
	console.log(
		`   • Điểm nóng trên tuyến ${ROUTE_NAME}: ${summary.map((row) => `${row.status} ${row.count}`).join(", ")}`
	);
}
