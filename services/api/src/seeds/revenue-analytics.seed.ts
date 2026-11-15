import type { DataSource } from "typeorm";

/**
 * CTMS-110 seed: area snapshots for existing Trips plus settled revenue history for
 * host@ctms.local in every inhabited Đà Nẵng district (Hoàng Sa is an offshore island district
 * with no trekking, so it has no Trip).
 *
 * Rules (AGENTS.md):
 * - Reuses host@ctms.local and camper@ctms.local; never creates accounts.
 * - Places, routes and coordinates are real locations in Đà Nẵng. No cover images are seeded:
 *   stock photos would not show the actual place, so the Host uploads real ones.
 * - Area backfill only fills Trips whose `area_code` is still empty; areas a Host already chose
 *   are left alone. No keys, statuses or money values of existing rows are changed.
 * - Ledger rows use fixed ids and `ON CONFLICT DO NOTHING`, so a re-run never rewrites a
 *   payment, refund or settlement. Only the descriptive fields of these seed Trips are refreshed.
 */

/** Title/route keywords → area. The first match wins; title is checked before route name. */
const AREA_KEYWORDS: Array<{ code: string; keywords: string[] }> = [
	{
		code: "DNG-HOA-VANG",
		keywords: [
			"bà nà",
			"núi chúa",
			"hòa bắc",
			"khe ram",
			"suối mơ",
			"hòa trung",
			"hòa vang",
			"hòa phú",
			"tà lang",
			"giàn bí",
			"cu đê",
		],
	},
	{ code: "DNG-LIEN-CHIEU", keywords: ["hải vân", "làng vân", "nam ô", "suối lương"] },
	{ code: "DNG-NGU-HANH-SON", keywords: ["ngũ hành sơn", "non nước", "huyền không", "thủy sơn"] },
	{ code: "DNG-HAI-CHAU", keywords: ["sông hàn", "cầu rồng"] },
	{ code: "DNG-THANH-KHE", keywords: ["thanh bình", "thanh khê"] },
	{ code: "DNG-CAM-LE", keywords: ["cẩm lệ", "la hường"] },
	{
		code: "DNG-SON-TRA",
		keywords: ["sơn trà", "voọc", "bàn cờ", "điệp sơn", "mũi nghê", "bãi bụt", "chùa linh ứng"],
	},
];

/**
 * Older performance-report seed Trips that were set outside Đà Nẵng, moved to real Đà Nẵng places.
 * `from` is the former title so existing databases are renamed in place.
 */
export const DA_NANG_TRIP_MOVES = [
	{
		from: "Trekking Tà Năng - Phan Dũng (Lâm Đồng)",
		title: "Trekking Tà Lang – Giàn Bí, bản làng Cơ Tu Hòa Bắc",
		description:
			"Băng rừng Hòa Bắc vào thôn Tà Lang, Giàn Bí, ngủ nhà sàn và nghe già làng Cơ Tu kể chuyện bản.",
		routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
	},
	{
		from: "Khám phá Rừng Tràm Trà Sư (An Giang)",
		title: "Chèo kayak sông Cu Đê – Hòa Bắc",
		description:
			"Chèo kayak xuôi dòng Cu Đê giữa hai bờ núi Hòa Bắc, dừng tắm suối và ăn trưa bên bãi sỏi.",
		routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
	},
	{
		from: "Chinh phục đỉnh Bidoup Núi Bà (Lâm Đồng)",
		title: "Xuyên rừng Bà Nà – Chinh phục đỉnh Núi Chúa",
		description:
			"Leo xuyên rừng nguyên sinh Bà Nà, cắm trại trên sườn núi và đón bình minh trên đỉnh Núi Chúa.",
		routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
	},
	{
		from: "Khám phá VQG Cát Tiên (Đồng Nai)",
		title: "Ngắm voọc chà vá chân nâu – Rừng Sơn Trà",
		description:
			"Đi bộ nhẹ trong rừng Sơn Trà buổi sáng sớm, quan sát đàn voọc chà vá chân nâu kiếm ăn trên tán cây.",
		routeName: "Bán Đảo Sơn Trà Discovery",
	},
] as const;

/** Renames existing rows in place: only title, description and route change; ledger rows stay. */
async function moveLegacyTripsToDaNang(ds: DataSource, hostId: string): Promise<void> {
	for (const move of DA_NANG_TRIP_MOVES) {
		await ds.query(
			`UPDATE "trips" t
			 SET "title" = $2, "description" = $3,
				"route_id" = COALESCE(
					(SELECT r."id" FROM "trekking_routes" r WHERE r."name" = $4 ORDER BY r."created_at" LIMIT 1),
					t."route_id"
				)
			 WHERE t."host_id" = $5 AND t."title" = $1`,
			[move.from, move.title, move.description, move.routeName, hostId]
		);
	}
}

