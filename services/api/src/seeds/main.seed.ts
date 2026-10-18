/**
 * CTMS MASTER DATABASE SEED SCRIPT
 *
 * Consolidates all seed scenarios into a single idempotent script:
 * 1. Admin & Porter Accounts
 * 2. Host & Baseline Trekking Route
 * 3. Trips, Campsites, Routes, Equipment Catalog, Campers & Bookings
 * 4. Weather Risk Assessment Scenarios (Green & Red routes)
 * 5. Camper Refund & Dispute Scenarios (Pre-trip cancellation, Post-completion complaint, Already refunded)
 * 6. Settlements, Host Wallets & Payout Requests
 */
import { hash } from "bcrypt";
import { DEFAULT_CANCELLATION_POLICY } from "../modules/bookings/cancellation-policy";
import dataSource from "../shared/database/data-source";
import { PORTER_SEED_FIXTURES } from "./porter.seed-fixtures";

const BCRYPT_COST_FACTOR = 10;

// ==========================================================================
// [0/6] CLEAN / WIPE DATABASE (FRESH SEED)
// ==========================================================================
export async function cleanDatabase(ds = dataSource): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[cleanDatabase] Refusing to truncate database in production!");
	}
	if (!ds.isInitialized) {
		await ds.initialize();
	}

	const tablesRes: Array<{ tablenames: string }> = await ds.query(`
		SELECT string_agg(quote_ident(tablename), ', ') as tablenames
		FROM pg_tables
		WHERE schemaname = 'public' 
		  AND tablename NOT IN ('migrations', 'spatial_ref_sys')
	`);

	if (tablesRes.length > 0 && tablesRes[0]?.tablenames) {
		const tableList = tablesRes[0].tablenames;
		console.log("[cleanDatabase] 🧹 Truncating all user tables with CASCADE...");
		await ds.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
		console.log(
			`[cleanDatabase] ✅ Successfully wiped ${tableList.split(",").length} tables clean (RESTART IDENTITY CASCADE).\n`
		);
	}
}

// ==========================================================================
// [1/6] ADMIN & PORTER ACCOUNTS
// ==========================================================================
interface SeedAccount {
	label: string;
	email: string;
	phone: string;
	password: string;
	role: "admin" | "porter" | "camper" | "host";
	fullName?: string;
	avatarUrl?: string;
	dateOfBirth?: string;
	address?: string;
	gender?: "male" | "female" | "other";
}

const SEED_ACCOUNTS: SeedAccount[] = [
	{
		label: "admin",
		email: "admin@ctms.local",
		phone: "0900000000",
		password: "Admin@123",
		role: "admin",
		fullName: "Quản trị viên hệ thống",
	},
	{
		label: "host",
		email: "host@ctms.local",
		phone: "0900000002",
		password: "Host@123",
		role: "host",
		fullName: "Host Ban Mai",
	},
	{
		label: "porter",
		email: "porter@ctms.local",
		phone: "0900000001",
		password: "Porter@123",
		role: "porter",
		fullName: "Porter Chuyên Nghiệp",
		avatarUrl: "https://i.pravatar.cc/160?img=12",
	},
	{
		label: "porter2",
		email: "porter2@ctms.local",
		phone: "0900000004",
		password: "Porter2@123",
		role: "porter",
		fullName: "Porter 2",
		avatarUrl: "https://i.pravatar.cc/160?img=68",
	},
	{
		label: "camper",
		email: "camper@ctms.local",
		phone: "0900000003",
		password: "Camper@123",
		role: "camper",
		fullName: "Camper Nguyễn Văn An",
		dateOfBirth: "1998-10-20",
		gender: "male",
		address: "Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
	},
];

export async function seedDevAdmin(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:dev-admin] Refusing to run with NODE_ENV=production.");
	}

	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}

	for (const account of SEED_ACCOUNTS) {
		await seedAccount(account);
	}
}

async function seedAccount(account: SeedAccount): Promise<void> {
	const existing: Array<{ id: string; email: string | null }> = await dataSource.query(
		'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[account.email, account.phone]
	);

	if (existing.length > 0) {
		await grantRole(existing[0].id, account.role);
		await dataSource.query(
			`UPDATE "users" 
			 SET "full_name" = COALESCE("full_name", $2), 
			     "avatar_url" = COALESCE("avatar_url", $3),
			     "date_of_birth" = COALESCE($4, "date_of_birth"),
			     "address" = COALESCE($5, "address"),
			     "gender" = COALESCE($6, "gender")
			 WHERE "id" = $1`,
			[
				existing[0].id,
				account.fullName ?? account.label,
				account.avatarUrl ?? null,
				account.dateOfBirth ?? null,
				account.address ?? null,
				account.gender ?? null,
			]
		);
		console.log(
			`[seed:dev-admin] ${account.label} already exists (id=${existing[0].id}, email=${existing[0].email}) — ensured role=${account.role}.`
		);
		return;
	}

	const passwordHash = await hash(account.password, BCRYPT_COST_FACTOR);

	const inserted: Array<{ id: string }> = await dataSource.query(
		`INSERT INTO "users" (email, phone, password_hash, role, status, full_name, avatar_url, date_of_birth, address, gender)
				 VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9)
			 ON CONFLICT (email) DO NOTHING
			 RETURNING id`,
		[
			account.email,
			account.phone,
			passwordHash,
			account.role,
			account.fullName ?? account.label,
			account.avatarUrl ?? null,
			account.dateOfBirth ?? null,
			account.address ?? null,
			account.gender ?? null,
		]
	);

	if (inserted.length === 0) {
		const concurrentExisting: Array<{ id: string; email: string | null }> = await dataSource.query(
			'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[account.email, account.phone]
		);
		if (concurrentExisting.length > 0) {
			await grantRole(concurrentExisting[0].id, account.role);
		}
		console.log(
			`[seed:dev-admin] ${account.label} insert skipped by ON CONFLICT — ensured role if row now exists.`
		);
		return;
	}

	await grantRole(inserted[0].id, account.role);
	console.log(
		`[seed:dev-admin] Created dev ${account.label} account (id=${inserted[0].id}, email=${account.email}).`
	);
}

async function grantRole(userId: string, role: SeedAccount["role"]): Promise<void> {
	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role")
		 VALUES ($1, $2)
		 ON CONFLICT ("user_id", "role") DO NOTHING`,
		[userId, role]
	);
}

// ==========================================================================
// [2/6] HOST & BASELINE TREKKING ROUTE
// ==========================================================================
export async function seedDevHostAndRoute(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:dev-host] Database initialized.");

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
		const passwordHash = await hash(hostPassword, BCRYPT_COST_FACTOR);
		await dataSource.query('UPDATE "users" SET password_hash = $1 WHERE id = $2', [
			passwordHash,
			hostId,
		]);
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

	// 2. Create active Trekking Route
	const routeName = "Đỉnh Núi Bidoup Trail";
	const existingRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
		[hostId, routeName]
	);

	if (existingRoute.length > 0) {
		console.log(`[seed:dev-host] Route already exists with ID: ${existingRoute[0].id}`);
	} else {
		const insertedRoute: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Cung đường trekking chinh phục đỉnh núi Bidoup', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2500, 'moderate', 180, 'active')
			 RETURNING id`,
			[hostId, routeName]
		);
		console.log(`[seed:dev-host] Created active Trekking Route with ID: ${insertedRoute[0].id}`);
	}

	console.log("[seed:dev-host] Seeding completed successfully!");
}

