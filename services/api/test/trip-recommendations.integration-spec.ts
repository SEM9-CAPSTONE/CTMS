import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TripRecommendationsProvider } from "../src/modules/trip-recommendations/trip-recommendations.provider";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { WEATHER_PROVIDER } from "../src/modules/weather/providers/weather-provider.interface";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

/** Calm hourly readings; the Trips below are mostly far beyond the forecast horizon anyway. */
const weatherProviderStub = {
	fetchCurrent: jest.fn(),
	fetchHourlyForecast: jest.fn(async (_lat: number, _lng: number, from: Date, to: Date) => {
		const hours = [];
		for (
			let t = Math.floor(from.getTime() / 3_600_000) * 3_600_000;
			t <= to.getTime();
			t += 3_600_000
		) {
			hours.push({
				time: new Date(t),
				rainfallMm: 0,
				windKph: 5,
				temperatureC: 24,
				visibilityM: 20000,
				thunderstorm: false,
				providerWeatherCode: 1,
			});
		}
		return { hours, raw: {} };
	}),
};

/** Replaces the HTTP call to the Python service; each test decides what the ranker does. */
const aiStub = {
	modelVersion: jest.fn((): string | null => null),
	rank: jest.fn(async (): Promise<unknown> => ({ ranking: [] })),
	cacheTtlMs: jest.fn(() => 24 * 3_600_000),
};

const inDays = (days: number, hours = 0) =>
	new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

interface TripOptions {
	title: string;
	tripType?: "day_trip" | "overnight";
	difficulty?: "easy" | "moderate" | "hard" | "expert";
	/** [lng, lat] of the meeting point. */
	point?: [number, number];
	price?: number;
	startsAt?: string;
	deadline?: string;
	capacityMax?: number | null;
	seatsTaken?: number;
	routeStatus?: "active" | "closed";
	weatherPaused?: boolean;
	riskLevel?: "green" | "yellow" | "red" | null;
	status?: "published" | "draft";
}

const DA_NANG: [number, number] = [108.27, 16.1];
const BA_NA: [number, number] = [107.99, 15.997];