interface SeedRoute {
	id: string;
	name: string;
	description: string;
	/** Real path as [longitude, latitude] pairs. */
	path: Array<[number, number]>;
	lengthMeters: number;
	difficulty: "easy" | "moderate";
	durationMinutes: number;
}

const ROUTES: SeedRoute[] = [
	{
		id: "e1100000-0000-4000-8110-000000000401",
		name: "Thủy Sơn – Ngũ Hành Sơn",
		description:
			"Leo bậc đá Thủy Sơn qua chùa Linh Ứng, động Huyền Không, động Tàng Chơn lên đài Vọng Giang.",
		path: [
			[108.2629, 16.0041],
			[108.2637, 16.0034],
			[108.2644, 16.0027],
			[108.2649, 16.0021],
		],
		lengthMeters: 1600,
		difficulty: "easy",
		durationMinutes: 180,
	},
	{
		id: "e1100000-0000-4000-8110-000000000402",
		name: "Ven sông Hàn – Cầu Sông Hàn đến cầu Trần Thị Lý",
		description: "Đi bộ dọc đường Bạch Đằng bên bờ tây sông Hàn, qua chân cầu Rồng.",
		path: [
			[108.2236, 16.0716],
			[108.2253, 16.0661],
			[108.2264, 16.0612],
			[108.2279, 16.0532],
			[108.2286, 16.0489],
		],
		lengthMeters: 2700,
		difficulty: "easy",
		durationMinutes: 150,
	},
	{
		id: "e1100000-0000-4000-8110-000000000403",
		name: "Biển Thanh Bình – Làng chài Thanh Khê",
		description: "Đi bộ trên bãi biển Thanh Bình về phía xóm chài, xem thuyền thúng vào bờ.",
		path: [
			[108.2143, 16.0812],
			[108.2156, 16.0827],
			[108.2171, 16.0839],
			[108.219, 16.0848],
		],
		lengthMeters: 1300,
		difficulty: "easy",
		durationMinutes: 120,
	},
	{
		id: "e1100000-0000-4000-8110-000000000404",
		name: "Ven sông Cẩm Lệ – Làng rau La Hường",
		description: "Đi bộ từ cầu Cẩm Lệ dọc bờ sông về làng rau La Hường, phường Hòa Xuân.",
		path: [
			[108.2083, 16.0086],
			[108.2121, 16.0047],
			[108.2158, 16.0011],
			[108.2189, 15.9974],
		],
		lengthMeters: 2900,
		difficulty: "easy",
		durationMinutes: 180,
	},
];

interface HistoryTrip {
	id: string;
	bookingId: string;
	chargeId: string;
	/** Seeded route id, or the name of an existing host@ route. */
	route: { id: string } | { name: string };
	title: string;
	description: string;
	areaCode: string;
	tripType: "day_trip" | "overnight";
	startsAt: string;
	endsAt: string;
	numPeople: number;
	pricePerPerson: number;
	paidAt: string;
	refund?: { id: string; amount: number; succeededAt: string; reason: string };
	settledAt: string;
}