// ==========================================================================
// [3/6] FULL TRIPS ECOSYSTEM (EQUIPMENT, ROUTES, CAMPSITES, CAMPERS, TRIPS)
// ==========================================================================
export async function seedDevTrips(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:dev-trips] Database initialized.");

	try {
		// 1. Ensure Host user
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
			console.log(`[seed:dev-trips] Created Host user: ${hostId}`);
		}

		// 2. Ensure Equipment Catalog Items for Host
		const equipmentData = [
			{
				name: "Lều cắm trại 2 người Naturehike chống nước",
				category: "Lều bạt",
				quantityTotal: 15,
				rentalPricePerDay: 80000,
				maintenanceSchedule: "Kiểm tra khung nhôm và vải lều sau mỗi chuyến đi",
			},
			{
				name: "Lều cắm trại 4 người Coleman cao cấp",
				category: "Lều bạt",
				quantityTotal: 10,
				rentalPricePerDay: 140000,
				maintenanceSchedule: "Vệ sinh, phơi khô và kiểm tra cọc ghim định kỳ",
			},
			{
				name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)",
				category: "Túi & đệm ngủ",
				quantityTotal: 25,
				rentalPricePerDay: 40000,
				maintenanceSchedule: "Giặt sấy tiệt trùng sau mỗi lần sử dụng",
			},
			{
				name: "Đệm hơi cách nhiệt dã ngoại xếp gọn",
				category: "Túi & đệm ngủ",
				quantityTotal: 20,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Kiểm tra van khí và áp lực giữ hơi",
			},
			{
				name: "Balo trekking trợ lực 50L Deuter",
				category: "Balo & túi",
				quantityTotal: 12,
				rentalPricePerDay: 70000,
				maintenanceSchedule: "Kiểm tra hệ thống đai hông, khóa cài và khóa kéo",
			},
			{
				name: "Gậy leo núi Carbon siêu nhẹ (Cặp)",
				category: "Trang bị dã ngoại",
				quantityTotal: 30,
				rentalPricePerDay: 30000,
				maintenanceSchedule: "Kiểm tra khớp vặn khóa và đầu bọc cao su",
			},
			{
				name: "Đèn pin đội đầu chống nước IPX8 Black Diamond",
				category: "Đèn & chiếu sáng",
				quantityTotal: 25,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Sạc đầy pin lithium và kiểm tra roong chống nước",
			},
			{
				name: "Bếp ga dã ngoại mini và bộ nồi nhôm xếp gọn",
				category: "Dụng cụ nấu nướng",
				quantityTotal: 10,
				rentalPricePerDay: 65000,
				maintenanceSchedule: "Kiểm tra van ngắt an toàn và vệ sinh đầu đốt",
			},
			{
				name: "Bộ sơ cứu y tế sinh tồn Trekking",
				category: "An toàn & y tế",
				quantityTotal: 20,
				rentalPricePerDay: 25000,
				maintenanceSchedule: "Bổ sung gạc y tế và kiểm tra hạn thuốc sát khuẩn",
			},
		];

		for (const eq of equipmentData) {
			const existingEq: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "equipment_catalog_items" WHERE "host_id" = $1 AND "name" = $2',
				[hostId, eq.name]
			);
			if (existingEq.length > 0) {
				await dataSource.query(
					`UPDATE "equipment_catalog_items" SET
						category = $2,
						quantity_total = $3,
						rental_price_per_day = $4,
						status = 'active',
						maintenance_schedule = $5,
						updated_at = NOW()
					WHERE id = $1`,
					[
						existingEq[0].id,
						eq.category,
						eq.quantityTotal,
						eq.rentalPricePerDay,
						eq.maintenanceSchedule,
					]
				);
			} else {
				await dataSource.query(
					`INSERT INTO "equipment_catalog_items" (
						host_id, name, category, quantity_total, rental_price_per_day, status, maintenance_schedule
					) VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
					[
						hostId,
						eq.name,
						eq.category,
						eq.quantityTotal,
						eq.rentalPricePerDay,
						eq.maintenanceSchedule,
					]
				);
				console.log(`[seed:dev-trips] Created equipment item: ${eq.name}`);
			}
		}

		// 3. Ensure active Trekking Routes around Da Nang
		const routesData = [
			{
				name: "Bán Đảo Sơn Trà Discovery",
				legacyNames: ["Bán Đảo Sơn Trà Discovery"],
				description:
					"Cung đường ven biển và rừng nguyên sinh Sơn Trà, khám phá Đỉnh Bàn Cờ và Mũi Nghê, thích hợp cho người mới bắt đầu.",
				lengthMeters: 5200,
				difficulty: "easy",
				durationMinutes: 240,
				geom: "SRID=4326;LINESTRING(108.260 16.110, 108.280 16.120, 108.300 16.110)",
			},
			{
				name: "Hải Vân Pass - Nam Hải Vân Trail",
				legacyNames: ["Đỉnh Núi Bidoup Trail", "Hải Vân Pass - Nam Hải Vân Trail"],
				description:
					"Tuyến trekking dọc sườn núi Hải Vân hùng vĩ, ngắm trọn vịnh Làng Vân hoang sơ và biển Đà Nẵng từ trên cao.",
				lengthMeters: 9500,
				difficulty: "moderate",
				durationMinutes: 360,
				geom: "SRID=4326;LINESTRING(108.130 16.185, 108.138 16.195, 108.145 16.205, 108.150 16.210)",
			},
			{
				name: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				legacyNames: ["Bạch Mộc Lương Tử Expedition", "Rừng Nguyên Sinh Bà Nà - Núi Chúa"],
				description:
					"Hành trình thám hiểm lõi rừng nguyên sinh Bà Nà - Núi Chúa, chinh phục các dốc đá và hệ sinh thái nhiệt đới đặc sắc.",
				lengthMeters: 16000,
				difficulty: "hard",
				durationMinutes: 720,
				geom: "SRID=4326;LINESTRING(108.010 15.990, 108.018 16.002, 108.025 16.015, 108.030 16.025)",
			},
			{
				name: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				legacyNames: [
					"Tà Năng - Phan Dũng Cung Đường Huyền Thoại",
					"Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				],
				description:
					"Cung đường trekking lội suối, vượt ghềnh đá Khe Ram, xuyên rừng đại ngàn thung lũng sông Cu Đê xã Hòa Bắc.",
				lengthMeters: 22000,
				difficulty: "expert",
				durationMinutes: 1080,
				geom: "SRID=4326;LINESTRING(108.020 16.090, 108.035 16.105, 108.050 16.120, 108.065 16.135)",
			},
		];

		const routeIds: Record<string, string> = {};

		for (const r of routesData) {
			const existing: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trekking_routes" WHERE "name" = ANY($1)',
				[r.legacyNames]
			);
			if (existing.length > 0) {
				const existingId = existing[0].id;
				await dataSource.query(
					`UPDATE "trekking_routes" SET
						name = $2,
						description = $3,
						route_geom = ST_GeogFromText($4),
						length_meters = $5,
						difficulty = $6,
						expected_duration_minutes = $7,
						status = 'active',
						updated_at = NOW()
					WHERE id = $1`,
					[
						existingId,
						r.name,
						r.description,
						r.geom,
						r.lengthMeters,
						r.difficulty,
						r.durationMinutes,
					]
				);
				routeIds[r.name] = existingId;
				console.log(`[seed:dev-trips] Updated route: ${r.name} (${existingId})`);
			} else {
				const inserted: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
					 VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, 'active')
					 RETURNING id`,
					[hostId, r.name, r.description, r.geom, r.lengthMeters, r.difficulty, r.durationMinutes]
				);
				routeIds[r.name] = inserted[0].id;
				console.log(`[seed:dev-trips] Created route: ${r.name} (${inserted[0].id})`);
			}
		}

		// 4. Ensure weather risk assessments for all Da Nang routes
		const existingRules: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "weather_risk_rules" ORDER BY "created_at" DESC LIMIT 1'
		);
		let ruleVersionId = "";
		if (existingRules.length > 0) {
			ruleVersionId = existingRules[0].id;
		} else {
			const insertedRule: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "weather_risk_rules" (
					"rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold",
					"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
					"visibility_yellow_threshold", "visibility_red_threshold",
					"thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
					"green_max_score", "yellow_max_score",
					"is_active", "created_by"
				) VALUES (
					10.0, 50.0,
					40.0, 70.0,
					5.0, 0.0, 38.0, 42.0,
					5000.0, 1000.0,
					true, true,
					0.30, 0.25, 0.15, 0.15, 0.15,
					0.5, 1.2,
					true, $1
				) RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		const weatherRisks = [
			{
				routeName: "Bán Đảo Sơn Trà Discovery",
				riskLevel: "green",
				score: 0.15,
			},
			{
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				riskLevel: "yellow",
				score: 0.45,
			},
			{
				routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				riskLevel: "green",
				score: 0.2,
			},
			{
				routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				riskLevel: "red",
				score: 0.78,
			},
		];

		for (const wr of weatherRisks) {
			const rId = routeIds[wr.routeName];
			if (!rId) continue;
			const existing = await dataSource.query(
				'SELECT "id" FROM "weather_risk_assessments" WHERE "route_id" = $1',
				[rId]
			);
			if (existing.length === 0) {
				const snapshotRes: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "weather_snapshots" (route_id, status, observed_at, rainfall_mm, wind_kph, temperature_c, visibility_m, thunderstorm)
					 VALUES ($1, 'success', NOW(), $2, $3, $4, $5, $6)
					 RETURNING id`,
					[
						rId,
						wr.riskLevel === "red" ? 150 : wr.riskLevel === "yellow" ? 30 : 0,
						wr.riskLevel === "red" ? 65 : wr.riskLevel === "yellow" ? 35 : 10,
						24,
						10000,
						wr.riskLevel === "red",
					]
				);
				const snapshotId = snapshotRes[0].id;
				await dataSource.query(
					`INSERT INTO "weather_risk_assessments" (route_id, snapshot_id, rule_version_id, risk_level, composite_score, criteria_scores, created_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[
						rId,
						snapshotId,
						ruleVersionId,
						wr.riskLevel,
						wr.score,
						JSON.stringify({
							rainfall: {
								value: 0,
								level: wr.riskLevel,
								weight: 0.3,
								score: 0,
							},
							wind: { value: 10, level: wr.riskLevel, weight: 0.25, score: 0 },
							temperature: {
								value: 24,
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
							visibility: {
								value: 10000,
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
							thunderstorm: {
								value: wr.riskLevel === "red",
								level: wr.riskLevel,
								weight: 0.15,
								score: 0,
							},
						}),
						hostId,
					]
				);
				console.log(
					`[seed:dev-trips] Created weather risk assessment for ${wr.routeName}: ${wr.riskLevel}`
				);
			}
		}

		// 5. Clean up obsolete legacy trips
		await dataSource.query(
			`UPDATE "trips"
			 SET "status" = 'cancelled'
			 WHERE "title" IN (
				'Khám Phá Sơn Trà Xanh Trong Ngày',
				'Chinh Phục Đỉnh Núi Bidoup - 2 Ngày 1 Đêm',
				'Tà Năng - Phan Dũng: Thử Thách Băng Rừng Đồi Cỏ',
				'Bạch Mộc Lương Tử - Săn Mây Đại Ngàn (Đã Hết Chỗ)'
			 )`
		);

		// 6. Seed published Trips with fresh dates calculated from NOW (Da Nang locations only)
		const now = new Date();
		const inDays = (d: number, hours = 7) => {
			const date = new Date(now.getTime() + d * 86400000);
			date.setHours(hours, 0, 0, 0);
			return date.toISOString();
		};
		const inHours = (h: number) => {
			const date = new Date(now.getTime() + h * 3600000);
			return date.toISOString();
		};

		const sampleTrips = [
			// Scenario 1: Normal capacity (12 seats remaining)
			{
				title: "[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
				legacyTitles: [
					"[CTMS-024] Khám Phá Sơn Trà (Bình thường - Còn 12 chỗ)",
					"[CTMS-024] Khám Phá Bán Đảo Sơn Trà (Bình thường - Còn 12 chỗ)",
				],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Chuyến đi bộ dã ngoại trong ngày ngắm voọc chà vá chân nâu và Đỉnh Bàn Cờ tại bán đảo Sơn Trà, Đà Nẵng. Trạng thái bình thường, còn nhiều chỗ trống.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: inDays(4, 7),
				endsAt: inDays(4, 16),
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: inDays(4, 6),
				bookingDeadline: inDays(3, 18),
				capacityMin: 5,
				capacityMax: 20,
				seatsTaken: 8,
				pricePerPerson: "450000",
				itinerary: {
					summary:
						"06:30 tập trung Chùa Linh Ứng, 07:00 bắt đầu trekking, 11:30 picnic trưa Bãi Rạng, 16:00 kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chùa Linh Ứng - Sơn Trà",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Trạm quan sát Đỉnh Bàn Cờ",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Bãi Rạng - Nghỉ chân & Ăn trưa",
						type: "meal",
						day: 1,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.290 16.115)",
					},
					{
						name: "Về lại chân núi Sơn Trà",
						type: "finish",
						day: 1,
						seq: 4,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
			// Scenario 2: Low capacity urgency (<= 3 seats remaining -> exactly 2 remaining)
			{
				title: "[CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)",
				legacyTitles: [
					"[CTMS-024] Đỉnh Núi Bidoup Trail (Khẩn cấp: Chỉ còn 2 chỗ)",
					"[CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)",
				],
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				description:
					"Hành trình trekking 2N1Đ vượt sườn đèo Hải Vân và cắm trại vịnh biển Làng Vân hoang sơ dưới chân đèo. Số lượng chỗ sắp hết, chỉ còn 2 vé cuối cùng!",
				coverImageUrl:
					"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(6, 6),
				endsAt: inDays(7, 16),
				meetingPointGeom: "SRID=4326;POINT(108.130 16.185)",
				meetingAt: inDays(6, 5),
				bookingDeadline: inDays(4, 23),
				capacityMin: 5,
				capacityMax: 10,
				seatsTaken: 8,
				pricePerPerson: "1650000",
				itinerary: {
					summary:
						"Ngày 1: Chân đèo Hải Vân - Cửa Rừng Nam Hải Vân - Hạ trại Bãi Biển Làng Vân. Ngày 2: Đón bình minh biển - Lên đồn Nhất Hải Vân Quan - Kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chân đèo Hải Vân - Hòa Hiệp Bắc",
						type: "start",
						day: 1,
						seq: 1,
						duration: 45,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
					{
						name: "Rừng dẻ Nam Hải Vân",
						type: "rest",
						day: 1,
						seq: 2,
						duration: 30,
						geom: "SRID=4326;POINT(108.138 16.195)",
					},
					{
						name: "Bãi biển Làng Vân - Cắm trại đêm",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.145 16.205)",
					},
					{
						name: "Đỉnh Hải Vân Quan lịch sử",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 90,
						geom: "SRID=4326;POINT(108.132 16.198)",
					},
					{
						name: "Xuống chân đèo - Kết thúc hành trình",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 60,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
				],
			},
			// Scenario 3: Completely Sold Out (seatsTaken == capacityMax -> 0 seats)
			{
				title: "[CTMS-024] Thám Hiểm Rừng Bà Nà - Núi Chúa (Đã Hết Chỗ - 0 chỗ)",
				legacyTitles: [
					"[CTMS-024] Bạch Mộc Lương Tử Expedition (Đã Hết Chỗ - 0 chỗ)",
					"[CTMS-024] Thám Hiểm Rừng Bà Nà - Núi Chúa (Đã Hết Chỗ - 0 chỗ)",
				],
				routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa",
				description:
					"Cung trekking thám hiểm lõi rừng nguyên sinh Bà Nà - Núi Chúa tại huyện Hòa Vang, Đà Nẵng. Đã đủ 10/10 khách tham gia, toàn bộ chỗ đã được đặt kín.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(8, 6),
				endsAt: inDays(9, 17),
				meetingPointGeom: "SRID=4326;POINT(108.010 15.990)",
				meetingAt: inDays(8, 5),
				bookingDeadline: inDays(6, 18),
				capacityMin: 6,
				capacityMax: 10,
				seatsTaken: 10,
				pricePerPerson: "2200000",
				itinerary: {
					summary:
						"Ngày 1: Trạm Kiểm lâm Hòa Ninh - Lán Thác Tóc Tiên - Cắm trại đêm. Ngày 2: Chinh phục đỉnh Núi Chúa 1.487m - Xuống núi.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Trạm Kiểm lâm Hòa Ninh - Hòa Vang",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.010 15.990)",
					},
					{
						name: "Thung lũng Rừng Mơ",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 45,
						geom: "SRID=4326;POINT(108.018 16.002)",
					},
					{
						name: "Lán cắm trại Thác Tóc Tiên",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.025 16.015)",
					},
					{
						name: "Đỉnh Núi Chúa 1.487m",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 120,
						geom: "SRID=4326;POINT(108.030 16.025)",
					},
					{
						name: "Về lại Trạm Kiểm lâm",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 60,
						geom: "SRID=4326;POINT(108.010 15.990)",
					},
				],
			},
			// Scenario 4: Deadline approaching soon (< 24 hours -> 8 hours left)
			{
				title: "[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
				legacyTitles: [
					"[CTMS-024] Tà Năng - Phan Dũng (Sắp hết hạn đặt chỗ - Còn 8h)",
					"[CTMS-024] Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn - Còn 8h)",
				],
				routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc",
				description:
					"Cung trekking băng rừng thung lũng sông Cu Đê, vượt suối ghềnh đá Khe Ram tại Hòa Bắc, Đà Nẵng. Hạn chốt danh sách người tham gia sẽ đóng trong 8 giờ tới.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(2, 6),
				endsAt: inDays(3, 17),
				meetingPointGeom: "SRID=4326;POINT(108.020 16.090)",
				meetingAt: inDays(2, 5),
				bookingDeadline: inHours(8),
				capacityMin: 6,
				capacityMax: 15,
				seatsTaken: 5,
				pricePerPerson: "1850000",
				itinerary: {
					summary:
						"Ngày 1: Thôn Tà Lang - Lội suối Khe Ram - Cắm trại bãi cỏ Thác Mơ. Ngày 2: Khám phá Vách Đá Trắng - Trở về trạm sinh thái Hòa Bắc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Nhà Gươl Thôn Tà Lang - Hòa Bắc",
						type: "start",
						day: 1,
						seq: 1,
						duration: 40,
						geom: "SRID=4326;POINT(108.020 16.090)",
					},
					{
						name: "Ghềnh đá Khe Ram",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.035 16.105)",
					},
					{
						name: "Bãi cỏ Thác Mơ - Cắm trại đêm",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.050 16.120)",
					},
					{
						name: "Vách Đá Trắng Hoang Sơ",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 90,
						geom: "SRID=4326;POINT(108.065 16.135)",
					},
					{
						name: "Trạm Sinh Thái Hòa Bắc - Kết thúc",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 45,
						geom: "SRID=4326;POINT(108.020 16.090)",
					},
				],
			},
			// Scenario 5: Past booking deadline (Deadline was 2 hours ago -> booking closed)
			{
				title: "[CTMS-024] Sơn Trà Sunset Trekking Mũi Nghê (Đã Hết Hạn Đặt Vé)",
				legacyTitles: [
					"[CTMS-024] Sơn Trà Sunset Trek (Đã Hết Hạn Đặt Vé)",
					"[CTMS-024] Sơn Trà Sunset Trekking Mũi Nghê (Đã Hết Hạn Đặt Vé)",
				],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Chuyến đi bộ ngắm hoàng hôn rực rỡ tại Mũi Nghê Sơn Trà đã qua hạn chốt danh sách người tham gia (đóng từ 2 giờ trước). Không thể đăng ký thêm.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: inDays(2, 14),
				endsAt: inDays(2, 18),
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: inDays(2, 13),
				bookingDeadline: inHours(-2),
				capacityMin: 4,
				capacityMax: 12,
				seatsTaken: 4,
				pricePerPerson: "350000",
				itinerary: {
					summary:
						"14:00 tập kết Bãi Trẹm, 15:00 trekking ngắm hoàng hôn Mũi Nghê, 18:00 kết thúc.",
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Bãi Trẹm - Sơn Trà",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Mũi Nghê ngắm hoàng hôn vịnh biển",
						type: "activity",
						day: 1,
						seq: 2,
						duration: 90,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Kết thúc hành trình tại Bãi Trẹm",
						type: "finish",
						day: 1,
						seq: 3,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
			// Scenario 6: December 2026 Trekking & Equipment Rental Test (Overnight 2D1N)
			{
				title: "[Tháng 12] Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân",
				legacyTitles: ["[Tháng 12] Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân"],
				routeName: "Hải Vân Pass - Nam Hải Vân Trail",
				description:
					"Chuyến đi trekking khám phá đèo Hải Vân và cắm trại đêm tại bãi biển hoang sơ Vịnh Làng Vân vào tháng 12/2026. Thích hợp thuê lều, túi ngủ, đèn pin dã ngoại và test thanh toán trực tuyến.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: "2026-12-19T06:00:00.000Z",
				endsAt: "2026-12-20T17:00:00.000Z",
				meetingPointGeom: "SRID=4326;POINT(108.130 16.185)",
				meetingAt: "2026-12-19T05:30:00.000Z",
				bookingDeadline: "2026-12-18T18:00:00.000Z",
				capacityMin: 4,
				capacityMax: 20,
				seatsTaken: 2,
				pricePerPerson: "1200000",
				itinerary: {
					summary:
						"Ngày 1: Tập kết chân đèo Hải Vân, trekking xuyên rừng dẻ xuống Vịnh Làng Vân, dựng trại và tiệc BBQ bãi biển. Ngày 2: Đón bình minh, khám phá Hải Vân Quan, kết thúc hành trình.",
					images: [
						"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80",
					],
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chân đèo Hải Vân",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
					{
						name: "Bãi biển Làng Vân - Hạ trại & BBQ",
						type: "overnight",
						day: 1,
						seq: 2,
						duration: 600,
						geom: "SRID=4326;POINT(108.145 16.205)",
					},
					{
						name: "Di tích Hải Vân Quan",
						type: "activity",
						day: 2,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.132 16.198)",
					},
					{
						name: "Về lại chân đèo Hải Vân",
						type: "finish",
						day: 2,
						seq: 4,
						duration: 45,
						geom: "SRID=4326;POINT(108.130 16.185)",
					},
				],
			},
			// Scenario 7: December 2026 Day Trip Test
			{
				title: "[Tháng 12] Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ",
				legacyTitles: ["[Tháng 12] Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ"],
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Trekking khám phá thảm thực vật bán đảo Sơn Trà trong tiết trời dịu mát của tháng 12/2026. Lộ trình nhẹ nhàng, dễ đi, có sẵn nhiều thiết bị hỗ trợ trợ lực gậy trekking, balo cho thuê.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: "2026-12-12T07:00:00.000Z",
				endsAt: "2026-12-12T16:00:00.000Z",
				meetingPointGeom: "SRID=4326;POINT(108.260 16.110)",
				meetingAt: "2026-12-12T06:30:00.000Z",
				bookingDeadline: "2026-12-11T18:00:00.000Z",
				capacityMin: 2,
				capacityMax: 25,
				seatsTaken: 5,
				pricePerPerson: "450000",
				itinerary: {
					summary:
						"06:30 tập trung Chùa Linh Ứng, 07:00 trekking đường mòn râm mát, 11:30 ngắm vịnh Đà Nẵng tại Đỉnh Bàn Cờ và ăn trưa picnic, 16:00 kết thúc.",
					images: [
						"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
						"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
					],
				},
				includes: null,
				excludes: null,
				cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
				waypoints: [
					{
						name: "Điểm tập kết Chùa Linh Ứng",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
					{
						name: "Đỉnh Bàn Cờ - Ngắm toàn cảnh",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.280 16.120)",
					},
					{
						name: "Khu vực Bãi Rạng - Nghỉ trưa",
						type: "meal",
						day: 1,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.290 16.115)",
					},
					{
						name: "Về lại điểm xuất phát",
						type: "finish",
						day: 1,
						seq: 4,
						duration: 30,
						geom: "SRID=4326;POINT(108.260 16.110)",
					},
				],
			},
		];

		for (const st of sampleTrips) {
			const routeId = routeIds[st.routeName];
			if (!routeId) {
				console.warn(`[seed:dev-trips] Route not found for ${st.routeName}`);
				continue;
			}

			const existingTrip: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trips" WHERE "title" = ANY($1)',
				[st.legacyTitles]
			);

			let tripId = "";
			if (existingTrip.length > 0) {
				tripId = existingTrip[0].id;
				await dataSource.query(
					`UPDATE "trips" SET
						route_id = $2,
						title = $3,
						description = $4,
						cover_image_url = $5,
						trip_type = $6,
						duration_nights = $7,
						starts_at = $8,
						ends_at = $9,
						meeting_point = ST_GeogFromText($10),
						meeting_at = $11,
						booking_deadline = $12,
						capacity_min = $13,
						capacity_max = $14,
						seats_taken = GREATEST($15, (
							SELECT COALESCE(SUM(b.num_people), 0)
							FROM bookings b
							WHERE b.trip_id = $1 AND b.status IN ('confirmed', 'pending_payment')
						)),
						price_per_person = $16,
						itinerary = $17::jsonb,
						includes = $18::jsonb,
						excludes = $19::jsonb,
						cancellation_policy = $20::jsonb,
						status = 'published',
						updated_at = NOW()
					WHERE id = $1`,
					[
						tripId,
						routeId,
						st.title,
						st.description,
						st.coverImageUrl,
						st.tripType,
						st.durationNights,
						st.startsAt,
						st.endsAt,
						st.meetingPointGeom,
						st.meetingAt,
						st.bookingDeadline,
						st.capacityMin,
						st.capacityMax,
						st.seatsTaken,
						st.pricePerPerson,
						JSON.stringify(st.itinerary),
						st.includes ? JSON.stringify(st.includes) : null,
						st.excludes ? JSON.stringify(st.excludes) : null,
						JSON.stringify(st.cancellationPolicy),
					]
				);
				console.log(`[seed:dev-trips] Updated trip for scenario: ${st.title} (${tripId})`);
			} else {
				const insertedTrip: Array<{ id: string }> = await dataSource.query(
					`INSERT INTO "trips" (
						host_id, route_id, title, description, cover_image_url,
						trip_type, duration_nights, starts_at, ends_at,
						meeting_point, meeting_at, booking_deadline,
						capacity_min, capacity_max, seats_taken, price_per_person,
						itinerary, includes, excludes, cancellation_policy, status
					) VALUES (
						$1, $2, $3, $4, $5,
						$6, $7, $8, $9,
						ST_GeogFromText($10), $11, $12,
						$13, $14, $15, $16,
						$17, $18, $19, $20, 'published'
					) RETURNING id`,
					[
						hostId,
						routeId,
						st.title,
						st.description,
						st.coverImageUrl,
						st.tripType,
						st.durationNights,
						st.startsAt,
						st.endsAt,
						st.meetingPointGeom,
						st.meetingAt,
						st.bookingDeadline,
						st.capacityMin,
						st.capacityMax,
						st.seatsTaken,
						st.pricePerPerson,
						JSON.stringify(st.itinerary),
						st.includes ? JSON.stringify(st.includes) : null,
						st.excludes ? JSON.stringify(st.excludes) : null,
						JSON.stringify(st.cancellationPolicy),
					]
				);
				tripId = insertedTrip[0].id;
				console.log(`[seed:dev-trips] Created published trip: ${st.title} (${tripId})`);
			}

			// Refresh waypoints for the trip
			await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = $1', [tripId]);
			for (const wp of st.waypoints) {
				await dataSource.query(
					`INSERT INTO "trip_waypoints" (
						trip_id, type, name, location, day_number, sequence_order, duration_minutes
					) VALUES (
						$1, $2, $3, ST_GeogFromText($4), $5, $6, $7
					)`,
					[tripId, wp.type, wp.name, wp.geom, wp.day, wp.seq, wp.duration]
				);
			}
		}

		// Ensure completed demo trips (e.g. Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại) have cover images
		await dataSource.query(`
			UPDATE "trips"
			SET "cover_image_url" = COALESCE("cover_image_url", 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80')
			WHERE "title" ILIKE '%Khiếu Nại%' OR "id" IN (
				'01e326fb-b463-4e36-88aa-265320888f4e',
				'476e6c30-2e43-4db4-863f-e593be61939b'
			)
		`);

		// Seed Route Checkpoints & Danger Zones
		await seedRouteCheckpointsAndDangerZones(routeIds);

		// Seed Diverse Trip & Route Statuses (Pending Approval, Draft, Cancelled, Closed)
		await seedDiverseTripAndRouteStatuses(hostId, routeIds);

		// Seed Porter Profiles, Qualifications & Assignments
		await seedPorterProfileAndAssignments(routeIds);

		// Seed Camper Health Profiles & Emergency Contacts
		await seedCamperHealthAndContacts();

		// Seed extra members for check-in testing (present/absent)
		await seedDemoBookingMembers();

		// Seed multi-person bookings with equipment rentals for host@ctms.local
		await seedHostGroupBookingsWithEquipment();

		console.log("[seed:dev-trips] Seeding completed successfully!");
	} catch (error) {
		console.error("[seed:dev-trips] Error seeding trips:", error);
	}
}

