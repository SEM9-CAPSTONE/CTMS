import { hash } from "bcrypt";
import dataSource from "../shared/database/data-source";

const BCRYPT_COST_FACTOR = 10;

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
				category: "shelter",
				quantityTotal: 15,
				rentalPricePerDay: 80000,
				maintenanceSchedule: "Kiểm tra khung nhôm và vải lều sau mỗi chuyến đi",
			},
			{
				name: "Lều cắm trại 4 người Coleman cao cấp",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 140000,
				maintenanceSchedule: "Vệ sinh, phơi khô và kiểm tra cọc ghim định kỳ",
			},
			{
				name: "Túi ngủ dã ngoại du lịch (10°C - 15°C)",
				category: "sleeping",
				quantityTotal: 25,
				rentalPricePerDay: 40000,
				maintenanceSchedule: "Giặt sấy tiệt trùng sau mỗi lần sử dụng",
			},
			{
				name: "Đệm hơi cách nhiệt dã ngoại xếp gọn",
				category: "sleeping",
				quantityTotal: 20,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Kiểm tra van khí và áp lực giữ hơi",
			},
			{
				name: "Balo trekking trợ lực 50L Deuter",
				category: "backpack",
				quantityTotal: 12,
				rentalPricePerDay: 70000,
				maintenanceSchedule: "Kiểm tra hệ thống đai hông, khóa cài và khóa kéo",
			},
			{
				name: "Gậy leo núi Carbon siêu nhẹ (Cặp)",
				category: "gear",
				quantityTotal: 30,
				rentalPricePerDay: 30000,
				maintenanceSchedule: "Kiểm tra khớp vặn khóa và đầu bọc cao su",
			},
			{
				name: "Đèn pin đội đầu chống nước IPX8 Black Diamond",
				category: "lighting",
				quantityTotal: 25,
				rentalPricePerDay: 35000,
				maintenanceSchedule: "Sạc đầy pin lithium và kiểm tra roong chống nước",
			},
			{
				name: "Bếp ga dã ngoại mini và bộ nồi nhôm xếp gọn",
				category: "cooking",
				quantityTotal: 10,
				rentalPricePerDay: 65000,
				maintenanceSchedule: "Kiểm tra van ngắt an toàn và vệ sinh đầu đốt",
			},
			{
				name: "Bộ sơ cứu y tế sinh tồn Trekking",
				category: "safety",
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
				`INSERT INTO "weather_risk_rules" (version, name, config, status, created_by)
				 VALUES ('v1.0', 'Default Risk Rule', '{}'::jsonb, 'active', $1)
				 RETURNING id`,
				[hostId]
			);
			ruleVersionId = insertedRule[0].id;
		}

		const weatherRisks = [
			{ routeName: "Bán Đảo Sơn Trà Discovery", riskLevel: "green", score: 0.15 },
			{ routeName: "Hải Vân Pass - Nam Hải Vân Trail", riskLevel: "yellow", score: 0.45 },
			{ routeName: "Rừng Nguyên Sinh Bà Nà - Núi Chúa", riskLevel: "green", score: 0.2 },
			{ routeName: "Khe Ram - Suối Mơ - Rừng Hòa Bắc", riskLevel: "red", score: 0.78 },
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
							rainfall: { value: 0, level: wr.riskLevel, weight: 0.3, score: 0 },
							wind: { value: 10, level: wr.riskLevel, weight: 0.25, score: 0 },
							temperature: { value: 24, level: wr.riskLevel, weight: 0.15, score: 0 },
							visibility: { value: 10000, level: wr.riskLevel, weight: 0.15, score: 0 },
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
				includes: {
					items: ["Hướng dẫn viên", "Nước uống 2L/người", "Bữa trưa dã ngoại", "Bảo hiểm du lịch"],
				},
				excludes: { items: ["Chi phí cá nhân", "Xe đưa đón từ khách sạn"] },
				cancellationPolicy: { policy: "Hủy trước 48h hoàn tiền 100%, sau 48h không hoàn phí." },
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
				includes: {
					items: [
						"Lều trại & túi ngủ dã ngoại",
						"Bữa tối BBQ bên bãi biển Làng Vân",
						"HDV dẫn đường & đồ cứu hộ",
						"Bảo hiểm du lịch",
					],
				},
				excludes: { items: ["Balo cá nhân", "Chi phí nước ngọt tại làng"] },
				cancellationPolicy: { policy: "Hủy trước 5 ngày hoàn 80%, sau 5 ngày hoàn 50%." },
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
				includes: {
					items: [
						"Xe đưa đón từ trung tâm Đà Nẵng",
						"Lều trại & túi ấm dã ngoại",
						"Suất ăn ấm nóng tại lán",
						"Người dẫn đường kiểm lâm bản địa",
					],
				},
				excludes: { items: ["Đồ uống có cồn", "Tiền tip porter"] },
				cancellationPolicy: { policy: "Hủy trước 7 ngày hoàn 90%." },
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
				includes: {
					items: [
						"Trang bị an toàn áo phao & SOS",
						"Lều trại & bữa ăn dã ngoại",
						"Đội ngũ dẫn đường người Cơ Tu bản địa",
						"Bảo hiểm du lịch",
					],
				},
				excludes: { items: ["Chi phí cá nhân"] },
				cancellationPolicy: { policy: "Hủy trước 48h hoàn 80%." },
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
				includes: {
					items: ["Hướng dẫn viên chuyên nghiệp", "Nước khoáng & trái cây nhẹ"],
				},
				excludes: { items: ["Chi phí di chuyển cá nhân"] },
				cancellationPolicy: { policy: "Không hoàn phí khi đã hết hạn đặt vé." },
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
				includes: {
					items: [
						"Hướng dẫn viên chuyên nghiệp & người hỗ trợ",
						"Bữa tối BBQ hải sản và bữa sáng dã ngoại",
						"Bảo hiểm du lịch",
					],
				},
				excludes: {
					items: [
						"Thiết bị cá nhân (có thể thuê thêm lều, túi ngủ, balo ở mục bên dưới)",
						"Chi phí phát sinh ngoài chương trình",
					],
				},
				cancellationPolicy: {
					version: 1,
					rules: [
						{ minHoursBeforeTrip: 72, refundPercent: 100 },
						{ minHoursBeforeTrip: 24, refundPercent: 50 },
						{ minHoursBeforeTrip: 0, refundPercent: 0 },
					],
					policy: "Hủy trước 3 ngày hoàn 100%, trước 24h hoàn 50%, sau 24h không hoàn tiền.",
				},
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
				includes: {
					items: [
						"Hướng dẫn viên chuyên tuyến Sơn Trà",
						"Nước uống & Bữa trưa picnic dinh dưỡng",
						"Bảo hiểm du lịch",
					],
				},
				excludes: {
					items: [
						"Gậy leo núi & Balo trợ lực (có thể chọn thuê ngay khi đặt tour)",
						"Chi phí cá nhân",
					],
				},
				cancellationPolicy: {
					version: 1,
					rules: [
						{ minHoursBeforeTrip: 48, refundPercent: 100 },
						{ minHoursBeforeTrip: 24, refundPercent: 50 },
						{ minHoursBeforeTrip: 0, refundPercent: 0 },
					],
					policy: "Hủy trước 48h hoàn 100%, trước 24h hoàn 50%, sau 24h không hoàn tiền.",
				},
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
						seats_taken = $15,
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
						JSON.stringify(st.includes),
						JSON.stringify(st.excludes),
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
						JSON.stringify(st.includes),
						JSON.stringify(st.excludes),
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

		console.log("[seed:dev-trips] Seeding completed successfully!");
	} catch (error) {
		console.error("[seed:dev-trips] Error seeding trips:", error);
	}
}

if (require.main === module) {
	seedDevTrips()
		.then(async () => {
			if (dataSource.isInitialized) {
				await dataSource.destroy();
			}
		})
		.catch((err) => {
			console.error(err);
			process.exitCode = 1;
		});
}