const HISTORY_TRIPS: HistoryTrip[] = [
	{
		id: "e1100000-0000-4000-8110-000000000001",
		bookingId: "e1100000-0000-4000-8110-000000000101",
		chargeId: "e1100000-0000-4000-8110-000000000201",
		route: { id: ROUTES[0].id },
		title: "Leo núi Ngũ Hành Sơn – Động Huyền Không",
		description:
			"Leo Thủy Sơn qua các hang động, chùa cổ và ngắm toàn cảnh biển Non Nước lúc bình minh.",
		areaCode: "DNG-NGU-HANH-SON",
		tripType: "day_trip",
		startsAt: "2026-08-15T22:30:00Z",
		endsAt: "2026-08-16T05:00:00Z",
		numPeople: 6,
		pricePerPerson: 650000,
		paidAt: "2026-08-08T09:12:00Z",
		settledAt: "2026-08-20T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000002",
		bookingId: "e1100000-0000-4000-8110-000000000102",
		chargeId: "e1100000-0000-4000-8110-000000000202",
		route: { name: "Rừng Nguyên Sinh Bà Nà - Núi Chúa" },
		title: "Trekking suối Hoa – Hòa Phú Thành",
		description: "Băng rừng dọc suối Hoa, tắm thác và cắm trại một đêm bên bờ suối ở Hòa Vang.",
		areaCode: "DNG-HOA-VANG",
		tripType: "overnight",
		startsAt: "2026-09-12T23:00:00Z",
		endsAt: "2026-09-13T09:00:00Z",
		numPeople: 8,
		pricePerPerson: 750000,
		paidAt: "2026-09-03T14:40:00Z",
		refund: {
			id: "e1100000-0000-4000-8110-000000000302",
			amount: 750000,
			succeededAt: "2026-09-09T03:15:00Z",
			reason: "Một thành viên trong nhóm báo bận việc gia đình trước ngày khởi hành.",
		},
		settledAt: "2026-09-17T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000003",
		bookingId: "e1100000-0000-4000-8110-000000000103",
		chargeId: "e1100000-0000-4000-8110-000000000203",
		route: { name: "Hải Vân Pass - Nam Hải Vân Trail" },
		title: "Cắm trại rạn Nam Ô – Ngắm hoàng hôn",
		description: "Đi bộ dọc ghềnh đá Nam Ô, dựng lều bên bờ biển và thưởng thức gỏi cá làng chài.",
		areaCode: "DNG-LIEN-CHIEU",
		tripType: "overnight",
		startsAt: "2026-10-17T08:00:00Z",
		endsAt: "2026-10-18T02:00:00Z",
		numPeople: 10,
		pricePerPerson: 550000,
		paidAt: "2026-10-06T11:05:00Z",
		settledAt: "2026-10-22T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000004",
		bookingId: "e1100000-0000-4000-8110-000000000104",
		chargeId: "e1100000-0000-4000-8110-000000000204",
		route: { id: ROUTES[1].id },
		title: "Đi bộ đêm ven sông Hàn – Xem cầu Rồng phun lửa",
		description:
			"Dạo bộ đường Bạch Đằng lúc lên đèn, dừng ở chân cầu Rồng xem phun lửa, phun nước lúc 21 giờ tối thứ Bảy.",
		areaCode: "DNG-HAI-CHAU",
		tripType: "day_trip",
		startsAt: "2026-10-24T12:30:00Z",
		endsAt: "2026-10-24T15:00:00Z",
		numPeople: 6,
		pricePerPerson: 350000,
		paidAt: "2026-10-18T08:20:00Z",
		settledAt: "2026-10-28T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000005",
		bookingId: "e1100000-0000-4000-8110-000000000105",
		chargeId: "e1100000-0000-4000-8110-000000000205",
		route: { id: ROUTES[2].id },
		title: "Bình minh biển Thanh Bình – Làng chài Thanh Khê",
		description:
			"Đón bình minh trên bãi Thanh Bình, xem ngư dân kéo thuyền thúng vào bờ và ăn sáng ở chợ cá.",
		areaCode: "DNG-THANH-KHE",
		tripType: "day_trip",
		startsAt: "2026-10-30T22:00:00Z",
		endsAt: "2026-10-31T01:30:00Z",
		numPeople: 8,
		pricePerPerson: 250000,
		paidAt: "2026-10-22T13:45:00Z",
		refund: {
			id: "e1100000-0000-4000-8110-000000000305",
			amount: 250000,
			succeededAt: "2026-10-28T04:10:00Z",
			reason: "Một khách đổi lịch công tác nên hủy trước ngày đi.",
		},
		settledAt: "2026-11-04T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000006",
		bookingId: "e1100000-0000-4000-8110-000000000106",
		chargeId: "e1100000-0000-4000-8110-000000000206",
		route: { id: ROUTES[3].id },
		title: "Đi bộ ven sông Cẩm Lệ – Làng rau La Hường",
		description:
			"Đi bộ sáng sớm dọc sông Cẩm Lệ, thăm vườn rau La Hường và tự tay hái rau nấu bữa trưa.",
		areaCode: "DNG-CAM-LE",
		tripType: "day_trip",
		startsAt: "2026-10-31T23:00:00Z",
		endsAt: "2026-11-01T04:00:00Z",
		numPeople: 10,
		pricePerPerson: 300000,
		paidAt: "2026-10-24T10:30:00Z",
		settledAt: "2026-11-05T02:00:00Z",
	},
	{
		id: "e1100000-0000-4000-8110-000000000007",
		bookingId: "e1100000-0000-4000-8110-000000000107",
		chargeId: "e1100000-0000-4000-8110-000000000207",
		route: { id: ROUTES[0].id },
		title: "Leo núi Thủy Sơn – Ngắm bình minh Non Nước",
		description:
			"Leo Thủy Sơn trước khi trời sáng, đón bình minh trên đài Vọng Giang rồi xuống làng đá Non Nước.",
		areaCode: "DNG-NGU-HANH-SON",
		tripType: "day_trip",
		startsAt: "2026-11-06T22:00:00Z",
		endsAt: "2026-11-07T02:30:00Z",
		numPeople: 7,
		pricePerPerson: 400000,
		paidAt: "2026-10-30T09:05:00Z",
		settledAt: "2026-11-11T02:00:00Z",
	},
];