async function seedDemoBookingMembers(): Promise<void> {
	const demoCampers = [
		{
			email: "camper.lan@ctms.local",
			phone: "0900000011",
			name: "Trần Thị Lan",
		},
		{
			email: "camper.nam@ctms.local",
			phone: "0900000012",
			name: "Lê Hoàng Nam",
		},
		{
			email: "camper.tuan@ctms.local",
			phone: "0900000013",
			name: "Phạm Minh Tuấn",
		},
		{
			email: "camper.nhu@ctms.local",
			phone: "0900000014",
			name: "Võ Quỳnh Như",
		},
	];

	const passwordHash = await hash("Camper@123", BCRYPT_COST_FACTOR);
	const userMap = new Map<string, string>();

	for (const c of demoCampers) {
		const existing: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[c.email, c.phone]
		);
		let userId = "";
		if (existing.length > 0) {
			userId = existing[0].id;
			await dataSource.query(
				'UPDATE "users" SET "full_name" = $2, "role" = \'camper\', "status" = \'active\' WHERE "id" = $1',
				[userId, c.name]
			);
		} else {
			const inserted: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name)
				 VALUES ($1, $2, $3, 'camper', 'active', $4) RETURNING id`,
				[c.email, c.phone, passwordHash, c.name]
			);
			userId = inserted[0].id;
		}
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'camper') ON CONFLICT DO NOTHING`,
			[userId]
		);
		userMap.set(c.email, userId);
	}

	// Target trip: [CTMS-024] Hải Vân Quan - Vịnh Làng Vân (Khẩn cấp: Chỉ còn 2 chỗ)
	const tripRows: Array<{
		id: string;
		starts_at: Date;
		ends_at: Date;
		price_per_person: string | number;
	}> = await dataSource.query(
		'SELECT "id", "starts_at", "ends_at", "price_per_person" FROM "trips" WHERE "id" = $1 OR "title" ILIKE \'%Chỉ còn 2 chỗ%\' LIMIT 1',
		["467797d6-3ae5-43aa-9849-c65701680b32"]
	);
	if (tripRows.length === 0) return;
	const trip = tripRows[0];
	const tripId = trip.id;

	// Primary Demo Camper: camper@ctms.local (Nguyễn Văn An)
	const mainCamperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	const mainCamperId = mainCamperRows.length > 0 ? mainCamperRows[0].id : null;

	if (mainCamperId) {
		await ensureBookingWithMembers(tripId, mainCamperId, trip, [
			{ userId: mainCamperId, isPrimary: true },
		]);
	}

	// Booking 1: Lan (Single member)
	const lanId = userMap.get("camper.lan@ctms.local");
	if (lanId) {
		await ensureBookingWithMembers(tripId, lanId, trip, [{ userId: lanId, isPrimary: true }]);
	}

	// Booking 2: Nam (Single member)
	const namId = userMap.get("camper.nam@ctms.local");
	if (namId) {
		await ensureBookingWithMembers(tripId, namId, trip, [{ userId: namId, isPrimary: true }]);
	}

	// Booking 3: Tuấn + Như (Group 2 members)
	const tuanId = userMap.get("camper.tuan@ctms.local");
	const nhuId = userMap.get("camper.nhu@ctms.local");
	if (tuanId && nhuId) {
		await ensureBookingWithMembers(tripId, tuanId, trip, [
			{ userId: tuanId, isPrimary: true },
			{ userId: nhuId, isPrimary: false },
		]);
	}

	// Reset all members of this trip back to 'registered' so test is fresh
	await dataSource.query(
		`UPDATE "booking_members"
		 SET "member_status" = 'registered', "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
		 WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1)`,
		[tripId]
	);

	await dataSource.query(
		`UPDATE "bookings"
		 SET "status" = 'confirmed'
		 WHERE "trip_id" = $1 AND "status" != 'cancelled'`,
		[tripId]
	);

	console.log(`[seed:dev-trips] Seeded demo check-in roster members for trip: ${tripId}`);

	// Also seed for ongoing trip (Sơn Trà Sunset)
	// Sets starts_at = NOW() - interval '2 hours' so [Không tham gia] (no_show) can be tested directly
	await dataSource.query(`
		UPDATE "trips"
		SET "status" = 'ongoing',
		    "booking_deadline" = NOW() - interval '1 day',
		    "meeting_at" = NOW() - interval '3 hours',
		    "starts_at" = NOW() - interval '2 hours',
		    "ends_at" = NOW() + interval '4 hours'
		WHERE "title" ILIKE '%Sơn Trà Sunset%' OR "title" ILIKE '%Hết Hạn Đặt Vé%'
	`);

	const ongoingTripRows: Array<{
		id: string;
		starts_at: Date;
		ends_at: Date;
		price_per_person: string | number;
	}> = await dataSource.query(`
		SELECT "id", "starts_at", "ends_at", "price_per_person"
		FROM "trips"
		WHERE "title" ILIKE '%Sơn Trà Sunset%' OR "title" ILIKE '%Hết Hạn Đặt Vé%'
		LIMIT 1
	`);

	if (ongoingTripRows.length > 0) {
		const ongoingTrip = ongoingTripRows[0];
		if (mainCamperId) {
			await ensureBookingWithMembers(ongoingTrip.id, mainCamperId, ongoingTrip, [
				{ userId: mainCamperId, isPrimary: true },
			]);
		}
		if (lanId) {
			await ensureBookingWithMembers(ongoingTrip.id, lanId, ongoingTrip, [
				{ userId: lanId, isPrimary: true },
			]);
		}
		if (namId) {
			await ensureBookingWithMembers(ongoingTrip.id, namId, ongoingTrip, [
				{ userId: namId, isPrimary: true },
			]);
		}
		if (tuanId && nhuId) {
			await ensureBookingWithMembers(ongoingTrip.id, tuanId, ongoingTrip, [
				{ userId: tuanId, isPrimary: true },
				{ userId: nhuId, isPrimary: false },
			]);
		}
		await dataSource.query(
			`UPDATE "booking_members"
			 SET "member_status" = 'registered', "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
			 WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1)`,
			[ongoingTrip.id]
		);
		await dataSource.query(
			`UPDATE "bookings"
			 SET "status" = 'confirmed'
			 WHERE "trip_id" = $1 AND "status" != 'cancelled'`,
			[ongoingTrip.id]
		);
		console.log(`[seed:dev-trips] Seeded ongoing demo trip for no-show testing: ${ongoingTrip.id}`);
	}
}

