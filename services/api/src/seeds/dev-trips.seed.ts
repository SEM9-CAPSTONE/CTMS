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

		// 2. Ensure active Trekking Routes
		const routesData = [
			{
				name: "Bán Đảo Sơn Trà Discovery",
				description:
					"Cung đường ven biển và rừng nguyên sinh Sơn Trà, thích hợp cho người mới bắt đầu.",
				lengthMeters: 5200,
				difficulty: "easy",
				durationMinutes: 240,
				geom: "SRID=4326;LINESTRING(108.26 16.11, 108.28 16.12, 108.30 16.11)",
			},
			{
				name: "Đỉnh Núi Bidoup Trail",
				description: "Chinh phục nóc nhà tỉnh Lâm Đồng xuyên qua rừng thông và thảm rêu cổ thụ.",
				lengthMeters: 14500,
				difficulty: "moderate",
				durationMinutes: 480,
				geom: "SRID=4326;LINESTRING(108.45 11.94, 108.47 11.96, 108.49 11.97)",
			},
			{
				name: "Bạch Mộc Lương Tử Expedition",
				description: "Hành trình săn mây kỳ vĩ qua sống lưng khủng long và rừng trúc bạt ngàn.",
				lengthMeters: 28000,
				difficulty: "hard",
				durationMinutes: 1200,
				geom: "SRID=4326;LINESTRING(103.62 22.51, 103.65 22.53, 103.68 22.55)",
			},
			{
				name: "Tà Năng - Phan Dũng Cung Đường Huyền Thoại",
				description: "Tuyến trekking chuyển giao giữa cao nguyên Lâm Đồng và đồi cỏ Bình Thuận.",
				lengthMeters: 35000,
				difficulty: "expert",
				durationMinutes: 1800,
				geom: "SRID=4326;LINESTRING(108.38 11.58, 108.42 11.52, 108.48 11.45)",
			},
		];

		const routeIds: Record<string, string> = {};

		for (const r of routesData) {
			const existing: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trekking_routes" WHERE "name" = $1',
				[r.name]
			);
			if (existing.length > 0) {
				routeIds[r.name] = existing[0].id;
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

		// 3. Ensure weather risk assessments
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
			{ routeName: "Đỉnh Núi Bidoup Trail", riskLevel: "yellow", score: 0.45 },
			{ routeName: "Bạch Mộc Lương Tử Expedition", riskLevel: "green", score: 0.2 },
			{ routeName: "Tà Năng - Phan Dũng Cung Đường Huyền Thoại", riskLevel: "red", score: 0.78 },
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

		// 4. Seed published Trips
		const now = new Date();
		const inDays = (d: number, hours = 7) => {
			const date = new Date(now.getTime() + d * 86400000);
			date.setHours(hours, 0, 0, 0);
			return date.toISOString();
		};

		const sampleTrips = [
			{
				title: "Khám Phá Sơn Trà Xanh Trong Ngày",
				routeName: "Bán Đảo Sơn Trà Discovery",
				description:
					"Chuyến đi bộ dã ngoại trong ngày ngắm voọc chà vá chân nâu và rừng nguyên sinh Sơn Trà tuyệt đẹp.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
				tripType: "day_trip",
				durationNights: 0,
				startsAt: inDays(3, 7),
				endsAt: inDays(3, 16),
				meetingPointGeom: "SRID=4326;POINT(108.26 16.11)",
				meetingAt: inDays(3, 6),
				bookingDeadline: inDays(2, 18),
				capacityMin: 5,
				capacityMax: 20,
				seatsTaken: 8,
				pricePerPerson: "450000",
				itinerary: {
					summary: "06:30 tập trung, 07:00 bắt đầu trekking, 11:30 picnic trưa, 16:00 kết thúc.",
				},
				includes: {
					items: ["Hướng dẫn viên", "Nước uống 2L/người", "Bữa trưa dã ngoại", "Bảo hiểm du lịch"],
				},
				excludes: { items: ["Chi phí cá nhân", "Xe đưa đón từ khách sạn"] },
				cancellationPolicy: { policy: "Hủy trước 48h hoàn tiền 100%, sau 48h không hoàn phí." },
				waypoints: [
					{
						name: "Điểm tập kết Cây Đa Ngàn Năm",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(108.26 16.11)",
					},
					{
						name: "Trạm quan sát Đỉnh Bàn Cờ",
						type: "checkpoint",
						day: 1,
						seq: 2,
						duration: 60,
						geom: "SRID=4326;POINT(108.28 16.12)",
					},
					{
						name: "Bãi đá Obama - Ăn trưa",
						type: "meal",
						day: 1,
						seq: 3,
						duration: 90,
						geom: "SRID=4326;POINT(108.29 16.115)",
					},
					{
						name: "Về điểm xuất phát",
						type: "finish",
						day: 1,
						seq: 4,
						duration: 30,
						geom: "SRID=4326;POINT(108.30 16.11)",
					},
				],
			},
			{
				title: "Chinh Phục Đỉnh Núi Bidoup - 2 Ngày 1 Đêm",
				routeName: "Đỉnh Núi Bidoup Trail",
				description:
					"Hành trình trekking 2N1Đ vượt thảm rêu cổ thụ và rừng thông ngút ngàn, cắm trại đêm giữa đại ngàn Lâm Đồng.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 1,
				startsAt: inDays(7, 6),
				endsAt: inDays(8, 17),
				meetingPointGeom: "SRID=4326;POINT(108.45 11.94)",
				meetingAt: inDays(7, 5),
				bookingDeadline: inDays(5, 23),
				capacityMin: 8,
				capacityMax: 16,
				seatsTaken: 12,
				pricePerPerson: "1850000",
				itinerary: {
					summary:
						"Ngày 1: VQG Bidoup - Bãi cắm trại Klong Klanh (10km). Ngày 2: Chinh phục đỉnh 2.287m - Trở về.",
				},
				includes: {
					items: [
						"Lều trại & túi ngủ",
						"Mọi bữa ăn trong tour (4 bữa)",
						"HDV & Porter hỗ trợ",
						"Bảo hiểm 50 triệu",
					],
				},
				excludes: { items: ["Balo cá nhân", "Vé máy bay đến Đà Lạt"] },
				cancellationPolicy: { policy: "Hủy trước 5 ngày hoàn 80%, sau 5 ngày hoàn 50%." },
				waypoints: [
					{
						name: "Trụ sở VQG Bidoup",
						type: "start",
						day: 1,
						seq: 1,
						duration: 45,
						geom: "SRID=4326;POINT(108.45 11.94)",
					},
					{
						name: "Đồi thông ngút ngàn",
						type: "rest",
						day: 1,
						seq: 2,
						duration: 30,
						geom: "SRID=4326;POINT(108.46 11.95)",
					},
					{
						name: "Bãi cắm trại Klong Klanh",
						type: "overnight",
						day: 1,
						seq: 3,
						duration: 600,
						geom: "SRID=4326;POINT(108.47 11.96)",
					},
					{
						name: "Bình minh Đỉnh Bidoup 2.287m",
						type: "activity",
						day: 2,
						seq: 4,
						duration: 90,
						geom: "SRID=4326;POINT(108.49 11.97)",
					},
					{
						name: "Xuống núi - Kết thúc",
						type: "finish",
						day: 2,
						seq: 5,
						duration: 60,
						geom: "SRID=4326;POINT(108.45 11.94)",
					},
				],
			},
			{
				title: "Bạch Mộc Lương Tử - Săn Mây Đại Ngàn (Đã Hết Chỗ)",
				routeName: "Bạch Mộc Lương Tử Expedition",
				description:
					"Cung trekking săn mây kinh điển miền Bắc vượt qua đồi trọc, rừng trúc và sống lưng khủng long ngoạn mục.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 2,
				startsAt: inDays(12, 5),
				endsAt: inDays(14, 18),
				meetingPointGeom: "SRID=4326;POINT(103.62 22.51)",
				meetingAt: inDays(12, 4),
				bookingDeadline: inDays(10, 12),
				capacityMin: 6,
				capacityMax: 10,
				seatsTaken: 10,
				pricePerPerson: "3200000",
				itinerary: {
					summary:
						"Ngày 1: Sàng Ma Sáo - Lán nghỉ 2.100m. Ngày 2: Chinh phục đỉnh Muối 3.046m. Ngày 3: Xuống núi.",
				},
				includes: {
					items: [
						"Xe giường nằm khứ hồi Hà Nội - Sapa",
						"Lán nghỉ & chăn ấm",
						"Đồ ăn ấm nóng",
						"Porter chuyên nghiệp",
					],
				},
				excludes: { items: ["Đồ uống có cồn", "Tiền tip porter"] },
				cancellationPolicy: { policy: "Hủy trước 7 ngày hoàn 90%." },
				waypoints: [
					{
						name: "Bản Ki Quan San",
						type: "start",
						day: 1,
						seq: 1,
						duration: 30,
						geom: "SRID=4326;POINT(103.62 22.51)",
					},
					{
						name: "Lán nghỉ 2.100m",
						type: "overnight",
						day: 1,
						seq: 2,
						duration: 600,
						geom: "SRID=4326;POINT(103.65 22.53)",
					},
					{
						name: "Đỉnh Muối 3.046m Săn Mây",
						type: "activity",
						day: 2,
						seq: 3,
						duration: 120,
						geom: "SRID=4326;POINT(103.68 22.55)",
					},
					{
						name: "Hạ trại về lại bản",
						type: "finish",
						day: 3,
						seq: 4,
						duration: 60,
						geom: "SRID=4326;POINT(103.62 22.51)",
					},
				],
			},
			{
				title: "Tà Năng - Phan Dũng: Thử Thách Băng Rừng Đồi Cỏ",
				routeName: "Tà Năng - Phan Dũng Cung Đường Huyền Thoại",
				description:
					"Cung trekking cấp độ Chuyên Gia băng qua những triền cỏ cháy và dốc đứng, thử thách ý chí của những đôi chân bền bỉ.",
				coverImageUrl:
					"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
				tripType: "overnight",
				durationNights: 2,
				startsAt: inDays(15, 6),
				endsAt: inDays(17, 16),
				meetingPointGeom: "SRID=4326;POINT(108.38 11.58)",
				meetingAt: inDays(15, 5),
				bookingDeadline: inDays(12, 12),
				capacityMin: 8,
				capacityMax: 15,
				seatsTaken: 3,
				pricePerPerson: "2650000",
				itinerary: {
					summary:
						"Ngày 1: Tà Năng - Cắm trại đồi lính. Ngày 2: Đồi lính - Thác Yavly. Ngày 3: Ra bìa rừng Phan Dũng.",
				},
				includes: {
					items: [
						"Trang bị an toàn SOS",
						"Xe ôm trung chuyển cuối chặng",
						"Đội ngũ dẫn đường bản địa",
						"Bảo hiểm du lịch",
					],
				},
				excludes: { items: ["Chi phí cá nhân"] },
				cancellationPolicy: { policy: "Hủy trước 7 ngày hoàn 80%." },
				waypoints: [
					{
						name: "Nhà đồng bào Tà Năng",
						type: "start",
						day: 1,
						seq: 1,
						duration: 40,
						geom: "SRID=4326;POINT(108.38 11.58)",
					},
					{
						name: "Đồi Lính - Cắm trại hoàng hôn",
						type: "overnight",
						day: 1,
						seq: 2,
						duration: 600,
						geom: "SRID=4326;POINT(108.42 11.52)",
					},
					{
						name: "Thác Yavly",
						type: "activity",
						day: 2,
						seq: 3,
						duration: 180,
						geom: "SRID=4326;POINT(108.45 11.48)",
					},
					{
						name: "Bìa rừng Phan Dũng",
						type: "finish",
						day: 3,
						seq: 4,
						duration: 45,
						geom: "SRID=4326;POINT(108.48 11.45)",
					},
				],
			},
		];

		for (const st of sampleTrips) {
			const routeId = routeIds[st.routeName];
			if (!routeId) continue;

			const existingTrip: Array<{ id: string }> = await dataSource.query(
				'SELECT "id" FROM "trips" WHERE "title" = $1',
				[st.title]
			);

			let tripId = "";
			if (existingTrip.length > 0) {
				tripId = existingTrip[0].id;
				console.log(`[seed:dev-trips] Trip already exists: ${st.title} (${tripId})`);
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

			// Add waypoints
			for (const wp of st.waypoints) {
				const existingWp: Array<{ id: string }> = await dataSource.query(
					'SELECT "id" FROM "trip_waypoints" WHERE "trip_id" = $1 AND "sequence_order" = $2',
					[tripId, wp.seq]
				);
				if (existingWp.length === 0) {
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