const COMMISSION_RATE_BPS = 500n; // 5.00%, the rate in force when these Trips were settled.

function minorOf(vnd: number): bigint {
	return BigInt(Math.round(vnd)) * 100n;
}

function money(minor: bigint): string {
	return `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

function providerRef(prefix: string, at: string): string {
	return `${prefix}${at.replace(/\D/g, "").slice(0, 12)}`;
}

export async function backfillTripAreaSnapshots(ds: DataSource): Promise<number> {
	let updated = 0;
	for (const field of ["title", "route"] as const) {
		for (const { code, keywords } of AREA_KEYWORDS) {
			const patterns = keywords.map((keyword) => `%${keyword}%`);
			const column = field === "title" ? `t."title"` : `r."name"`;
			const rows = (await ds.query(
				`UPDATE "trips" t
				 SET "area_code" = ga."code", "area_name" = ga."name",
					"province_code" = ga."province_code", "province_name" = ga."province_name"
				 FROM "geo_areas" ga, "trekking_routes" r
				 WHERE ga."code" = $1 AND r."id" = t."route_id"
					AND t."area_code" IS NULL
					AND lower(${column}) LIKE ANY($2::text[])
				 RETURNING t."id"`,
				[code, patterns]
			)) as [unknown[], number] | unknown[];
			updated += Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : rows.length;
		}
	}
	return updated;
}

async function ensureRoutes(ds: DataSource, hostId: string): Promise<void> {
	for (const route of ROUTES) {
		const lineString = `SRID=4326;LINESTRING(${route.path.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`;
		await ds.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "description", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, $3, $4, ST_GeomFromEWKT($5), $6, $7, $8, 'active')
			 ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description"`,
			[
				route.id,
				hostId,
				route.name,
				route.description,
				lineString,
				route.lengthMeters,
				route.difficulty,
				route.durationMinutes,
			]
		);
	}
}

async function resolveRouteId(
	ds: DataSource,
	hostId: string,
	route: HistoryTrip["route"]
): Promise<string | null> {
	if ("id" in route) return route.id;
	const rows = (await ds.query(
		`SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1
		 ORDER BY ("name" = $2) DESC, "created_at" ASC LIMIT 1`,
		[hostId, route.name]
	)) as Array<{ id: string }>;
	return rows[0]?.id ?? null;
}