async function ensureBookingWithMembers(
	tripId: string,
	ownerId: string,
	trip: { starts_at: Date; ends_at: Date; price_per_person: string | number },
	members: Array<{ userId: string; isPrimary: boolean }>
): Promise<void> {
	const existingBooking: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2',
		[tripId, ownerId]
	);

	let bookingId = "";
	if (existingBooking.length > 0) {
		bookingId = existingBooking[0].id;
		await dataSource.query(
			`UPDATE "bookings"
			 SET "status" = 'confirmed', "payment_status" = 'paid', "num_people" = $2
			 WHERE "id" = $1`,
			[bookingId, members.length]
		);
	} else {
		const price = Number(trip.price_per_person) || 1650000;
		const total = price * members.length;
		const inserted: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "bookings" (
				trip_id, user_id, num_people, status, payment_status,
				trip_starts_at_snapshot, trip_ends_at_snapshot, base_price, total_amount
			) VALUES (
				$1, $2, $3, 'confirmed', 'paid',
				$4, $5, $6, $7
			) RETURNING id`,
			[tripId, ownerId, members.length, trip.starts_at, trip.ends_at, price, total]
		);
		bookingId = inserted[0].id;
	}

	for (const m of members) {
		const existingMember: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" = $2',
			[bookingId, m.userId]
		);
		if (existingMember.length > 0) {
			await dataSource.query(
				`UPDATE "booking_members"
				 SET "member_status" = 'registered', "is_primary" = $2, "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
				 WHERE "id" = $1`,
				[existingMember[0].id, m.isPrimary]
			);
		} else {
			await dataSource.query(
				`INSERT INTO "booking_members" (
					booking_id, user_id, is_primary, member_status
				) VALUES ($1, $2, $3, 'registered')`,
				[bookingId, m.userId, m.isPrimary]
			);
		}
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Multi-person Bookings with Equipment Rentals for host@ctms.local
// --------------------------------------------------------------------------
export async function seedHostGroupBookingsWithEquipment(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log(
		"[seed:group-bookings] Seeding multi-person bookings with equipment rentals for host@ctms.local..."
	);

	const hostRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["host@ctms.local"]
	);
	if (hostRows.length === 0) {
		console.warn("[seed:group-bookings] Host host@ctms.local not found, skipping.");
		return;
	}
	const hostId = hostRows[0].id;

	// 1. Ensure all demo campers exist with full profiles
	const demoCampers: Array<{
		email: string;
		phone: string;
		name: string;
		dateOfBirth: string;
		gender: "male" | "female" | "other";
		address: string;
	}> = [
		{
			email: "camper.lan@ctms.local",
			phone: "0900000011",
			name: "Trần Thị Lan",
			dateOfBirth: "1999-05-15",
			gender: "female",
			address: "Số 45 Lê Duẩn, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.nam@ctms.local",
			phone: "0900000012",
			name: "Lê Hoàng Nam",
			dateOfBirth: "1997-08-22",
			gender: "male",
			address: "Số 88 Hùng Vương, Quận Thanh Khê, TP. Đà Nẵng",
		},
		{
			email: "camper.tuan@ctms.local",
			phone: "0900000013",
			name: "Phạm Minh Tuấn",
			dateOfBirth: "1995-12-03",
			gender: "male",
			address: "Số 12 Quang Trung, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.nhu@ctms.local",
			phone: "0900000014",
			name: "Võ Quỳnh Như",
			dateOfBirth: "2000-03-18",
			gender: "female",
			address: "Số 32 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.long@ctms.local",
			phone: "0900000021",
			name: "Đỗ Hoàng Long",
			dateOfBirth: "1996-07-09",
			gender: "male",
			address: "Số 56 Bạch Đằng, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.maianh@ctms.local",
			phone: "0900000022",
			name: "Ngô Mai Anh",
			dateOfBirth: "1998-11-25",
			gender: "female",
			address: "Số 102 Trần Phú, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.bao@ctms.local",
			phone: "0900000023",
			name: "Trịnh Quốc Bảo",
			dateOfBirth: "1994-01-30",
			gender: "male",
			address: "Số 77 Điện Biên Phủ, Quận Thanh Khê, TP. Đà Nẵng",
		},
		{
			email: "camper.thao@ctms.local",
			phone: "0900000024",
			name: "Đinh Thu Thảo",
			dateOfBirth: "2001-09-14",
			gender: "female",
			address: "Số 204 Nguyễn Tri Phương, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.linh@ctms.local",
			phone: "0900000025",
			name: "Bùi Phương Linh",
			dateOfBirth: "1997-04-12",
			gender: "female",
			address: "Số 33 Phan Châu Trinh, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.dung@ctms.local",
			phone: "0900000026",
			name: "Lý Thế Dũng",
			dateOfBirth: "1995-10-05",
			gender: "male",
			address: "Số 91 Hoàng Diệu, Quận Hải Châu, TP. Đà Nẵng",
		},
		{
			email: "camper.kien@ctms.local",
			phone: "0900000027",
			name: "Trần Hữu Kiên",
			dateOfBirth: "1993-06-19",
			gender: "male",
			address: "Số 15 Võ Văn Kiệt, Quận Sơn Trà, TP. Đà Nẵng",
		},
		{
			email: "camper.yen@ctms.local",
			phone: "0900000028",
			name: "Nguyễn Hoàng Yến",
			dateOfBirth: "1999-02-28",
			gender: "female",
			address: "Số 48 Ngô Quyền, Quận Sơn Trà, TP. Đà Nẵng",
		},
		{
			email: "camper.huy@ctms.local",
			phone: "0900000029",
			name: "Vũ Đức Huy",
			dateOfBirth: "1996-12-11",
			gender: "male",
			address: "Số 64 Tôn Đức Thắng, Quận Liên Chiểu, TP. Đà Nẵng",
		},
	];

	const defaultPasswordHash = await hash("Camper@123", BCRYPT_COST_FACTOR);
	const userMap = new Map<string, string>();

	// Add main camper
	const mainCamperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (mainCamperRows.length > 0) {
		userMap.set("camper@ctms.local", mainCamperRows[0].id);
	}

	for (const c of demoCampers) {
		const existing: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[c.email, c.phone]
		);
		let userId = "";
		if (existing.length > 0) {
			userId = existing[0].id;
			await dataSource.query(
				`UPDATE "users" 
				 SET "full_name" = $2, "role" = 'camper', "status" = 'active',
				     "date_of_birth" = $3, "address" = $4, "gender" = $5
				 WHERE "id" = $1`,
				[userId, c.name, c.dateOfBirth, c.address, c.gender]
			);
		} else {
			const inserted: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "users" (email, phone, password_hash, role, status, full_name, date_of_birth, address, gender)
				 VALUES ($1, $2, $3, 'camper', 'active', $4, $5, $6, $7) RETURNING id`,
				[c.email, c.phone, defaultPasswordHash, c.name, c.dateOfBirth, c.address, c.gender]
			);
			userId = inserted[0].id;
		}
		await dataSource.query(
			`INSERT INTO "user_roles" (user_id, role) VALUES ($1, 'camper') ON CONFLICT DO NOTHING`,
			[userId]
		);
		userMap.set(c.email, userId);
	}

	// 2. Specifications for group bookings (1 booker + 2-3 companions, 2-3 equipment items)
	interface GroupBookingSpec {
		tripTitlePattern: string;
		bookerEmail: string;
		companionEmails: string[];
		equipment: Array<{ name: string; quantity: number }>;
	}

	const bookingSpecs: GroupBookingSpec[] = [
		// 1. Chuyến Sơn Trà: Đỗ Hoàng Long đặt cho mình + Mai Anh + Quốc Bảo (Tổng 3 người, thuê 3 món)
		{
			tripTitlePattern: "%Khám Phá Bán Đảo Sơn Trà (Bình thường%",
			bookerEmail: "camper.long@ctms.local",
			companionEmails: ["camper.maianh@ctms.local", "camper.bao@ctms.local"],
			equipment: [
				{ name: "Balo trekking trợ lực 50L Deuter", quantity: 2 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 2 },
				{ name: "Đèn pin đội đầu chống nước IPX8 Black Diamond", quantity: 3 },
			],
		},
		// 2. Chuyến Sơn Trà: Camper Nguyễn Văn An đặt cho mình + Lan + Nam + Thu Thảo (Tổng 4 người, thuê 3 món)
		{
			tripTitlePattern: "%Khám Phá Bán Đảo Sơn Trà (Bình thường%",
			bookerEmail: "camper@ctms.local",
			companionEmails: ["camper.lan@ctms.local", "camper.nam@ctms.local", "camper.thao@ctms.local"],
			equipment: [
				{ name: "Lều cắm trại 4 người Coleman cao cấp", quantity: 1 },
				{ name: "Đệm hơi cách nhiệt dã ngoại xếp gọn", quantity: 4 },
				{ name: "Bộ sơ cứu y tế sinh tồn Trekking", quantity: 1 },
			],
		},
		// 3. Chuyến Làng Vân Tháng 12: Phạm Minh Tuấn đặt cho mình + Quỳnh Như + Đức Huy (Tổng 3 người, thuê 3 món)
		{
			tripTitlePattern: "%Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân%",
			bookerEmail: "camper.tuan@ctms.local",
			companionEmails: ["camper.nhu@ctms.local", "camper.huy@ctms.local"],
			equipment: [
				{ name: "Lều cắm trại 2 người Naturehike chống nước", quantity: 2 },
				{ name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)", quantity: 3 },
				{ name: "Bếp ga dã ngoại mini và bộ nồi nhôm xếp gọn", quantity: 1 },
			],
		},
		// 4. Chuyến Làng Vân Tháng 12: Bùi Phương Linh đặt cho mình + Thế Dũng + Hữu Kiên + Hoàng Yến (Tổng 4 người, thuê 3 món)
		{
			tripTitlePattern: "%Cắm Trại Đêm Vịnh Làng Vân & Trekking Đèo Hải Vân%",
			bookerEmail: "camper.linh@ctms.local",
			companionEmails: [
				"camper.dung@ctms.local",
				"camper.kien@ctms.local",
				"camper.yen@ctms.local",
			],
			equipment: [
				{ name: "Lều cắm trại 4 người Coleman cao cấp", quantity: 1 },
				{ name: "Đệm hơi cách nhiệt dã ngoại xếp gọn", quantity: 4 },
				{ name: "Đèn pin đội đầu chống nước IPX8 Black Diamond", quantity: 4 },
			],
		},
		// 5. Chuyến Khe Ram Hòa Bắc: Trần Thị Lan đặt cho mình + Hoàng Nam + Hoàng Long (Tổng 3 người, thuê 2 món)
		{
			tripTitlePattern: "%Trekking Khe Ram - Rừng Hòa Bắc (Sắp hết hạn%",
			bookerEmail: "camper.lan@ctms.local",
			companionEmails: ["camper.nam@ctms.local", "camper.long@ctms.local"],
			equipment: [
				{ name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)", quantity: 3 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 3 },
			],
		},
		// 6. Chuyến Rừng Sơn Trà Tháng 12: Vũ Đức Huy đặt cho mình + Mai Anh + Quốc Bảo + Thu Thảo (Tổng 4 người, thuê 2 món)
		{
			tripTitlePattern: "%Khám Phá Rừng Nguyên Sinh Sơn Trà - Đỉnh Bàn Cờ%",
			bookerEmail: "camper.huy@ctms.local",
			companionEmails: [
				"camper.maianh@ctms.local",
				"camper.bao@ctms.local",
				"camper.thao@ctms.local",
			],
			equipment: [
				{ name: "Balo trekking trợ lực 50L Deuter", quantity: 2 },
				{ name: "Gậy leo núi Carbon siêu nhẹ (Cặp)", quantity: 4 },
			],
		},
	];

	for (const spec of bookingSpecs) {
		const tripRows: Array<{
			id: string;
			starts_at: Date;
			ends_at: Date;
			price_per_person: string | number;
			title: string;
		}> = await dataSource.query(
			'SELECT "id", "starts_at", "ends_at", "price_per_person", "title" FROM "trips" WHERE "host_id" = $1 AND "title" ILIKE $2 LIMIT 1',
			[hostId, spec.tripTitlePattern]
		);
		if (tripRows.length === 0) {
			console.warn(
				`[seed:group-bookings] Trip matching pattern "${spec.tripTitlePattern}" not found.`
			);
			continue;
		}
		const trip = tripRows[0];
		const tripId = trip.id;

		const bookerId = userMap.get(spec.bookerEmail);
		if (!bookerId) continue;

		const companionIds = spec.companionEmails
			.map((e) => userMap.get(e))
			.filter(Boolean) as string[];
		const allMembers = [
			{ userId: bookerId, isPrimary: true },
			...companionIds.map((id) => ({ userId: id, isPrimary: false })),
		];

		const diffMs = new Date(trip.ends_at).getTime() - new Date(trip.starts_at).getTime();
		const rentalDays = Math.max(1, Math.ceil(diffMs / 86400000));
		const rentalStartDate = new Date(trip.starts_at).toISOString().slice(0, 10);
		const rentalEndDate = new Date(trip.ends_at).toISOString().slice(0, 10);

		const pricePerPerson = Number(trip.price_per_person) || 450000;
		const basePrice = pricePerPerson * allMembers.length;

		// 2.1 Upsert Booking
		const existingBooking: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "bookings" WHERE "trip_id" = $1 AND "user_id" = $2',
			[tripId, bookerId]
		);

		let bookingId = "";
		if (existingBooking.length > 0) {
			bookingId = existingBooking[0].id;
			await dataSource.query(
				`UPDATE "bookings"
				 SET "num_people" = $2, "status" = 'confirmed', "payment_status" = 'paid',
				     "trip_starts_at_snapshot" = $3, "trip_ends_at_snapshot" = $4,
				     "base_price" = $5, "total_amount" = $5
				 WHERE "id" = $1`,
				[bookingId, allMembers.length, trip.starts_at, trip.ends_at, basePrice.toFixed(2)]
			);
		} else {
			const insertedBooking: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "bookings" (
					trip_id, user_id, num_people, status, payment_status,
					trip_starts_at_snapshot, trip_ends_at_snapshot, base_price, total_amount
				) VALUES (
					$1, $2, $3, 'confirmed', 'paid',
					$4, $5, $6, $7
				) RETURNING id`,
				[
					tripId,
					bookerId,
					allMembers.length,
					trip.starts_at,
					trip.ends_at,
					basePrice.toFixed(2),
					basePrice.toFixed(2),
				]
			);
			bookingId = insertedBooking[0].id;
		}

		// 2.2 Upsert Booking Members
		for (const m of allMembers) {
			const existingMember: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" = $2',
				[bookingId, m.userId]
			);
			if (existingMember.length > 0) {
				await dataSource.query(
					`UPDATE "booking_members"
					 SET "member_status" = 'registered', "is_primary" = $2, "checked_in_at" = NULL, "no_show_at" = NULL, "left_at" = NULL
					 WHERE "id" = $1`,
					[existingMember[0].id, m.isPrimary]
				);
			} else {
				await dataSource.query(
					`INSERT INTO "booking_members" (booking_id, user_id, is_primary, member_status)
					 VALUES ($1, $2, $3, 'registered')`,
					[bookingId, m.userId, m.isPrimary]
				);
			}
		}
		await dataSource.query(
			'DELETE FROM "booking_members" WHERE "booking_id" = $1 AND "user_id" NOT IN (SELECT UNNEST($2::uuid[]))',
			[bookingId, allMembers.map((m) => m.userId)]
		);

		// 2.3 Clean old equipment items & reservations for idempotent seed
		await dataSource.query(
			'DELETE FROM "equipment_reservations" WHERE "booking_item_id" IN (SELECT "id" FROM "booking_items" WHERE "booking_id" = $1)',
			[bookingId]
		);
		await dataSource.query('DELETE FROM "booking_items" WHERE "booking_id" = $1', [bookingId]);

		// 2.4 Insert Equipment Items & Reservations
		let equipmentTotal = 0;
		for (const eqItem of spec.equipment) {
			const eqRows: Array<{ id: string; rental_price_per_day: string | number }> =
				await dataSource.query(
					'SELECT "id", "rental_price_per_day" FROM "equipment_catalog_items" WHERE "host_id" = $1 AND "name" = $2 LIMIT 1',
					[hostId, eqItem.name]
				);
			if (eqRows.length === 0) {
				console.warn(`[seed:group-bookings] Equipment item "${eqItem.name}" not found for host.`);
				continue;
			}
			const eq = eqRows[0];
			const unitPrice = Number(eq.rental_price_per_day);
			const itemTotal = unitPrice * eqItem.quantity * rentalDays;
			equipmentTotal += itemTotal;

			const insertedItem: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "booking_items" (
					"booking_id", "item_type", "equipment_catalog_item_id", "quantity", "unit_price", "rental_days", "total_price"
				) VALUES ($1, 'equipment', $2, $3, $4, $5, $6)
				RETURNING "id"`,
				[bookingId, eq.id, eqItem.quantity, unitPrice.toFixed(2), rentalDays, itemTotal.toFixed(2)]
			);
			const bookingItemId = insertedItem[0].id;

			await dataSource.query(
				`INSERT INTO "equipment_reservations" (
					"booking_item_id", "equipment_catalog_item_id", "quantity", "rental_start_date", "rental_end_date", "status"
				) VALUES ($1, $2, $3, $4, $5, 'active')`,
				[bookingItemId, eq.id, eqItem.quantity, rentalStartDate, rentalEndDate]
			);
		}

		// 2.5 Update Booking total amount with equipment
		const finalTotal = basePrice + equipmentTotal;
		await dataSource.query(
			'UPDATE "bookings" SET "base_price" = $2, "total_amount" = $3 WHERE "id" = $1',
			[bookingId, basePrice.toFixed(2), finalTotal.toFixed(2)]
		);

		// 2.6 Ensure Payment & Transaction
		const paymentRows: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "payments" WHERE "booking_id" = $1 LIMIT 1',
			[bookingId]
		);
		let paymentId = "";
		if (paymentRows.length > 0) {
			paymentId = paymentRows[0].id;
			await dataSource.query(
				'UPDATE "payments" SET "amount" = $2, "status" = \'succeeded\' WHERE "id" = $1',
				[paymentId, finalTotal.toFixed(2)]
			);
		} else {
			const insertedPayment: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "payments" (
					"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
				) VALUES ($1, 'charge', 'succeeded', $2, $3, 'seed-fingerprint', 'PAYOS-DEMO-REF')
				RETURNING "id"`,
				[bookingId, finalTotal.toFixed(2), `charge-group-${bookingId}`]
			);
			paymentId = insertedPayment[0].id;
		}

		await dataSource.query(
			`INSERT INTO "payment_transactions" ("payment_id", "status")
			 SELECT $1, 'succeeded'
			 WHERE NOT EXISTS (SELECT 1 FROM "payment_transactions" WHERE "payment_id" = $1 AND "status" = 'succeeded')`,
			[paymentId]
		);

		console.log(
			`[seed:group-bookings] ✅ Seeded booking for ${spec.bookerEmail} on "${trip.title}": ${allMembers.length} members, ${spec.equipment.length} equipment items, total=${finalTotal.toLocaleString("vi-VN")} VND.`
		);
	}

	// 3. Sync seats_taken across all Host trips
	await dataSource.query(
		`UPDATE "trips" t
		 SET "seats_taken" = (
			SELECT COALESCE(SUM(b."num_people"), 0)
			FROM "bookings" b
			WHERE b."trip_id" = t."id" AND b."status" IN ('confirmed', 'pending_payment')
		 )
		 WHERE t."host_id" = $1`,
		[hostId]
	);

	console.log("[seed:group-bookings] ✅ All group bookings with equipment seeded successfully.");
}

// --------------------------------------------------------------------------
// Helper: Seed Route Checkpoints & Danger Zones (checkpoints, route_danger_zones)
// --------------------------------------------------------------------------
async function seedRouteCheckpointsAndDangerZones(routeIds: Record<string, string>): Promise<void> {
	console.log("[seed:dev-trips] Seeding route checkpoints & danger zones...");
	const sonTraId = routeIds["Bán Đảo Sơn Trà Discovery"];
	if (sonTraId) {
		await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = $1', [sonTraId]);

		const sonTraCheckpoints = [
			{
				name: "Điểm xuất phát Chùa Linh Ứng",
				geom: "SRID=4326;POINT(108.260 16.110)",
				radiusMeters: 50,
				type: "start",
				offset: 0,
				instructions: "Tập trung tại cổng phụ Chùa Linh Ứng, kiểm tra trang bị và điểm danh",
				waterOrShelter: true,
				routePosition: 0.0,
			},
			{
				name: "Trạm quan sát Cây Đa Ngàn Năm",
				geom: "SRID=4326;POINT(108.272 16.116)",
				radiusMeters: 40,
				type: "rest",
				offset: 60,
				instructions: "Nghỉ ngơi 15 phút, quan sát đàn voọc chà vá chân nâu, bổ sung nước",
				waterOrShelter: true,
				routePosition: 0.25,
			},
			{
				name: "Trạm tiếp nước & Trú ẩn Suối Đá",
				geom: "SRID=4326;POINT(108.280 16.120)",
				radiusMeters: 50,
				type: "water",
				offset: 120,
				instructions: "Trạm tiếp nước ngọt tự nhiên và chòi trú ẩn kiên cố phòng dông lốc",
				waterOrShelter: true,
				routePosition: 0.5,
			},
			{
				name: "Dốc Vọng Cảnh - Vách đá trơn trượt",
				geom: "SRID=4326;POINT(108.290 16.115)",
				radiusMeters: 30,
				type: "dangerous",
				offset: 180,
				instructions: "Đoạn dốc đứng trơn trợt, cần bám dây an toàn và đi chậm theo hướng dẫn",
				waterOrShelter: false,
				routePosition: 0.75,
			},
			{
				name: "Đích đến - Trạm Hải Đăng Sơn Trà",
				geom: "SRID=4326;POINT(108.300 16.110)",
				radiusMeters: 60,
				type: "finish",
				offset: 240,
				instructions:
					"Kết thúc hành trình tại Trạm Hải Đăng Sơn Trà, thu gom rác và bàn giao thiết bị",
				waterOrShelter: true,
				routePosition: 1.0,
			},
		];

		for (const cp of sonTraCheckpoints) {
			await dataSource.query(
				`INSERT INTO "checkpoints" (
					route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position
				) VALUES (
					$1, $2, ST_GeogFromText($3), $4, $5, $6, $7, $8, $9
				)`,
				[
					sonTraId,
					cp.name,
					cp.geom,
					cp.radiusMeters,
					cp.type,
					cp.offset,
					cp.instructions,
					cp.waterOrShelter,
					cp.routePosition,
				]
			);
		}

		await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = $1', [sonTraId]);
		await dataSource.query(
			`INSERT INTO "route_danger_zones" (route_id, geom, radius_m, description, severity)
			 VALUES 
			 ($1, ST_GeogFromText('SRID=4326;POINT(108.292 16.114)'), 80, 'Vách đá trơn trượt Mũi Nghê - Nguy cơ trượt ngã khi trời mưa ẩm', 'high'),
			 ($1, ST_GeogFromText('SRID=4326;POINT(108.275 16.118)'), 50, 'Đoạn dốc sạt lở đất đá mùa mưa bão', 'medium')`,
			[sonTraId]
		);
	}

	const haiVanId = routeIds["Hải Vân Pass - Nam Hải Vân Trail"];
	if (haiVanId) {
		await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = $1', [haiVanId]);
		const haiVanCheckpoints = [
			{
				name: "Điểm xuất phát Chân Đèo Hải Vân",
				geom: "SRID=4326;POINT(108.130 16.185)",
				radiusMeters: 50,
				type: "start",
				offset: 0,
				instructions: "Tập kết chân đèo phía Đà Nẵng, kiểm tra dây đai và phổ biến an toàn",
				waterOrShelter: true,
				routePosition: 0.0,
			},
			{
				name: "Trạm dừng chân Lưng Đèo",
				geom: "SRID=4326;POINT(108.138 16.195)",
				radiusMeters: 40,
				type: "rest",
				offset: 120,
				instructions: "Điểm dừng chân nghỉ ngơi, view toàn cảnh vịnh Làng Vân từ trên cao",
				waterOrShelter: false,
				routePosition: 0.33,
			},
			{
				name: "Điểm trú bão & Sơ cứu Hải Vân Quan",
				geom: "SRID=4326;POINT(108.145 16.205)",
				radiusMeters: 50,
				type: "emergency_shelter",
				offset: 240,
				instructions: "Công trình kiên cố di tích Hải Vân Quan, trang bị tủ thuốc sơ cứu và nước",
				waterOrShelter: true,
				routePosition: 0.67,
			},
			{
				name: "Bãi Cắm Trại Vịnh Làng Vân (Đích đến)",
				geom: "SRID=4326;POINT(108.150 16.210)",
				radiusMeters: 60,
				type: "finish",
				offset: 360,
				instructions: "Bãi biển hoang sơ Làng Vân, hạ lều cắm trại và chuẩn bị lửa trại",
				waterOrShelter: true,
				routePosition: 1.0,
			},
		];
		for (const cp of haiVanCheckpoints) {
			await dataSource.query(
				`INSERT INTO "checkpoints" (
					route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position
				) VALUES (
					$1, $2, ST_GeogFromText($3), $4, $5, $6, $7, $8, $9
				)`,
				[
					haiVanId,
					cp.name,
					cp.geom,
					cp.radiusMeters,
					cp.type,
					cp.offset,
					cp.instructions,
					cp.waterOrShelter,
					cp.routePosition,
				]
			);
		}
	}

	const kheRamId = routeIds["Khe Ram - Suối Mơ - Rừng Hòa Bắc"];
	if (kheRamId) {
		await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = $1', [kheRamId]);
		await dataSource.query(
			`INSERT INTO "route_danger_zones" (route_id, geom, radius_m, description, severity)
			 VALUES ($1, ST_GeogFromText('SRID=4326;POINT(108.050 16.120)'), 200, 'Khu vực lòng suối nước xiết - Nguy cơ lũ quét cực cao khi có mưa lớn ở thượng nguồn', 'high')`,
			[kheRamId]
		);
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Diverse Trip & Route Statuses (Pending Approval, Draft, Cancelled, Closed)
// --------------------------------------------------------------------------
async function seedDiverseTripAndRouteStatuses(
	hostId: string,
	routeIds: Record<string, string>
): Promise<void> {
	console.log("[seed:dev-trips] Seeding diverse route and trip lifecycle statuses...");
	const now = new Date();
	const inDays = (d: number, hours = 7) => {
		const date = new Date(now.getTime() + d * 86400000);
		date.setHours(hours, 0, 0, 0);
		return date.toISOString();
	};

	// 1. Route Pending Approval
	const pendingRouteName = "Đồi Dương - Suối Lương Trail (Chờ Duyệt)";
	const existingPendingRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "name" = $1',
		[pendingRouteName]
	);
	let pendingRouteId = "";
	if (existingPendingRoute.length > 0) {
		pendingRouteId = existingPendingRoute[0].id;
		await dataSource.query(
			'UPDATE "trekking_routes" SET "status" = \'pending_approval\' WHERE "id" = $1',
			[pendingRouteId]
		);
	} else {
		const res: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "trekking_routes" (
				host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status
			) VALUES (
				$1, $2, 'Cung đường ven suối râm mát, đang được Host đề xuất chờ Admin phê duyệt',
				ST_GeogFromText('SRID=4326;LINESTRING(108.120 16.170, 108.125 16.175, 108.130 16.180)'),
				3800, 'easy', 150, 'pending_approval'
			) RETURNING id`,
			[hostId, pendingRouteName]
		);
		pendingRouteId = res[0].id;
	}
	routeIds[pendingRouteName] = pendingRouteId;

	// 2. Route Closed (do sạt lở)
	const closedRouteName = "Đỉnh Mẹ Suốt Cung Sạt Lở (Tạm Đóng)";
	const existingClosedRoute: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "name" = $1',
		[closedRouteName]
	);
	if (existingClosedRoute.length > 0) {
		await dataSource.query('UPDATE "trekking_routes" SET "status" = \'closed\' WHERE "id" = $1', [
			existingClosedRoute[0].id,
		]);
	} else {
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status
			) VALUES (
				$1, $2, 'Cung đường đang tạm đóng do ảnh hưởng sạt lở sau bão, không mở nhận chuyến',
				ST_GeogFromText('SRID=4326;LINESTRING(108.110 16.160, 108.115 16.165)'),
				2800, 'hard', 180, 'closed'
			)`,
			[hostId, closedRouteName]
		);
	}

	// 3. Trips with diverse statuses
	const sonTraId = routeIds["Bán Đảo Sơn Trà Discovery"];
	if (!sonTraId) return;

	// Trip: Pending Approval (Chờ Admin duyệt)
	const pendingTripTitle = "[CTMS-024] Thám Hiểm Rừng Hòa Bắc (Chờ Admin phê duyệt)";
	const existingPendingTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[pendingTripTitle]
	);
	if (existingPendingTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Chuyến thám hiểm mới được Host tạo, đang trong hàng đợi chờ Admin kiểm tra và phê duyệt xuất bản.',
				'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.020 16.090)'), $6, $7,
				6, 15, 0, '650000',
				'{"summary": "07:00 xuất phát, 16:30 hoàn thành."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'pending_approval'
			)`,
			[
				hostId,
				sonTraId,
				pendingTripTitle,
				inDays(10, 7),
				inDays(10, 17),
				inDays(10, 6),
				inDays(8, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}

	// Trip: Draft (Host đang lưu nháp)
	const draftTripTitle = "[CTMS-024] Trekking Suối Mơ Hòa Vang (Bản nháp của Host)";
	const existingDraftTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[draftTripTitle]
	);
	if (existingDraftTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Bản phác thảo kế hoạch chuyến đi chưa gửi duyệt của Host.',
				'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.030 16.100)'), $6, $7,
				5, 20, 0, '350000',
				'{"summary": "Đang cập nhật lịch trình."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'draft'
			)`,
			[
				hostId,
				sonTraId,
				draftTripTitle,
				inDays(14, 8),
				inDays(14, 16),
				inDays(14, 7),
				inDays(12, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}

	// Trip: Cancelled (Đã hủy do thiếu người sau hạn chót đặt chỗ)
	const cancelledTripTitle = "[CTMS-024] Chinh Phục Đỉnh Núi Chúa (Đã hủy do thiếu người)";
	const existingCancelledTrip: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "trips" WHERE "title" = $1',
		[cancelledTripTitle]
	);
	if (existingCancelledTrip.length === 0) {
		await dataSource.query(
			`INSERT INTO "trips" (
				host_id, route_id, title, description, cover_image_url,
				trip_type, duration_nights, starts_at, ends_at,
				meeting_point, meeting_at, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person,
				itinerary, includes, excludes, cancellation_policy, status
			) VALUES (
				$1, $2, $3, 'Chuyến đi tự động bị hủy do đến hạn chót đặt vé mà số lượng người đăng ký không đạt mức tối thiểu (capacity_min).',
				'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
				'day_trip', 0, $4, $5,
				ST_GeogFromText('SRID=4326;POINT(108.010 15.990)'), $6, $7,
				10, 25, 2, '550000',
				'{"summary": "Chuyến đi đã bị hủy theo quy chế capacity_min."}'::jsonb,
				NULL,
				NULL,
				$8::jsonb,
				'cancelled'
			)`,
			[
				hostId,
				sonTraId,
				cancelledTripTitle,
				inDays(2, 7),
				inDays(2, 17),
				inDays(2, 6),
				inDays(1, 18),
				JSON.stringify(DEFAULT_CANCELLATION_POLICY),
			]
		);
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Porter Profile, Route Qualifications & Assignments
// --------------------------------------------------------------------------
async function seedPorterProfileAndAssignments(routeIds: Record<string, string>): Promise<void> {
	console.log("[seed:dev-trips] Seeding Porter profiles, qualifications and trip assignments...");
	const adminRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["admin@ctms.local"]
	);
	const adminId = adminRows.length > 0 ? adminRows[0].id : null;
	if (!adminId) {
		throw new Error("[seed:dev-trips] Admin account is required to verify Porter qualifications.");
	}

	for (const fixture of PORTER_SEED_FIXTURES) {
		await seedAccount({
			label: fixture.key,
			email: fixture.email,
			phone: fixture.phone,
			password: "Porter@123",
			role: "porter",
			fullName: fixture.fullName,
		});

		const porterRows: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "users" WHERE "email" = $1',
			[fixture.email]
		);
		const porterId = porterRows[0]?.id;
		if (!porterId) {
			throw new Error(`[seed:dev-trips] Porter account was not created: ${fixture.email}`);
		}

		await dataSource.query(
			`UPDATE "users"
			 SET "status" = $2, "full_name" = $3, "updated_at" = NOW()
			 WHERE "id" = $1`,
			[porterId, fixture.userStatus, fixture.fullName]
		);
		await grantRole(porterId, "porter");

		await dataSource.query('DELETE FROM "trip_porters" WHERE "porter_id" = $1', [porterId]);
		await dataSource.query('DELETE FROM "porter_route_qualifications" WHERE "porter_id" = $1', [
			porterId,
		]);

		if (!fixture.profile) {
			await dataSource.query('DELETE FROM "porter_profiles" WHERE "porter_id" = $1', [porterId]);
			continue;
		}

		await dataSource.query(
			`INSERT INTO "porter_profiles" (
				porter_id, experience_years, certifications, languages,
				availability_status, rating_avg, completed_trips
			) VALUES ($1, $2, '{}', $3, $4, $5, $6)
			ON CONFLICT (porter_id) DO UPDATE SET
				experience_years = EXCLUDED.experience_years,
				certifications = EXCLUDED.certifications,
				languages = EXCLUDED.languages,
				availability_status = EXCLUDED.availability_status,
				rating_avg = EXCLUDED.rating_avg,
				completed_trips = EXCLUDED.completed_trips,
				updated_at = NOW()`,
			[
				porterId,
				fixture.profile.experienceYears,
				fixture.profile.languages,
				fixture.profile.availabilityStatus,
				fixture.profile.ratingAvg,
				fixture.profile.completedTrips,
			]
		);

		if (fixture.key === "expert-lead") {
			await dataSource.query(
				`INSERT INTO "porter_verifications" (porter_id, status, submitted_at, reviewed_at)
				 VALUES ($1, 'approved', now(), now())
				 ON CONFLICT (porter_id) DO UPDATE SET
					status = 'approved',
					reviewed_at = COALESCE("porter_verifications".reviewed_at, now()),
					rejection_reason = NULL`,
				[porterId]
			);
		}

		if (fixture.qualification) {
			for (const routeName of fixture.qualification.routeNames) {
				const routeId = routeIds[routeName];
				if (!routeId) {
					throw new Error(`[seed:dev-trips] Missing Route for Porter qualification: ${routeName}`);
				}
				await dataSource.query(
					`INSERT INTO "porter_route_qualifications" (
						porter_id, route_id, proficiency, times_led, verified_by, verified_at
					) VALUES ($1, $2, $3, $4, $5, NOW())`,
					[
						porterId,
						routeId,
						fixture.qualification.proficiency,
						fixture.qualification.timesLed,
						adminId,
					]
				);
			}
		}

		if (fixture.conflictingTripTitle) {
			const tripRows: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trips" WHERE "title" = $1',
				[fixture.conflictingTripTitle]
			);
			const tripId = tripRows[0]?.id;
			if (!tripId) {
				throw new Error(
					`[seed:dev-trips] Missing Trip for Porter conflict fixture: ${fixture.conflictingTripTitle}`
				);
			}
			await dataSource.query(
				`INSERT INTO "trip_porters" (trip_id, porter_id, status)
				 VALUES ($1, $2, 'assigned')
				 ON CONFLICT (trip_id, porter_id) DO UPDATE SET status = 'assigned'`,
				[tripId, porterId]
			);
		}
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Camper Health Profiles & Emergency Contacts
// --------------------------------------------------------------------------
async function seedCamperHealthAndContacts(): Promise<void> {
	console.log("[seed:dev-trips] Seeding Camper health profiles & emergency contacts...");
	const camperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (camperRows.length === 0) return;
	const camperId = camperRows[0].id;

	// Camper basic profile information (DOB, address, gender)
	await dataSource.query(
		`UPDATE "users"
		 SET "date_of_birth" = '1998-10-20',
		     "address" = 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
		     "gender" = 'male'
		 WHERE "id" = $1`,
		[camperId]
	);

	// Emergency contact
	await dataSource.query('DELETE FROM "emergency_contacts" WHERE "user_id" = $1', [camperId]);
	await dataSource.query(
		`INSERT INTO "emergency_contacts" (user_id, name, relationship, phone, email)
		 VALUES ($1, 'Nguyễn Văn Hùng', 'Bố', '0912345678', 'hung.nguyen@gmail.com')`,
		[camperId]
	);

	// Health profile
	await dataSource.query(
		`INSERT INTO "health_profiles" (
			user_id, blood_type, physical_fitness_level, dietary_restrictions, emergency_notes,
			allergies, medical_conditions, is_consent_granted, consent_granted_at
		) VALUES (
			$1, 'O+', 'INTERMEDIATE', 'Ăn chay bán phần', 'Có tiền sử hạ đường huyết nhẹ khi vận động cường độ cao liên tục',
			'["Dị ứng phấn hoa dại"]'::jsonb, '[]'::jsonb, true, NOW()
		) ON CONFLICT (user_id) DO UPDATE SET
			blood_type = EXCLUDED.blood_type,
			physical_fitness_level = EXCLUDED.physical_fitness_level,
			dietary_restrictions = EXCLUDED.dietary_restrictions,
			emergency_notes = EXCLUDED.emergency_notes,
			allergies = EXCLUDED.allergies,
			is_consent_granted = EXCLUDED.is_consent_granted`,
		[camperId]
	);
}

// ==========================================================================
// [4/6] WEATHER RISK SCENARIOS (GREEN & RED ROUTES)
// ==========================================================================
export async function seedWeatherRiskScenarios(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
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

		// 2. Ensure a weather_risk_rule exists
		const existingRules: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "weather_risk_rules" ORDER BY "created_at" DESC LIMIT 1'
		);
		let ruleVersionId = "";
		if (existingRules.length > 0) {
			ruleVersionId = existingRules[0].id;
		} else {
			const insertedRule: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "weather_risk_rules" (
					"rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold",
					"temp_low_yellow", "temp_low_red", "temp_high_yellow", "temp_high_red",
					"visibility_yellow_threshold", "visibility_red_threshold",
					"thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight", "thunderstorm_weight",
					"green_max_score", "yellow_max_score",
					"is_active", "created_by"
				) VALUES (
					10.0, 50.0,
					40.0, 70.0,
					5.0, 0.0, 38.0, 42.0,
					5000.0, 1000.0,
					true, true,
					0.30, 0.25, 0.15, 0.15, 0.15,
					0.5, 1.2,
					true, $1
				) RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		// 3. Scenario 1: GREEN Risk Route (Allowed)
		const greenRouteName = "Cung Đường An Toàn (Mức Xanh)";
		const existingGreenRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, greenRouteName]
		);

		let greenRouteId = "";
		if (existingGreenRoute.length > 0) {
			greenRouteId = existingGreenRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến trekking thời tiết đẹp, đủ điều kiện an toàn đăng ký', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 2000, 'easy', 120, 'active')
				 RETURNING id`,
				[hostId, greenRouteName]
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
					thunderstorm: {
						value: false,
						level: "green",
						weight: 0.15,
						score: 0,
					},
				}),
				hostId,
			]
		);

		// 4. Scenario 2: RED Risk Route (Blocked)
		const redRouteName = "Cung Đường Bão Nguy Hiểm (Mức Đỏ)";
		const existingRedRoute: Array<{ id: string }> = await dataSource.query(
			'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 AND "name" = $2',
			[hostId, redRouteName]
		);

		let redRouteId = "";
		if (existingRedRoute.length > 0) {
			redRouteId = existingRedRoute[0].id;
		} else {
			const res: Array<{ id: string }> = await dataSource.query(
				`INSERT INTO "trekking_routes" (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1, $2, 'Tuyến đường rủi ro thời tiết MỨC ĐỎ - Tạm dừng nhận đăng ký mới', ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.48 11.96)'), 3500, 'hard', 240, 'active')
				 RETURNING id`,
				[hostId, redRouteName]
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

		// Seed Weather Advice (LLM advice text & actionable recommendations)
		await seedWeatherAdvice(hostId);

		console.log("\n========================================================");
		console.log(" [seed:weather-scenarios] SUCCESS!");
		console.log(" - Host Login: host@ctms.local / Host@123");
		console.log(` - Scenario 1 (Green / Allowed Route ID): ${greenRouteId}`);
		console.log(` - Scenario 2 (Red / Blocked Route ID): ${redRouteId}`);
		console.log("========================================================\n");
	} catch (error) {
		console.error("[seed:weather-scenarios] Error seeding data:", error);
		throw error;
	}
}