describe("Trip recommendations (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let host: Account;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let ruleId: string;

	beforeAll(async () => {
		jest.setTimeout(60000);
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(WEATHER_PROVIDER)
			.useValue(weatherProviderStub)
			.overrideProvider(TripRecommendationsProvider)
			.useValue(aiStub)
			.compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
		host = await createAccount(UserRole.HOST);
		ruleId = randomUUID();
		await dataSource.query(
			`INSERT INTO "weather_risk_rules" (
				"id", "rainfall_yellow_threshold", "rainfall_red_threshold",
				"wind_yellow_threshold", "wind_red_threshold", "temp_low_yellow", "temp_low_red",
				"temp_high_yellow", "temp_high_red", "visibility_yellow_threshold",
				"visibility_red_threshold", "thunderstorm_yellow", "thunderstorm_red",
				"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight",
				"thunderstorm_weight", "green_max_score", "yellow_max_score", "is_active"
			) VALUES ($1, 10, 50, 40, 70, 5, 0, 38, 42, 5000, 1000, true, true,
				0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, false)`,
			[ruleId]
		);
	}, 60000);

	beforeEach(() => {
		aiStub.modelVersion.mockReset().mockReturnValue(null);
		aiStub.rank.mockReset().mockResolvedValue({ ranking: [] });
	});

	afterEach(async () => {
		// Each scenario starts from an empty catalogue so results never depend on other tests.
		if (tripIds.length > 0) {
			await dataSource.query(`UPDATE "trips" SET "status" = 'draft' WHERE "id" = ANY($1)`, [
				tripIds,
			]);
		}
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query('DELETE FROM "trip_recommendation_runs" WHERE "user_id" = ANY($1)', [
				userIds,
			]);
			await dataSource.query('DELETE FROM "camper_trip_preferences" WHERE "user_id" = ANY($1)', [
				userIds,
			]);
			await dataSource.query('DELETE FROM "health_profiles" WHERE "user_id" = ANY($1)', [userIds]);
			if (tripIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)', [
					tripIds,
				]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "weather_risk_assessments" WHERE "route_id" = ANY($1)',
					[routeIds]
				);
				await dataSource.query('DELETE FROM "weather_snapshots" WHERE "route_id" = ANY($1)', [
					routeIds,
				]);
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = $1', [ruleId]);
			// Profile updates made through the API leave the Camper's own audit entries.
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'not-a-real-hash', $3, $4, 'Trần Minh Khoa')`,
			[id, `recommendation-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(options: TripOptions): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		const [lng, lat] = options.point ?? DA_NANG;
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters",
				"difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint($5, $6), ST_MakePoint($5 + 0.02, $6 + 0.02)), 4326)::geography,
				6000, $4, 300, $7)`,
			[
				routeId,
				host.id,
				`Tuyến ${options.title}`,
				options.difficulty ?? "moderate",
				lng,
				lat,
				options.routeStatus ?? "active",
			]
		);
		const startsAt = options.startsAt ?? "2035-10-10T01:00:00Z";
		const endsAt = new Date(new Date(startsAt).getTime() + 9 * 3_600_000).toISOString();
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status", "weather_paused_at")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
				$11, 1, $12, $13, $14, $15, $16)`,
			[
				tripId,
				host.id,
				routeId,
				options.title,
				options.tripType ?? "day_trip",
				options.tripType === "overnight" ? 1 : 0,
				startsAt,
				endsAt,
				lng,
				lat,
				options.deadline ?? new Date(new Date(startsAt).getTime() - 86_400_000).toISOString(),
				options.capacityMax === undefined ? 10 : options.capacityMax,
				options.seatsTaken ?? 0,
				options.price ?? 600000,
				options.status ?? "published",
				options.weatherPaused ? new Date() : null,
			]
		);
		if (options.riskLevel !== null) {
			const snapshotId = randomUUID();
			await dataSource.query(
				`INSERT INTO "weather_snapshots" ("id", "route_id", "status", "observed_at") VALUES ($1, $2, 'success', now())`,
				[snapshotId, routeId]
			);
			await dataSource.query(
				`INSERT INTO "weather_risk_assessments" ("route_id", "snapshot_id", "rule_version_id",
					"risk_level", "composite_score", "criteria_scores", "created_by")
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					routeId,
					snapshotId,
					ruleId,
					options.riskLevel ?? "green",
					options.riskLevel === "red" ? 2 : 0,
					{
						rainfall: { value: 0, level: options.riskLevel ?? "green", weight: 0.3, score: 0 },
						wind: { value: 0, level: "green", weight: 0.2, score: 0 },
						temperature: { value: 20, level: "green", weight: 0.2, score: 0 },
						visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
						thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
					},
					host.id,
				]
			);
		}
		return tripId;
	}

	const get = (path: string, account: Account) =>
		request(app.getHttpServer())
			.get(`/api${path}`)
			.set("Authorization", `Bearer ${account.accessToken}`);
	const put = (path: string, account: Account, body: object) =>
		request(app.getHttpServer())
			.put(`/api${path}`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send(body);
	const patch = (path: string, account: Account, body: object) =>
		request(app.getHttpServer())
			.patch(`/api${path}`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send(body);
	const recommendedIds = async (account: Account): Promise<string[]> =>
		(await get("/trip-recommendations", account).expect(200)).body.items.map(
			(item: { trip: { id: string } }) => item.trip.id
		);
	const NO_PREFERENCES = {
		tripTypes: [],
		difficulties: [],
		regions: [],
		minPrice: null,
		maxPrice: null,
	};
	/** A Camper with a price range every fixture Trip matches, so recommendations are generated. */
	const createCamperWithSignal = async (): Promise<Account> => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			maxPrice: 5000000,
		}).expect(200);
		return camper;
	};

	it("allows only active Campers", async () => {
		await request(app.getHttpServer()).get("/api/trip-recommendations").expect(401);
		await get("/trip-recommendations", host).expect(403);
		await get("/profiles/me/trip-preferences", host).expect(403);
		const locked = await createAccount(UserRole.CAMPER);
		await dataSource.query(`UPDATE "users" SET "status" = 'suspended' WHERE "id" = $1`, [
			locked.id,
		]);
		await get("/trip-recommendations", locked).expect(401);
	});

	it("reads, replaces and clears preferences per Camper", async () => {
		const first = await createAccount(UserRole.CAMPER);
		const second = await createAccount(UserRole.CAMPER);
		const initial = await get("/profiles/me/trip-preferences", first).expect(200);
		expect(initial.body).toMatchObject({ ...NO_PREFERENCES, updatedAt: null });
		expect(initial.body.regionOptions).toContainEqual({
			code: "ba_na_hoa_vang",
			label: "Bà Nà – Hòa Vang",
		});

		const chosen = {
			tripTypes: ["overnight"],
			difficulties: ["hard", "expert"],
			regions: ["ba_na_hoa_vang"],
			minPrice: 1000000,
			maxPrice: 3000000,
		};
		await put("/profiles/me/trip-preferences", first, chosen).expect(200);
		expect((await get("/profiles/me/trip-preferences", first).expect(200)).body).toMatchObject(
			chosen
		);
		// Another Camper never sees or changes these.
		expect((await get("/profiles/me/trip-preferences", second).expect(200)).body).toMatchObject(
			NO_PREFERENCES
		);

		await put("/profiles/me/trip-preferences", first, NO_PREFERENCES).expect(200);
		expect((await get("/profiles/me/trip-preferences", first).expect(200)).body).toMatchObject(
			NO_PREFERENCES
		);
	});

	it.each([
		["unknown trip type", { ...NO_PREFERENCES, tripTypes: ["camping"] }],
		["internal id as region", { ...NO_PREFERENCES, regions: [randomUUID()] }],
		["duplicate value", { ...NO_PREFERENCES, difficulties: ["easy", "easy"] }],
		["negative price", { ...NO_PREFERENCES, minPrice: -1 }],
		["inverted range", { ...NO_PREFERENCES, minPrice: 2000000, maxPrice: 1000000 }],
		["missing field", { tripTypes: [] }],
	])("rejects %s", async (_label, body) => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, body).expect(422);
	});

	it("only suggests Trips the booking flow would accept", async () => {
		const camper = await createCamperWithSignal();
		const open = await createTrip({ title: "Khám phá bán đảo Sơn Trà" });
		const unlimited = await createTrip({ title: "Ngắm bình minh đỉnh Bàn Cờ", capacityMax: null });
		const excluded = await Promise.all([
			createTrip({ title: "Đèo Hải Vân", deadline: new Date(Date.now() - 1000).toISOString() }),
			createTrip({ title: "Thác Hòa Phú Thành", capacityMax: 4, seatsTaken: 4 }),
			createTrip({ title: "Rừng nguyên sinh Bà Nà", routeStatus: "closed" }),
			createTrip({ title: "Suối Mơ", weatherPaused: true }),
			createTrip({ title: "Hồ Đồng Xanh", riskLevel: "red" }),
			createTrip({ title: "Núi Thần Tài", riskLevel: null }),
			createTrip({ title: "Làng Đá Ngọc", status: "draft" }),
		]);
		const ids = await recommendedIds(camper);
		expect(ids.sort()).toEqual([open, unlimited].sort());
		for (const id of excluded) expect(ids).not.toContain(id);
	});

	it("applies the trip-date forecast policy: Red blocks within 3 days of departure only", async () => {
		const camper = await createCamperWithSignal();
		const soon = await createTrip({
			title: "Cắm trại Rạn Nam Ô",
			startsAt: inDays(2),
			deadline: inDays(1),
		});
		const later = await createTrip({
			title: "Trekking Bạch Mã",
			startsAt: inDays(8),
			deadline: inDays(7),
		});
		for (const tripId of [soon, later]) {
			const [trip] = await dataSource.query(
				`SELECT "route_id", "starts_at", "ends_at" FROM "trips" WHERE "id" = $1`,
				[tripId]
			);
			await dataSource.query(
				`INSERT INTO "trip_weather_forecasts" ("trip_id", "route_id", "status", "trip_starts_at",
					"trip_ends_at", "risk_level", "composite_score", "created_by", "forecast_from",
					"forecast_to", "worst_reading", "rule_version_id", "criteria_scores")
				 VALUES ($1, $2, 'available', $3, $4, 'red', 2, $5, $3, $4, $6, $7, $8)`,
				[
					tripId,
					trip.route_id,
					trip.starts_at,
					trip.ends_at,
					host.id,
					{ rainfallMm: 90 },
					ruleId,
					{ rainfall: { value: 90, level: "red", weight: 0.3, score: 2 } },
				]
			);
		}
		const ids = await recommendedIds(camper);
		expect(ids).not.toContain(soon);
		expect(ids).toContain(later);
	});

	it("asks a new Camper to choose preferences before generating anything", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await createTrip({ title: "Khám phá bán đảo Sơn Trà" });
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body).toMatchObject({ status: "needs_preferences", items: [], mode: null });
		const runs = await dataSource.query(
			`SELECT 1 FROM "trip_recommendation_runs" WHERE "user_id" = $1`,
			[camper.id]
		);
		expect(runs).toEqual([]);
	});

	it("orders equally matching Trips by nearest departure, and never changes the Trips", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			maxPrice: 5000000,
		}).expect(200);
		const third = await createTrip({
			title: "Cung đường ven biển Hoàng Sa",
			startsAt: "2035-12-01T01:00:00Z",
		});
		const first = await createTrip({
			title: "Bình minh Ghềnh Bàng",
			startsAt: "2035-10-01T01:00:00Z",
		});
		const second = await createTrip({
			title: "Đỉnh Bàn Cờ Sơn Trà",
			startsAt: "2035-11-01T01:00:00Z",
		});
		const before = await dataSource.query(
			`SELECT "id", "seats_taken", "status", "price_per_person", "updated_at" FROM "trips" WHERE "id" = ANY($1) ORDER BY "id"`,
			[[first, second, third]]
		);
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body).toMatchObject({ status: "ready", mode: "rules" });
		expect(response.body.items.map((item: { trip: { id: string } }) => item.trip.id)).toEqual([
			first,
			second,
			third,
		]);
		expect(response.body.items[0].trip).toMatchObject({
			title: "Bình minh Ghềnh Bàng",
			isBookable: true,
		});
		expect(aiStub.rank).not.toHaveBeenCalled();
		const after = await dataSource.query(
			`SELECT "id", "seats_taken", "status", "price_per_person", "updated_at" FROM "trips" WHERE "id" = ANY($1) ORDER BY "id"`,
			[[first, second, third]]
		);
		expect(after).toEqual(before);
	});

	it("ranks by preferences, falls back without AI and records the run metadata", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		const nearDayTrip = await createTrip({
			title: "Bãi Bụt Sơn Trà",
			startsAt: "2035-09-01T01:00:00Z",
		});
		const highlandsOvernight = await createTrip({
			title: "Săn mây đỉnh Bà Nà",
			tripType: "overnight",
			difficulty: "hard",
			point: BA_NA,
			price: 2200000,
			startsAt: "2035-10-01T01:00:00Z",
		});
		await put("/profiles/me/trip-preferences", camper, {
			tripTypes: ["overnight"],
			difficulties: ["hard"],
			regions: ["ba_na_hoa_vang"],
			minPrice: 1500000,
			maxPrice: 2500000,
		}).expect(200);

		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body.mode).toBe("rules");
		expect(response.body.items[0]).toMatchObject({
			trip: { id: highlandsOvernight },
			reasons: ["preferred_trip_type", "preferred_difficulty"],
		});
		// Preferences rank, they never filter.
		expect(response.body.items.map((item: { trip: { id: string } }) => item.trip.id)).toContain(
			nearDayTrip
		);

		const [run] = await dataSource.query(
			`SELECT * FROM "trip_recommendation_runs" WHERE "user_id" = $1 ORDER BY "generated_at" DESC LIMIT 1`,
			[camper.id]
		);
		expect(run).toMatchObject({
			mode: "rules",
			signal_type: "preferences",
			fallback_reason: "ai_not_configured",
			rules_version: "trip-recommendation-rules-v2",
			eligible_count: 2,
			candidate_count: 2,
		});
		expect(run.results.map((item: { tripId: string }) => item.tripId)).toEqual([
			highlandsOvernight,
			nearDayTrip,
		]);
		expect(JSON.stringify(run)).not.toContain("Săn mây");
	});

	it("uses booking history when no preference is chosen", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		const past = await createTrip({
			title: "Đêm lửa trại Lăng Cô",
			tripType: "overnight",
			difficulty: "expert",
			price: 3500000,
			startsAt: "2035-08-01T01:00:00Z",
		});
		await dataSource.query(
			`INSERT INTO "bookings" ("trip_id", "user_id", "num_people", "status", "payment_status",
				"base_price", "total_amount", "idempotency_key", "request_fingerprint")
			 VALUES ($1, $2, 1, 'confirmed', 'not_required', 0, 0, $3, 'history')`,
			[past, camper.id, randomUUID()]
		);
		const similar = await createTrip({
			title: "Băng rừng Hòa Bắc",
			tripType: "overnight",
			difficulty: "expert",
			price: 3800000,
			startsAt: "2035-10-05T01:00:00Z",
		});
		const other = await createTrip({
			title: "Dạo bộ Ngũ Hành Sơn",
			startsAt: "2035-09-05T01:00:00Z",
		});

		const response = await get("/trip-recommendations", camper).expect(200);
		const ids = response.body.items.map((item: { trip: { id: string } }) => item.trip.id);
		// The already-booked Trip is not suggested again.
		expect(ids).toEqual([similar, other]);
		expect(response.body.items[0].reasons).toEqual(["booked_trip_type", "booked_difficulty"]);
		const [run] = await dataSource.query(
			`SELECT "signal_type" FROM "trip_recommendation_runs" WHERE "user_id" = $1 ORDER BY "generated_at" DESC LIMIT 1`,
			[camper.id]
		);
		expect(run.signal_type).toBe("history");
	});

	it("re-checks after AI ranking and still refuses an over-capacity booking", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			tripTypes: ["day_trip"],
		}).expect(200);
		const fillsUp = await createTrip({
			title: "Thung lũng Hòa Ninh",
			capacityMax: 2,
			startsAt: "2035-09-10T01:00:00Z",
		});
		const stays = await createTrip({ title: "Suối Hoa Hòa Phú", startsAt: "2035-09-20T01:00:00Z" });
		aiStub.modelVersion.mockReturnValue("gpt-test");
		aiStub.rank.mockImplementation(async () => {
			// Another Camper takes the last seats while the ranker works.
			await dataSource.query(`UPDATE "trips" SET "seats_taken" = 2 WHERE "id" = $1`, [fillsUp]);
			return {
				ranking: [
					{ code: "c01", reasons: [] },
					{ code: "c02", reasons: [] },
				],
			};
		});
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body.mode).toBe("ai");
		expect(response.body.items.map((item: { trip: { id: string } }) => item.trip.id)).toEqual([
			stays,
		]);

		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId: fillsUp, numPeople: 1 })
			.expect(409);
		const [trip] = await dataSource.query(`SELECT "seats_taken" FROM "trips" WHERE "id" = $1`, [
			fillsUp,
		]);
		expect(trip.seats_taken).toBe(2);

		// Preferences -> suggestion -> detail -> booking: the suggested Trip books normally.
		const detail = await get(`/trips/${stays}`, camper).expect(200);
		expect(detail.body).toMatchObject({ id: stays, isBookable: true });
		await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId: stays, numPeople: 1 })
			.expect(201);
		// A booked Trip is no longer suggested to the same Camper.
		expect(await recommendedIds(camper)).not.toContain(stays);
	});

	it("falls back to the base order when the AI answers with unknown codes", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			maxPrice: 1000000,
		}).expect(200);
		const cheap = await createTrip({
			title: "Rừng dừa Bảy Mẫu",
			price: 400000,
			startsAt: "2035-11-01T01:00:00Z",
		});
		const pricey = await createTrip({
			title: "Vịnh Lăng Cô",
			price: 1900000,
			startsAt: "2035-10-01T01:00:00Z",
		});
		aiStub.modelVersion.mockReturnValue("gpt-test");
		aiStub.rank.mockResolvedValue({ ranking: [{ code: pricey, reasons: [] }] });
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body.mode).toBe("rules");
		expect(response.body.items.map((item: { trip: { id: string } }) => item.trip.id)).toEqual([
			cheap,
			pricey,
		]);
		const [run] = await dataSource.query(
			`SELECT "fallback_reason", "model_version" FROM "trip_recommendation_runs" WHERE "user_id" = $1 ORDER BY "generated_at" DESC LIMIT 1`,
			[camper.id]
		);
		expect(run).toEqual({
			fallback_reason: "ai_invalid_output",
			model_version: "gemini/gpt-test",
		});
	});

	it("calls the AI once per profile and again after the Camper changes preferences", async () => {
		const camper = await createAccount(UserRole.CAMPER);
		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			regions: ["son_tra"],
		}).expect(200);
		const sonTra = await createTrip({
			title: "Khám phá bán đảo Sơn Trà",
			startsAt: "2035-10-01T01:00:00Z",
		});
		const baNa = await createTrip({
			title: "Săn mây đỉnh Bà Nà",
			point: BA_NA,
			startsAt: "2035-09-01T01:00:00Z",
		});
		aiStub.modelVersion.mockReturnValue("gpt-test");
		aiStub.rank.mockImplementation(async () => ({
			ranking: [
				{ code: "c02", reasons: [] },
				{ code: "c01", reasons: ["preferred_region"] },
			],
		}));

		const first = await recommendedIds(camper);
		const second = await recommendedIds(camper);
		expect(aiStub.rank).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
		expect(first).toEqual([baNa, sonTra]);

		const runs = await dataSource.query(
			`SELECT "id", "mode", "reused_run_id", "ai_ranking", "signal_fingerprint"
			 FROM "trip_recommendation_runs" WHERE "user_id" = $1 ORDER BY "generated_at"`,
			[camper.id]
		);
		expect(runs).toHaveLength(2);
		expect(runs[0].ai_ranking.map((item: { tripId: string }) => item.tripId)).toEqual([
			baNa,
			sonTra,
		]);
		expect(runs[1]).toMatchObject({ mode: "ai", reused_run_id: runs[0].id, ai_ranking: null });
		expect(runs[1].signal_fingerprint).toBe(runs[0].signal_fingerprint);

		await put("/profiles/me/trip-preferences", camper, {
			...NO_PREFERENCES,
			regions: ["ba_na_hoa_vang"],
		}).expect(200);
		await recommendedIds(camper);
		expect(aiStub.rank).toHaveBeenCalledTimes(2);
	});

	it("returns an empty list when nothing is eligible", async () => {
		const camper = await createCamperWithSignal();
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body.items).toEqual([]);
	});

	async function setHealthProfile(
		camper: Account,
		profile: { fitness: string; consent: boolean; conditions?: boolean }
	): Promise<void> {
		await dataSource.query(
			`INSERT INTO "health_profiles" ("user_id", "physical_fitness_level", "medical_conditions",
				"allergies", "is_consent_granted")
			 VALUES ($1, $2, $3, '[]'::jsonb, $4)
			 ON CONFLICT ("user_id") DO UPDATE SET
				"physical_fitness_level" = EXCLUDED."physical_fitness_level",
				"medical_conditions" = EXCLUDED."medical_conditions",
				"is_consent_granted" = EXCLUDED."is_consent_granted"`,
			[
				camper.id,
				profile.fitness,
				JSON.stringify(
					profile.conditions
						? [{ id: randomUUID(), name: "Hen suyễn", medication: "Ventolin" }]
						: []
				),
				profile.consent,
			]
		);
	}

	it("uses the consented fitness level on the server only and keeps the cached AI order", async () => {
		const camper = await createCamperWithSignal();
		const expert = await createTrip({
			title: "Chinh phục đỉnh Bà Nà",
			point: BA_NA,
			difficulty: "expert",
			startsAt: "2035-09-01T01:00:00Z",
		});
		const easy = await createTrip({
			title: "Dạo bộ bán đảo Sơn Trà",
			difficulty: "easy",
			startsAt: "2035-10-01T01:00:00Z",
		});
		aiStub.modelVersion.mockReturnValue("gpt-test");
		aiStub.rank.mockImplementation(async () => ({
			ranking: [
				{ code: "c01", reasons: [] },
				{ code: "c02", reasons: [] },
			],
		}));

		// Consent off: the profile exists but is ignored.
		await setHealthProfile(camper, { fitness: "BEGINNER", consent: false });
		expect(await recommendedIds(camper)).toEqual([expert, easy]);

		await setHealthProfile(camper, { fitness: "BEGINNER", consent: true, conditions: true });
		const response = await get("/trip-recommendations", camper).expect(200);
		expect(response.body.items.map((item: { trip: { id: string } }) => item.trip.id)).toEqual([
			easy,
			expert,
		]);
		expect(response.body.items[0].reasons[0]).toBe("fitness_match");
		// The health change re-ranked locally; the AI was asked once and never saw health data.
		expect(aiStub.rank).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(aiStub.rank.mock.calls)).not.toMatch(
			/fitness|BEGINNER|Hen suyễn|health/i
		);
	});

	it("explains a suggested Trip to its Camper only", async () => {
		const camper = await createCamperWithSignal();
		const other = await createCamperWithSignal();
		const suggested = await createTrip({
			title: "Săn mây đỉnh Bà Nà",
			point: BA_NA,
			tripType: "overnight",
			difficulty: "hard",
			price: 1850000,
		});
		await setHealthProfile(camper, { fitness: "INTERMEDIATE", consent: true, conditions: true });
		await dataSource.query(`UPDATE "users" SET "bio" = $2 WHERE "id" = $1`, [
			camper.id,
			"Mình làm kế toán ở Hải Châu. Cuối tuần mình mê săn mây trên núi!",
		]);
		// Experience is saved through the profile form's API and survives a reload.
		await patch("/profiles/me", camper, { campingExperienceYears: 51 }).expect(422);
		await patch("/profiles/me", camper, {
			campingExperienceYears: 3,
			trekkingExperienceDetails: "Đã cắm trại qua đêm ở Bà Nà hai lần, từng đi đèo Hải Vân.",
		}).expect(200);
		expect((await get("/profiles/me", camper).expect(200)).body).toMatchObject({
			campingExperienceYears: 3,
			trekkingExperienceDetails: "Đã cắm trại qua đêm ở Bà Nà hai lần, từng đi đèo Hải Vân.",
		});

		// Nothing generated yet.
		await get(`/trip-recommendations/trips/${suggested}/explanation`, camper).expect(404);
		expect(await recommendedIds(camper)).toEqual([suggested]);

		const response = await get(
			`/trip-recommendations/trips/${suggested}/explanation`,
			camper
		).expect(200);
		expect(response.body).toMatchObject({
			tripTitle: "Săn mây đỉnh Bà Nà",
			healthConsidered: true,
		});
		const kinds = response.body.sections.map((section: { kind: string }) => section.kind);
		expect(kinds).toEqual(
			expect.arrayContaining(["fitness", "health_note", "interest", "price", "timing"])
		);
		const section = (kind: string) =>
			response.body.sections.find((item: { kind: string }) => item.kind === kind);
		// Quotes what the Camper entered, then explains and concludes.
		expect(section("fitness").quote).toEqual({
			source: "health_profile",
			field: "Mức thể lực",
			text: "Trung bình (Đã đi 2-5 cung đường)",
		});
		expect(section("fitness").detail).toContain("dài 6 km, đi bộ khoảng 5 giờ");
		expect(section("health_note").quote.text).toBe("Hen suyễn");
		expect(section("health_note").detail).toContain("“Ventolin”");
		expect(section("interest").quote.text).toBe("Cuối tuần mình mê săn mây trên núi");
		expect(section("experience")).toMatchObject({
			tone: "match",
			title: "Bạn đã từng đi khu vực này",
			quote: {
				field: "Kinh nghiệm trekking",
				text: "Đã cắm trại qua đêm ở Bà Nà hai lần, từng đi đèo Hải Vân",
			},
		});
		expect(section("price").quote.text).toBe("Đến 5.000.000 đ");
		expect(section("price").detail).toBe("Giá chuyến là 1.850.000 đ/người.");
		expect(response.body.summary).toMatch(/^Vì vậy chuyến này phù hợp với bạn về /);
		expect(JSON.stringify(response.body)).not.toContain(suggested.slice(0, 8));

		// Another Camper, a Trip that was not suggested, and a malformed id.
		await get(`/trip-recommendations/trips/${suggested}/explanation`, other).expect(404);
		await get(`/trip-recommendations/trips/${randomUUID()}/explanation`, camper).expect(404);
		await get("/trip-recommendations/trips/not-an-id/explanation", camper).expect(400);
		await get(`/trip-recommendations/trips/${suggested}/explanation`, host).expect(403);
	});

	it("explains without health when consent is off", async () => {
		const camper = await createCamperWithSignal();
		const suggested = await createTrip({ title: "Khám phá bán đảo Sơn Trà" });
		await setHealthProfile(camper, { fitness: "EXPERT", consent: false, conditions: true });
		await recommendedIds(camper);
		const response = await get(
			`/trip-recommendations/trips/${suggested}/explanation`,
			camper
		).expect(200);
		expect(response.body.healthConsidered).toBe(false);
		const kinds = response.body.sections.map((section: { kind: string }) => section.kind);
		expect(kinds).not.toContain("fitness");
		expect(kinds).not.toContain("health_note");
		expect(JSON.stringify(response.body)).not.toContain("Hen suyễn");
	});
});