export async function seedRevenueAnalyticsScenarios(ds: DataSource): Promise<void> {
	if (!ds.isInitialized) await ds.initialize();
	console.log("[seed:revenue-analytics] Seeding CTMS-110 revenue history and area snapshots...");

	const [host] = (await ds.query(
		`SELECT "id" FROM "users" WHERE "email" = 'host@ctms.local'`
	)) as Array<{ id: string }>;
	const [camper] = (await ds.query(
		`SELECT "id" FROM "users" WHERE "email" = 'camper@ctms.local'`
	)) as Array<{ id: string }>;
	if (!host || !camper) {
		console.warn("[seed:revenue-analytics] host@ctms.local or camper@ctms.local missing; skipped.");
		return;
	}

	await ensureRoutes(ds, host.id);
	await moveLegacyTripsToDaNang(ds, host.id);

	for (const trip of HISTORY_TRIPS) {
		const routeId = await resolveRouteId(ds, host.id, trip.route);
		if (!routeId) {
			console.warn(`[seed:revenue-analytics] No route for "${trip.title}"; skipped.`);
			continue;
		}
		const firstPoint =
			"id" in trip.route ? ROUTES.find((route) => route.id === routeId)?.path[0] : undefined;
		const meetingPoint = JSON.stringify({
			type: "Point",
			coordinates: firstPoint ?? [108.2022, 16.0544],
		});
		const durationNights = trip.tripType === "day_trip" ? 0 : 1;

		const totalMinor = minorOf(trip.numPeople * trip.pricePerPerson);
		const refundMinor = trip.refund ? minorOf(trip.refund.amount) : 0n;
		const baseMinor = totalMinor - refundMinor;
		const feeMinor = (baseMinor * COMMISSION_RATE_BPS) / 10000n;
		const netMinor = baseMinor - feeMinor;

		await ds.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "description", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "meeting_at", "booking_deadline", "capacity_min", "capacity_max",
				"seats_taken", "price_per_person", "status", "created_at",
				"area_code", "area_name", "province_code", "province_name")
			 SELECT $1::uuid, $2::uuid, $3::uuid, $4::varchar, $5::text, $12::trip_type, $13::int,
				$6::timestamptz, $7::timestamptz,
				ST_SetSRID(ST_GeomFromGeoJSON($8), 4326)::geography, $6::timestamptz - interval '30 minutes',
				$6::timestamptz - interval '2 days', 4, 12, $9::int, $10::numeric, 'completed',
				$6::timestamptz - interval '21 days',
				ga."code", ga."name", ga."province_code", ga."province_name"
			 FROM "geo_areas" ga WHERE ga."code" = $11
			 ON CONFLICT ("id") DO UPDATE SET
				"title" = EXCLUDED."title", "description" = EXCLUDED."description",
				"route_id" = EXCLUDED."route_id", "meeting_point" = EXCLUDED."meeting_point",
				"trip_type" = EXCLUDED."trip_type", "duration_nights" = EXCLUDED."duration_nights"`,
			[
				trip.id,
				host.id,
				routeId,
				trip.title,
				trip.description,
				trip.startsAt,
				trip.endsAt,
				meetingPoint,
				trip.numPeople,
				trip.pricePerPerson,
				trip.areaCode,
				trip.tripType,
				durationNights,
			]
		);

		await ds.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "status", "payment_status", "total_amount", "created_at")
			 VALUES ($1, $2, $3, $4, 'completed', 'paid', $5, $6::timestamptz - interval '10 minutes')
			 ON CONFLICT ("id") DO NOTHING`,
			[trip.bookingId, trip.id, camper.id, trip.numPeople, money(totalMinor), trip.paidAt]
		);

		const chargeRef = providerRef("VNP", trip.paidAt);
		await ds.query(
			`INSERT INTO "payments" ("id", "booking_id", "amount", "type", "status", "provider_reference", "succeeded_at", "created_at", "updated_at")
			 VALUES ($1, $2, $3, 'charge', 'succeeded', $4, $5, $5, $5)
			 ON CONFLICT ("id") DO NOTHING`,
			[trip.chargeId, trip.bookingId, money(totalMinor), chargeRef, trip.paidAt]
		);
		await ds.query(
			`INSERT INTO "payment_transactions" ("payment_id", "transaction_ref", "status", "created_at")
			 SELECT $1, $2, 'succeeded', $3
			 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1)`,
			[trip.chargeId, chargeRef, trip.paidAt]
		);

		if (trip.refund) {
			await ds.query(
				`INSERT INTO "payments" ("id", "booking_id", "amount", "type", "status", "review_status", "parent_payment_id", "succeeded_at", "created_at", "updated_at")
				 VALUES ($1, $2, $3, 'refund', 'succeeded', 'approved', $4, $5, $5::timestamptz - interval '1 day', $5)
				 ON CONFLICT ("id") DO NOTHING`,
				[trip.refund.id, trip.bookingId, money(refundMinor), trip.chargeId, trip.refund.succeededAt]
			);
			await ds.query(
				`INSERT INTO "payment_transactions" ("payment_id", "transaction_ref", "status", "raw_payload", "created_at")
				 SELECT $1, $2, 'succeeded', $3::jsonb, $4
				 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1)`,
				[
					trip.refund.id,
					providerRef("RF", trip.refund.succeededAt),
					JSON.stringify({ reason: trip.refund.reason }),
					trip.refund.succeededAt,
				]
			);
		}

		await ds.query(
			`INSERT INTO "settlements" ("trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at", "created_at", "updated_at")
			 VALUES ($1, $2, $3, '0.0500', $4, $5, $6, $6, $6)
			 ON CONFLICT ("trip_id") DO NOTHING`,
			[trip.id, host.id, money(baseMinor), money(feeMinor), money(netMinor), trip.settledAt]
		);
	}

	const areaCount = await backfillTripAreaSnapshots(ds);
	console.log(
		`[seed:revenue-analytics] ${HISTORY_TRIPS.length} settled Trips ensured; ${areaCount} Trips received an area snapshot.`
	);
}