// --------------------------------------------------------------------------
// Helper: Seed Weather Advice for Assessments (weather_advice table)
// --------------------------------------------------------------------------
async function seedWeatherAdvice(hostId: string): Promise<void> {
	console.log("[seed:weather-scenarios] Seeding weather advice for assessments...");
	const assessments: Array<{ id: string; risk_level: string }> = await dataSource.query(`
		SELECT "id", "risk_level" FROM "weather_risk_assessments" ORDER BY "created_at" DESC
	`);

	for (const a of assessments) {
		const isRed = a.risk_level === "red";
		const adviceText = isRed
			? "CẢNH BÁO NGUY HIỂM: Tuyến đường chịu ảnh hưởng áp thấp nhiệt đới gây mưa dông lớn và gió giật mạnh cấp 8. Tầm nhìn giảm dưới 500m, nguy cơ sạt lở đất và lũ quét rất cao. Đề nghị tạm hoãn mọi hoạt động xuất phát."
			: "Thời tiết rất thuận lợi cho hoạt động dã ngoại và trekking. Trời quang đãng, khô ráo, gió nhẹ 10 km/h và tầm nhìn xa trên 10km. Đủ điều kiện an toàn tuyệt đối để khởi hành.";
		const actions = isRed
			? [
					"Tạm ngưng tiếp nhận khách đăng ký mới",
					"Thông báo các đoàn trên tuyến di chuyển về trạm trú ẩn khẩn cấp",
					"Kích hoạt phương án cứu hộ dự phòng",
				]
			: [
					"Khởi hành đúng theo lịch trình quy định",
					"Bổ sung tối thiểu 1.5L nước cho mỗi thành viên",
					"Tuân thủ nghiêm ngặt lộ trình của Porter trưởng",
				];

		await dataSource.query(
			`INSERT INTO "weather_advice" (assessment_id, advice_text, actions, created_by)
			 VALUES ($1, $2, $3::jsonb, $4)
			 ON CONFLICT (assessment_id) DO UPDATE SET
				advice_text = EXCLUDED.advice_text,
				actions = EXCLUDED.actions`,
			[a.id, adviceText, JSON.stringify(actions), hostId]
		);
	}
}

// ==========================================================================
// [5/6] CAMPER REFUND & DISPUTE SCENARIOS
// ==========================================================================
export async function seedCamperRefunds(): Promise<{
	preTripBookingId: string;
	completedBookingId: string;
	alreadyRefundedBookingId: string;
}> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:camper-refunds] Database initialized.");

	// 1. Get camper@ctms.local user
	const camperRows = (await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [
		"camper@ctms.local",
	])) as Array<{ id: string }>;
	if (camperRows.length === 0) {
		throw new Error("User camper@ctms.local not found. Please ensure accounts are seeded.");
	}
	const camperId = camperRows[0].id;

	// 2. Get host and route
	const tripRows = (await dataSource.query(
		`SELECT t.id, t.title, t.route_id, t.host_id, t.price_per_person
		 FROM trips t
		 WHERE t.status = 'published'
		 LIMIT 3`
	)) as Array<{
		id: string;
		title: string;
		route_id: string;
		host_id: string;
		price_per_person: string;
	}>;

	if (tripRows.length === 0) {
		throw new Error("No published trips found. Run seed:dev-trips first.");
	}

	const trip1 = tripRows[0];
	const trip2Source = tripRows[1] ?? tripRows[0];
	const trip3 = tripRows[2] ?? tripRows[0];

	// Create a completed trip for Scenario 2 (ended 3 hours ago)
	const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };
	const completedTripRows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Trekking Sơn Trà Hoàn Thành - Demo Khiếu Nại', 'Chuyến đi vừa hoàn thành cách đây 3 giờ', 'day_trip', 0,
			now() - interval '10 hours', now() - interval '3 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '1 day',
			1, 10, '850000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[
			trip2Source.host_id,
			trip2Source.route_id,
			JSON.stringify(meetingPoint),
			JSON.stringify(DEFAULT_CANCELLATION_POLICY),
		]
	)) as Array<{ id: string }>;
	const completedTripId = completedTripRows[0].id;

	// Add waypoints for the completed trip
	await dataSource.query(
		`INSERT INTO "trip_waypoints" ("trip_id", "type", "name", "location", "day_number", "sequence_order")
		 VALUES
		 ($1, 'start', 'Điểm xuất phát', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 1),
		 ($1, 'finish', 'Điểm về đích', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 2)`,
		[completedTripId, JSON.stringify(meetingPoint)]
	);

	// SCENARIO 1: Pre-trip cancelled booking with paid charge (Eligible for pre-trip refund)
	const b1Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", $3, $3,
		        now() - interval '2 hours', 'Bận việc gia đình đột xuất', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip1.id, camperId, trip1.price_per_person || "650000.00"]
	)) as Array<{ id: string }>;
	const b1Id = b1Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b1Id, camperId]
	);

	const p1Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', $2, $3, 'fp-b1', 'PAYOS-DEMO-001'
		 ) RETURNING "id"`,
		[b1Id, trip1.price_per_person || "650000.00", `demo-pay-${b1Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p1Rows[0].id]
	);

	// SCENARIO 2: Post-completion completed participation (Eligible for complaint refund within 24h)
	const b2Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[completedTripId, camperId]
	)) as Array<{ id: string }>;
	const b2Id = b2Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status", "checked_in_at")
		 VALUES ($1, $2, true, 'joined', now() - interval '9 hours')`,
		[b2Id, camperId]
	);

	const p2Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '850000.00', $2, 'fp-b2', 'PAYOS-DEMO-002'
		 ) RETURNING "id"`,
		[b2Id, `demo-pay-${b2Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p2Rows[0].id]
	);

	// SCENARIO 3: Already refunded booking (Fully processed refund)
	const b3Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancelled_at", "cancellation_reason", "cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'cancelled', 'paid', "starts_at", "ends_at", '500000.00', '500000.00',
		        now() - interval '1 day', 'Hủy do thay đổi lịch trình', "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip3.id, camperId]
	)) as Array<{ id: string }>;
	const b3Id = b3Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b3Id, camperId]
	);

	const p3Charge = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '500000.00', $2, 'fp-b3-charge', 'PAYOS-DEMO-003'
		 ) RETURNING "id"`,
		[b3Id, `demo-pay-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p3Charge[0].id]
	);

	// Refund payment referencing the charge
	const p3Refund = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "parent_payment_id", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'refund', 'succeeded', '500000.00', $2, $3, 'fp-b3-refund', 'PAYOS-REF-500000'
		 ) RETURNING "id"`,
		[b3Id, p3Charge[0].id, `demo-refund-${b3Id}`]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status", "transaction_ref") VALUES ($1, 'succeeded', 'PAYOS-REF-500000')`,
		[p3Refund[0].id]
	);

	console.log(
		`[seed:camper-refunds] Scenario 1 (Pre-Trip Cancelled): http://localhost:5173/bookings/${b1Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 2 (Post-Completion Complaint): http://localhost:5173/bookings/${b2Id}`
	);
	console.log(
		`[seed:camper-refunds] Scenario 3 (Already Refunded): http://localhost:5173/bookings/${b3Id}`
	);

	return {
		preTripBookingId: b1Id,
		completedBookingId: b2Id,
		alreadyRefundedBookingId: b3Id,
	};
}

// ==========================================================================
// [6/6] SETTLEMENTS, HOST WALLETS & PAYOUT REQUESTS
// ==========================================================================
interface SeedSettlementUser {
	email: string;
	phone: string;
	fullName: string;
	role: "admin" | "host" | "camper";
	password: string;
	dateOfBirth?: string;
	address?: string;
	gender?: "male" | "female" | "other";
}

const SEED_SETTLEMENT_USERS: SeedSettlementUser[] = [
	{
		email: "admin@ctms.local",
		phone: "0900000000",
		fullName: "Administrator",
		role: "admin",
		password: "Admin@123",
	},
	{
		email: "host@ctms.local",
		phone: "0900000002",
		fullName: "Host Ban Mai",
		role: "host",
		password: "Host@123",
	},
	{
		email: "camper@ctms.local",
		phone: "0900000003",
		fullName: "Camper Nguyễn Văn An",
		role: "camper",
		password: "Camper@123",
		dateOfBirth: "1998-10-20",
		gender: "male",
		address: "Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
	},
];

const SEED_TRIP_TITLES = [
	"Trekking Bạch Mã 2N1Đ - Đủ điều kiện Quyết toán",
	"Chèo SUP Hồ Hòa Trung - Đang giữ 72h",
	"Khám phá Đỉnh Bàn Cờ - Bị giữ do Khiếu nại",
	"Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công",
];

async function ensureSettlementUser(user: SeedSettlementUser): Promise<string> {
	const existing = (await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[user.email, user.phone]
	)) as Array<{ id: string }>;

	let userId = "";
	if (existing.length > 0) {
		userId = existing[0].id;
		const passwordHash = await hash(user.password, BCRYPT_COST_FACTOR);
		await dataSource.query(
			`UPDATE "users" 
			 SET "password_hash" = $1, 
			     "status" = 'active', 
			     "full_name" = $2,
			     "date_of_birth" = COALESCE($4, "date_of_birth"),
			     "address" = COALESCE($5, "address"),
			     "gender" = COALESCE($6, "gender")
			 WHERE "id" = $3`,
			[
				passwordHash,
				user.fullName,
				userId,
				user.dateOfBirth ?? null,
				user.address ?? null,
				user.gender ?? null,
			]
		);
	} else {
		const passwordHash = await hash(user.password, BCRYPT_COST_FACTOR);
		const inserted = (await dataSource.query(
			`INSERT INTO "users" ("email", "phone", "password_hash", "role", "status", "full_name", "date_of_birth", "address", "gender")
			 VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8)
			 RETURNING "id"`,
			[
				user.email,
				user.phone,
				passwordHash,
				user.role,
				user.fullName,
				user.dateOfBirth ?? null,
				user.address ?? null,
				user.gender ?? null,
			]
		)) as Array<{ id: string }>;
		userId = inserted[0].id;
	}

	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role")
		 VALUES ($1, $2)
		 ON CONFLICT ("user_id", "role") DO NOTHING`,
		[userId, user.role]
	);

	return userId;
}

export async function seedSettlementsAndPayouts(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:settlements] Database connected successfully.");

	// 1. Ensure required user accounts exist
	const userMap: Record<string, string> = {};
	for (const u of SEED_SETTLEMENT_USERS) {
		userMap[u.email] = await ensureSettlementUser(u);
	}
	const hostId = userMap["host@ctms.local"];
	const camperId = userMap["camper@ctms.local"];

	// 2. Ensure trekking route exists for host
	let routeRows = (await dataSource.query(
		'SELECT "id" FROM "trekking_routes" WHERE "host_id" = $1 LIMIT 1',
		[hostId]
	)) as Array<{ id: string }>;

	if (routeRows.length === 0) {
		routeRows = (await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"host_id", "name", "description", "route_geom", "length_meters",
				"difficulty", "expected_duration_minutes", "status"
			 ) VALUES (
				$1, 'Cung đường Trekking Demo', 'Tuyến đường mẫu cho kịch bản quyết toán',
				ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94, 108.47 11.95)'), 3000,
				'moderate', 240, 'active'
			 ) RETURNING "id"`,
			[hostId]
		)) as Array<{ id: string }>;
	}
	const routeId = routeRows[0].id;

	// 3. Clean up previously seeded trips & associated records for idempotency
	const oldTrips = (await dataSource.query('SELECT "id" FROM "trips" WHERE "title" = ANY($1)', [
		SEED_TRIP_TITLES,
	])) as Array<{ id: string }>;

	if (oldTrips.length > 0) {
		const oldTripIds = oldTrips.map((t) => t.id);

		// Delete content reports
		await dataSource.query('DELETE FROM "content_reports" WHERE "target_id" = ANY($1)', [
			oldTripIds,
		]);

		// Delete wallet transactions linked to old settlements/trips
		await dataSource.query('DELETE FROM "wallet_transactions" WHERE "trip_id" = ANY($1)', [
			oldTripIds,
		]);

		// Delete settlements
		await dataSource.query('DELETE FROM "settlements" WHERE "trip_id" = ANY($1)', [oldTripIds]);

		// Delete payments & payment_transactions
		const oldBookings = (await dataSource.query(
			'SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)',
			[oldTripIds]
		)) as Array<{ id: string }>;

		if (oldBookings.length > 0) {
			const oldBookingIds = oldBookings.map((b) => b.id);
			const oldPayments = (await dataSource.query(
				'SELECT "id" FROM "payments" WHERE "booking_id" = ANY($1)',
				[oldBookingIds]
			)) as Array<{ id: string }>;

			if (oldPayments.length > 0) {
				const oldPaymentIds = oldPayments.map((p) => p.id);
				await dataSource.query('DELETE FROM "payment_transactions" WHERE "payment_id" = ANY($1)', [
					oldPaymentIds,
				]);
				await dataSource.query('DELETE FROM "payments" WHERE "id" = ANY($1)', [oldPaymentIds]);
			}

			await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
				oldBookingIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [oldBookingIds]);
		}

		await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = ANY($1)', [oldTripIds]);
		await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [oldTripIds]);
	}

	// Clean up previous demo payout & its wallet transaction
	const oldDemoPayouts = (await dataSource.query(
		'SELECT "id" FROM "payouts" WHERE "transaction_ref" = $1',
		["PAYOUT-DEMO-001"]
	)) as Array<{ id: string }>;
	if (oldDemoPayouts.length > 0) {
		const oldPayoutIds = oldDemoPayouts.map((p) => p.id);
		await dataSource.query('DELETE FROM "wallet_transactions" WHERE "payout_id" = ANY($1)', [
			oldPayoutIds,
		]);
		await dataSource.query('DELETE FROM "payouts" WHERE "id" = ANY($1)', [oldPayoutIds]);
	}

	const meetingPoint = { type: "Point", coordinates: [108.2022, 16.0544] };

	// Helper to insert trip waypoints
	const insertWaypoints = async (tripId: string) => {
		await dataSource.query(
			`INSERT INTO "trip_waypoints" ("trip_id", "type", "name", "location", "day_number", "sequence_order")
			 VALUES
			 ($1, 'start', 'Điểm xuất phát', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 1),
			 ($1, 'finish', 'Điểm về đích', ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, 1, 2)`,
			[tripId, JSON.stringify(meetingPoint)]
		);
	};

	// -----------------------------------------------------------------------------------------
	// SCENARIO 1: Eligible for Settlement (> 72h completed, 0 claims/disputes)
	// Ended 80h ago. Revenue: 1.500.000 VNĐ. Expected Fee: 75.000 VNĐ, Net: 1.425.000 VNĐ
	// -----------------------------------------------------------------------------------------
	const trip1Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Trekking Bạch Mã 2N1Đ - Đủ điều kiện Quyết toán',
			'Chuyến đi đã kết thúc cách đây 80 giờ, vượt qua mốc bảo lưu 72h và sẵn sàng quyết toán.',
			'day_trip', 0,
			now() - interval '86 hours', now() - interval '80 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '4 days',
			1, 15, '1500000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip1Id = trip1Rows[0].id;
	await insertWaypoints(trip1Id);

	const b1Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '1500000.00', '1500000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip1Id, camperId]
	)) as Array<{ id: string }>;
	const b1Id = b1Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b1Id, camperId]
	);

	const p1Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '1500000.00', 'seed-settle-b1-charge', 'fp-settle-1', 'PAYOS-SETTLE-001'
		 ) RETURNING "id"`,
		[b1Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p1Rows[0].id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 2: Held under 72h Lock (< 72h completed)
	// Ended 20h ago. Revenue: 850.000 VNĐ. Eligible: false (còn ~52h bảo lưu)
	// -----------------------------------------------------------------------------------------
	const trip2Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Chèo SUP Hồ Hòa Trung - Đang giữ 72h',
			'Chuyến đi vừa kết thúc 20 giờ trước, hệ thống đang giữ bảo lưu phòng khiếu nại (72h).',
			'day_trip', 0,
			now() - interval '26 hours', now() - interval '20 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '2 days',
			1, 10, '850000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip2Id = trip2Rows[0].id;
	await insertWaypoints(trip2Id);

	const b2Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '850000.00', '850000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip2Id, camperId]
	)) as Array<{ id: string }>;
	const b2Id = b2Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b2Id, camperId]
	);

	const p2Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '850000.00', 'seed-settle-b2-charge', 'fp-settle-2', 'PAYOS-SETTLE-002'
		 ) RETURNING "id"`,
		[b2Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p2Rows[0].id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 3: Blocked by Claim (> 72h completed, but has pending refund request & report)
	// Ended 90h ago. Revenue: 3.200.000 VNĐ. Eligible: false (Có khiếu nại đang xử lý)
	// -----------------------------------------------------------------------------------------
	const trip3Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Khám phá Đỉnh Bàn Cờ - Bị giữ do Khiếu nại',
			'Chuyến đi đã hoàn thành 90 giờ trước nhưng đang có yêu cầu khiếu nại hoàn tiền chưa xử lý.',
			'day_trip', 0,
			now() - interval '96 hours', now() - interval '90 hours',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '5 days',
			1, 10, '3200000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip3Id = trip3Rows[0].id;
	await insertWaypoints(trip3Id);

	const b3Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '3200000.00', '3200000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip3Id, camperId]
	)) as Array<{ id: string }>;
	const b3Id = b3Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b3Id, camperId]
	);

	const p3Charge = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '3200000.00', 'seed-settle-b3-charge', 'fp-settle-3-charge', 'PAYOS-SETTLE-003'
		 ) RETURNING "id"`,
		[b3Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p3Charge[0].id]
	);

	// Pending refund claim (PB AC-4 / BR-339 blocker)
	await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "parent_payment_id",
			"idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'refund', 'pending', '3200000.00', $2,
			'seed-settle-b3-refund', 'fp-settle-3-refund', 'PAYOS-SETTLE-REF-003'
		 )`,
		[b3Id, p3Charge[0].id]
	);

	// Content report claim on the trip
	await dataSource.query(
		`INSERT INTO "content_reports" (
			"reporter_id", "target_type", "target_id", "reason", "status"
		 ) VALUES (
			$1, 'trip', $2, 'Host không chuẩn bị đúng dụng cụ bảo hộ như đã cam kết', 'pending'
		 )`,
		[camperId, trip3Id]
	);

	// -----------------------------------------------------------------------------------------
	// SCENARIO 4: Already Settled Trip (Settled 4 days ago)
	// Base: 4.000.000 VNĐ, Fee (5%): 200.000 VNĐ, Net (95%): 3.800.000 VNĐ credited to Host Wallet
	// -----------------------------------------------------------------------------------------
	const trip4Rows = (await dataSource.query(
		`INSERT INTO "trips" (
			"host_id", "route_id", "title", "description", "trip_type", "duration_nights",
			"starts_at", "ends_at", "meeting_point", "booking_deadline",
			"capacity_min", "capacity_max", "price_per_person", "status", "cancellation_policy"
		 ) VALUES (
			$1, $2, 'Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công',
			'Chuyến đi đã được quyết toán tự động, phí 5% đã thu và 95% đã ghi có vào ví Host.',
			'day_trip', 0,
			now() - interval '6 days', now() - interval '5 days',
			ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, now() - interval '7 days',
			1, 10, '4000000.00', 'completed',
			$4::jsonb
		 ) RETURNING "id"`,
		[hostId, routeId, JSON.stringify(meetingPoint), JSON.stringify(DEFAULT_CANCELLATION_POLICY)]
	)) as Array<{ id: string }>;
	const trip4Id = trip4Rows[0].id;
	await insertWaypoints(trip4Id);

	const b4Rows = (await dataSource.query(
		`INSERT INTO "bookings" (
			"trip_id", "user_id", "num_people", "status", "payment_status",
			"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount",
			"cancellation_policy_snapshot"
		 )
		 SELECT "id", $2, 1, 'completed', 'paid', "starts_at", "ends_at", '4000000.00', '4000000.00',
		        "cancellation_policy"
		 FROM "trips" WHERE "id" = $1
		 RETURNING "id"`,
		[trip4Id, camperId]
	)) as Array<{ id: string }>;
	const b4Id = b4Rows[0].id;

	await dataSource.query(
		`INSERT INTO "booking_members" ("booking_id", "user_id", "is_primary", "member_status")
		 VALUES ($1, $2, true, 'registered')`,
		[b4Id, camperId]
	);

	const p4Rows = (await dataSource.query(
		`INSERT INTO "payments" (
			"booking_id", "type", "status", "amount", "idempotency_key", "request_fingerprint", "provider_reference"
		 ) VALUES (
			$1, 'charge', 'succeeded', '4000000.00', 'seed-settle-b4-charge', 'fp-settle-4', 'PAYOS-SETTLE-004'
		 ) RETURNING "id"`,
		[b4Id]
	)) as Array<{ id: string }>;

	await dataSource.query(
		`INSERT INTO "payment_transactions" ("payment_id", "status") VALUES ($1, 'succeeded')`,
		[p4Rows[0].id]
	);

	// Create Settlement snapshot for Scenario 4
	const settlementRows = (await dataSource.query(
		`INSERT INTO "settlements" (
			"trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at"
		 ) VALUES (
			$1, $2, '4000000.00', '0.0500', '200000.00', '3800000.00', now() - interval '4 days'
		 ) RETURNING "id"`,
		[trip4Id, hostId]
	)) as Array<{ id: string }>;
	const settlement4Id = settlementRows[0].id;

	// -----------------------------------------------------------------------------------------
	// SCENARIO 5: Host Wallet & Payout Requests for UI testing
	// Host 1: Has 3.800.000 VNĐ balance, 0 pending payouts -> Can test "Rút toàn bộ số dư"
	// Host 2: Has 1 pending payout (1.200.000 VNĐ) -> Admin can test Confirm / Reject
	// -----------------------------------------------------------------------------------------

	// Upsert Host 1 Wallet with 3.800.000 VNĐ
	const wallet1Rows = (await dataSource.query(
		`INSERT INTO "host_wallets" ("host_id", "balance")
		 VALUES ($1, '3800000.00')
		 ON CONFLICT ("host_id") DO UPDATE SET "balance" = '3800000.00', "updated_at" = now()
		 RETURNING "id"`,
		[hostId]
	)) as Array<{ id: string }>;
	const wallet1Id = wallet1Rows[0].id;

	// Clean up old transactions and payouts for this wallet
	await dataSource.query('DELETE FROM "wallet_transactions" WHERE "wallet_id" = $1', [wallet1Id]);
	await dataSource.query('DELETE FROM "payouts" WHERE "wallet_id" = $1', [wallet1Id]);

	// Insert credit ledger entry 1: Settled trip revenue
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "settlement_id", "trip_id", "type",
			"base_amount", "fee_amount", "net_amount", "balance_after",
			"description", "created_at"
		 ) VALUES (
			$1, $2, $3, 'settlement_credit',
			'4000000.00', '200000.00', '3800000.00', '3800000.00',
			'Quyết toán doanh thu chuyến: Cắm trại Đảo Điệp Sơn - Đã quyết toán thành công',
			now() - interval '4 days'
		 )`,
		[wallet1Id, settlement4Id, trip4Id]
	);

	// Insert credit ledger entry 2: Previous tour revenue
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "type", "base_amount", "fee_amount", "net_amount",
			"balance_after", "description", "created_at"
		 ) VALUES (
			$1, 'settlement_credit', '1263158.00', '63158.00', '1200000.00',
			'5000000.00', 'Quyết toán doanh thu chuyến dã ngoại Sơn Trà', now() - interval '1 day'
		 )`,
		[wallet1Id]
	);

	// Host pending payout request for Admin testing
	const payoutRows = (await dataSource.query(
		`INSERT INTO "payouts" (
			"host_id", "wallet_id", "amount", "status", "bank_name",
			"account_number", "account_holder_name", "transaction_ref",
			"admin_notes", "created_at"
		 ) VALUES (
			$1, $2, '1200000.00', 'pending', 'Vietcombank',
			'0123456789', 'HOST BAN MAI', 'PAYOUT-DEMO-001',
			'Host yêu cầu rút một phần số dư về tài khoản', now() - interval '6 hours'
		 ) RETURNING "id"`,
		[hostId, wallet1Id]
	)) as Array<{ id: string }>;
	const payoutId = payoutRows[0].id;

	// Host payout debit transaction
	await dataSource.query(
		`INSERT INTO "wallet_transactions" (
			"wallet_id", "payout_id", "type", "base_amount", "fee_amount",
			"net_amount", "balance_after", "description", "created_at"
		 ) VALUES (
			$1, $2, 'payout_debit', '1200000.00', '0.00', '-1200000.00',
			'3800000.00', 'Yêu cầu rút tiền về Vietcombank (0123456789)', now() - interval '6 hours'
		 )`,
		[wallet1Id, payoutId]
	);

	// Ensure wallet balance accurately reflects the remaining balance
	await dataSource.query(
		'UPDATE "host_wallets" SET "balance" = \'3800000.00\', "updated_at" = now() WHERE "id" = $1',
		[wallet1Id]
	);

	console.log("\n==========================================================================");
	console.log("            SEED DATA FOR SETTLEMENTS & PAYOUTS READY!                    ");
	console.log("==========================================================================");
	console.log("👉 [1] Chuyến Đủ Điều Kiện Quyết Toán (Admin test Settle):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip1Id})`);
	console.log("👉 [2] Chuyến Đang Giữ 72h (Admin test 72h hold lock):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip2Id})`);
	console.log("👉 [3] Chuyến Bị Giữ Do Khiếu Nại (Admin test Dispute lock):");
	console.log(`       http://localhost:5173/admin/settlements (Trip ID: ${trip3Id})`);
	console.log("👉 [4] Chuyến Đã Quyết Toán (Host Card view & Snapshot):");
	console.log(`       http://localhost:5173/trips/${trip4Id}`);
	console.log("👉 [5] Ví Host & Rút Toàn Bộ Số Dư (Host login: host@ctms.local / Host@123):");
	console.log("       http://localhost:5173/host/wallet (Số dư khả dụng: 3.800.000 VNĐ)");
	console.log("👉 [6] Yêu Cầu Rút Tiền Đang Chờ Duyệt (Admin confirm/reject test):");
	console.log(`       http://localhost:5173/admin/settlements (Payout ID: ${payoutId})`);
	console.log("==========================================================================\n");
}

// ==========================================================================
// [7/7] USER BANK ACCOUNTS
// ==========================================================================
export async function seedUserBankAccounts(): Promise<void> {
	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}
	console.log("[seed:bank-accounts] Seeding user bank accounts for camper and host...");

	// 1. Host Bank Accounts (host@ctms.local)
	const hostRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["host@ctms.local"]
	);
	if (hostRows.length > 0) {
		const hostId = hostRows[0].id;
		await dataSource.query(
			'UPDATE "user_bank_accounts" SET "is_default" = false WHERE "user_id" = $1',
			[hostId]
		);
		await dataSource.query(
			`INSERT INTO "user_bank_accounts" ("user_id", "bank_name", "account_number", "account_holder_name", "is_default")
			 VALUES 
				($1, 'Vietcombank', '0123456789', 'HOST BAN MAI', true),
				($1, 'MB Bank (Ngân hàng Quân đội)', '9876543210', 'HOST BAN MAI', false)
			 ON CONFLICT ("user_id", "bank_name", "account_number") 
			 DO UPDATE SET 
				"account_holder_name" = EXCLUDED."account_holder_name",
				"is_default" = EXCLUDED."is_default",
				"updated_at" = now()`,
			[hostId]
		);
		console.log("[seed:bank-accounts] ✅ Seeded bank accounts for Host (host@ctms.local).");
	}

	// 2. Camper Bank Accounts (camper@ctms.local)
	const camperRows: Array<{ id: string }> = await dataSource.query(
		'SELECT "id" FROM "users" WHERE "email" = $1',
		["camper@ctms.local"]
	);
	if (camperRows.length > 0) {
		const camperId = camperRows[0].id;
		await dataSource.query(
			'DELETE FROM "user_bank_accounts" WHERE "user_id" = $1 AND "account_number" = \'3243234\'',
			[camperId]
		);
		await dataSource.query(
			'UPDATE "user_bank_accounts" SET "is_default" = false WHERE "user_id" = $1',
			[camperId]
		);
		await dataSource.query(
			`INSERT INTO "user_bank_accounts" ("user_id", "bank_name", "account_number", "account_holder_name", "is_default")
			 VALUES 
				($1, 'Vietcombank', '1012345678', 'CAMPER NGUYEN VAN AN', true),
				($1, 'Techcombank', '19034567890123', 'CAMPER NGUYEN VAN AN', false)
			 ON CONFLICT ("user_id", "bank_name", "account_number") 
			 DO UPDATE SET 
				"account_holder_name" = EXCLUDED."account_holder_name",
				"is_default" = EXCLUDED."is_default",
				"updated_at" = now()`,
			[camperId]
		);
		console.log("[seed:bank-accounts] ✅ Seeded bank accounts for Camper (camper@ctms.local).");
	}
}

// ==========================================================================
// MASTER RUNNER & SUMMARY
// ==========================================================================

export async function runMasterSeed(): Promise<void> {
	const startTime = Date.now();
	const isFresh =
		process.argv.includes("--fresh") ||
		process.argv.includes("--clean") ||
		process.env.SEED_FRESH === "true";

	console.log("\n==========================================================================");
	console.log(
		`   🚀 STARTING CTMS MASTER DATABASE SEEDING ${isFresh ? "(FRESH / CLEAN WIPE)" : "(IDEMPOTENT MODE)"}`
	);
	console.log("==========================================================================\n");

	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:master] Refusing to run seed script in production environment!");
	}

	if (!dataSource.isInitialized) {
		console.log("🔌 Connecting to database...");
		await dataSource.initialize();
		console.log("✅ Database connected successfully.\n");
	}

	try {
		if (isFresh) {
			console.log("--------------------------------------------------------------------------");
			console.log("👉 [0/7] Wiping all database tables clean (--fresh mode)...");
			console.log("--------------------------------------------------------------------------");
			await cleanDatabase(dataSource);
			console.log("✅ Database wiped clean.\n");
		}

		// Step 1: Admin & Porter default accounts
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [1/7] Seeding Admin & Porter accounts...");
		console.log("--------------------------------------------------------------------------");
		await seedDevAdmin();
		console.log("✅ Step 1 completed.\n");

		// Step 2: Host & default trekking route
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [2/7] Seeding Host profile & baseline trekking route...");
		console.log("--------------------------------------------------------------------------");
		await seedDevHostAndRoute();
		console.log("✅ Step 2 completed.\n");

		// Step 3: Full Trips ecosystem (Catalogs, Equipment, Routes, Checkpoints, Danger Zones, Porters, Campers, Health & Contacts, Bookings, Diverse Statuses)
		console.log("--------------------------------------------------------------------------");
		console.log(
			"👉 [3/7] Seeding Trips ecosystem (Routes, Checkpoints, Danger Zones, Equipment, Porters, Health, Bookings & Statuses)..."
		);
		console.log("--------------------------------------------------------------------------");
		await seedDevTrips();
		console.log("✅ Step 3 completed.\n");

		// Step 4: Weather Risk Assessment scenarios (Green / Red routes + Weather Advice)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [4/7] Seeding Weather Risk Scenarios (Green & Red routes + AI Advice)...");
		console.log("--------------------------------------------------------------------------");
		await seedWeatherRiskScenarios();
		console.log("✅ Step 4 completed.\n");

		// Step 5: Camper Refund Scenarios (Pre-trip cancellation, Post-completion complaint, Already refunded)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [5/7] Seeding Camper Refund & Dispute Scenarios...");
		console.log("--------------------------------------------------------------------------");
		const refundScenarios = await seedCamperRefunds();
		console.log("✅ Step 5 completed.\n");

		// Step 6: Settlements, Host Wallets & Payout Requests
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [6/7] Seeding Settlements, Host Wallets & Payout Requests...");
		console.log("--------------------------------------------------------------------------");
		await seedSettlementsAndPayouts();
		console.log("✅ Step 6 completed.\n");

		// Step 7: User Bank Accounts (Host & Camper)
		console.log("--------------------------------------------------------------------------");
		console.log("👉 [7/7] Seeding User Bank Accounts for Camper & Host...");
		console.log("--------------------------------------------------------------------------");
		await seedUserBankAccounts();
		console.log("✅ Step 7 completed.\n");

		const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

		console.log("==========================================================================");
		console.log(`🎉 ALL SEED DATA GENERATED SUCCESSFULLY IN ${elapsedSec}s!`);
		console.log("==========================================================================");
		console.log("\n📋 TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH (4 ROLE CHÍNH):");
		console.log(
			"┌──────────────┬──────────────────────┬─────────────┬────────────────────────────────────┐"
		);
		console.log(
			"│ Role         │ Email                │ Password    │ Full Name / Ghi chú                │"
		);
		console.log(
			"├──────────────┼──────────────────────┼─────────────┼────────────────────────────────────┤"
		);
		console.log(
			"│ Admin        │ admin@ctms.local     │ Admin@123   │ Quản trị viên hệ thống             │"
		);
		console.log(
			"│ Host         │ host@ctms.local      │ Host@123    │ Host Ban Mai (Tất cả tour, ví 3.8M)│"
		);
		console.log(
			"│ Porter       │ porter@ctms.local    │ Porter@123  │ Nguyễn Minh Sơn (chuyên gia Route) │"
		);
		console.log(
			"│ Camper       │ camper@ctms.local    │ Camper@123  │ Camper Nguyễn Văn An               │"
		);
		console.log(
			"└──────────────┴──────────────────────┴─────────────┴────────────────────────────────────┘"
		);

		console.log("\n🔗 CÁC KỊCH BẢN KIỂM THỬ SẴN SÀNG TRÊN HỆ THỐNG:");
		console.log("1. Quyết toán & Chi trả Host (Admin):");
		console.log("   👉 http://localhost:5173/admin/settlements");
		console.log("      - Chuyến đủ điều kiện quyết toán (Eligible > 72h)");
		console.log("      - Chuyến bị khóa giữ tiền (< 72h hold)");
		console.log("      - Chuyến bị giữ do khiếu nại (Dispute/Claim)");
		console.log("      - Duyệt/Từ chối yêu cầu rút tiền của Host (Payouts)");
		console.log("\n2. Ví & Rút tiền của Host (Host login: host@ctms.local):");
		console.log("   👉 http://localhost:5173/host/wallet");
		console.log("      - Xem số dư khả dụng (3.800.000 VNĐ), lịch sử biến động sổ cái");
		console.log("      - Thao tác rút toàn bộ số dư về tài khoản ngân hàng");
		console.log("\n3. Hoàn tiền & Khiếu nại của Camper (Camper login: camper@ctms.local):");
		console.log(
			`   👉 Pre-trip hủy trước khởi hành: http://localhost:5173/bookings/${refundScenarios.preTripBookingId}`
		);
		console.log(
			`   👉 Khiếu nại trong 24h sau chuyến: http://localhost:5173/bookings/${refundScenarios.completedBookingId}`
		);
		console.log(
			`   👉 Đã hoàn tiền xong:            http://localhost:5173/bookings/${refundScenarios.alreadyRefundedBookingId}`
		);
		console.log("\n4. Đánh giá rủi ro thời tiết & Lời khuyên AI (Weather Risk):");
		console.log("   👉 Tuyến Xanh: Cho phép đặt chỗ bình thường + Lời khuyên thời tiết");
		console.log("   👉 Tuyến Đỏ: Cảnh báo bão, tự động chặn đăng ký mới + Hướng dẫn khẩn cấp");
		console.log("\n5. Checkpoints & Vùng nguy hiểm trên Route (Trekking Routes):");
		console.log("   👉 Checkpoints trạm nghỉ, trạm cấp nước, điểm trú ẩn, xuất phát, về đích");
		console.log(
			"   👉 Vùng nguy hiểm (vách đá trơn, sạt lở, nước xoáy) với mức độ rủi ro (high/medium)"
		);
		console.log("\n6. Hệ sinh thái Porter & Hồ sơ Camper:");
		console.log(
			"   👉 Porter: hồ sơ đa dạng về availability, kinh nghiệm, qualification và xung đột lịch"
		);
		console.log(
			"   👉 Camper: Hồ sơ sức khỏe (nhóm máu O+, dị ứng, ăn chay) & Người liên hệ khẩn cấp"
		);
		console.log("\n7. Đa dạng trạng thái Vòng đời Tuyến & Chuyến đi:");
		console.log(
			"   👉 Trips: Published, Ongoing (chạy điểm danh/no-show), Pending Approval, Draft, Cancelled"
		);
		console.log(
			"   👉 Routes: Active, Pending Approval (chờ Admin duyệt), Closed (đóng do sạt lở)"
		);
		console.log("\n8. Tài khoản ngân hàng liên kết (User Bank Accounts):");
		console.log(
			"   👉 Host (host@ctms.local): Vietcombank 0123456789 (mặc định), MBBank 9876543210"
		);
		console.log(
			"   👉 Camper (camper@ctms.local): Vietcombank 1012345678 (mặc định), Techcombank 19034567890123"
		);
		console.log("==========================================================================\n");
	} catch (error) {
		console.error("\n❌ MASTER SEED ENCOUNTERED AN ERROR:", error);
		throw error;
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
			console.log("🔌 Database connection closed cleanly.");
		}
	}
}

if (require.main === module) {
	runMasterSeed()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("[master-seed] Failed:", error);
			process.exit(1);
		});
}
