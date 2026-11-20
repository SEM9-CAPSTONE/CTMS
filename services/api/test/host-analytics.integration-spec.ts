import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { HostAnalyticsAiProvider } from "../src/modules/host-analytics/host-analytics-ai.provider";
import { HostAnalyticsSuggestionsService } from "../src/modules/host-analytics/host-analytics-suggestions.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Host Business Analytics & Suggestions API (CTMS-415, integration)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let suggestionsService: HostAnalyticsSuggestionsService;

	let hostA: TestAccount;
	let hostB: TestAccount;
	let camper: TestAccount;
	let routeA: string;

	const cleanup = {
		users: [] as string[],
		routes: [] as string[],
		trips: [] as string[],
		bookings: [] as string[],
	};

	const mockAiProvider = {
		generatePlanningSelections: jest.fn(),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(HostAnalyticsAiProvider)
			.useValue(mockAiProvider)
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
		suggestionsService = moduleRef.get(HostAnalyticsSuggestionsService);

		hostA = await createAccount("host", "Võ Minh Hải");
		hostB = await createAccount("host", "Trịnh Bảo Ngọc");
		camper = await createAccount("camper", "Đặng Quốc Huy");

		routeA = await createRoute(hostA.id, "Cung đường đỉnh Sơn Trà");
		const routeB = await createRoute(hostB.id, "Cung đường suối Mơ");

		// Completed & settled trip for Host A
		const tripA = await createTrip({
			hostId: hostA.id,
			routeId: routeA,
			title: "Khám phá đỉnh Sơn Trà cuối tuần",
			areaCode: "DNG-SON-TRA",
			status: "completed",
			startsAt: "2026-10-15T01:00:00.000Z",
			endsAt: "2026-10-15T09:00:00.000Z",
			capacityMax: 10,
			seatsTaken: 8,
			pricePerPerson: 650000,
		});

		const bookingA1 = await createBooking({
			tripId: tripA,
			userId: camper.id,
			status: "completed",
			numPeople: 8,
			totalAmount: 5200000,
			startsAt: "2026-10-15T01:00:00.000Z",
			createdAt: "2026-10-05T01:00:00.000Z",
		});
		await createBooking({
			tripId: tripA,
			userId: camper.id,
			status: "cancelled",
			numPeople: 2,
			totalAmount: 0,
			startsAt: "2026-10-15T01:00:00.000Z",
			createdAt: "2026-10-06T01:00:00.000Z",
		});

		await dataSource.query(
			`INSERT INTO payments (booking_id, amount, type, status, provider_reference, succeeded_at, created_at, updated_at)
			 VALUES ($1, 5200000, 'charge', 'succeeded', $2, '2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.000Z')`,
			[bookingA1, `INT-415-${Date.now()}`]
		);
		await dataSource.query(
			`INSERT INTO settlements (trip_id, host_id, settlement_base, commission_rate, platform_fee, net_amount, settled_at, created_at, updated_at)
			 VALUES ($1, $2, 5200000, '0.0500', 260000, 4940000, '2026-10-20T02:00:00.000Z', '2026-10-20T02:00:00.000Z', '2026-10-20T02:00:00.000Z')`,
			[tripA, hostA.id]
		);

		// Upcoming published trip for Host A (must NOT pollute completed fillRate)
		await createTrip({
			hostId: hostA.id,
			routeId: routeA,
			title: "Đón bình minh Sơn Trà tháng tới",
			areaCode: "DNG-SON-TRA",
			status: "published",
			startsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
			endsAt: new Date(Date.now() + 14 * 86400000 + 8 * 3600000).toISOString(),
			capacityMax: 10,
			seatsTaken: 2,
			pricePerPerson: 650000,
		});

		// Host B trip (must NEVER appear in Host A analytics)
		await createTrip({
			hostId: hostB.id,
			routeId: routeB,
			title: "Suối Mơ mùa thu",
			areaCode: "DNG-SON-TRA",
			status: "completed",
			startsAt: "2026-10-16T01:00:00.000Z",
			endsAt: "2026-10-16T09:00:00.000Z",
			capacityMax: 10,
			seatsTaken: 10,
			pricePerPerson: 900000,
		});
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (cleanup.users.length > 0) {
				await dataSource.query(
					"DELETE FROM host_trip_suggestions WHERE host_id = ANY($1::uuid[])",
					[cleanup.users]
				);
				await dataSource.query(
					"DELETE FROM host_analytics_suggestion_jobs WHERE host_id = ANY($1::uuid[])",
					[cleanup.users]
				);
				await dataSource.query(
					"DELETE FROM host_analytics_control WHERE host_id = ANY($1::uuid[])",
					[cleanup.users]
				);
			}
			if (cleanup.trips.length > 0) {
				await dataSource.query("DELETE FROM settlements WHERE trip_id = ANY($1::uuid[])", [
					cleanup.trips,
				]);
			}
			if (cleanup.bookings.length > 0) {
				await dataSource.query("DELETE FROM payments WHERE booking_id = ANY($1::uuid[])", [
					cleanup.bookings,
				]);
				await dataSource.query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [
					cleanup.bookings,
				]);
			}
			if (cleanup.trips.length > 0) {
				await dataSource.query("DELETE FROM trips WHERE id = ANY($1::uuid[])", [cleanup.trips]);
			}
			if (cleanup.routes.length > 0) {
				await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1::uuid[])", [
					cleanup.routes,
				]);
			}
			if (cleanup.users.length > 0) {
				await dataSource.query("DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])", [
					cleanup.users,
				]);
				await dataSource.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [cleanup.users]);
			}
		}
		if (app) await app.close();
	});

	it("reconciles financial KPIs identically with GET /api/reports/revenue, separates upcoming, and enforces Host isolation", async () => {
		const query = {
			from: "2026-10-01T00:00:00.000Z",
			to: "2026-10-31T23:59:59.000Z",
			areaCode: "DNG-SON-TRA",
		};

		const [analyticsRes, revenueRes] = await Promise.all([
			request(app.getHttpServer())
				.get("/api/host/analytics")
				.set("Authorization", `Bearer ${hostA.accessToken}`)
				.query(query)
				.expect(200),
			request(app.getHttpServer())
				.get("/api/reports/revenue")
				.set("Authorization", `Bearer ${hostA.accessToken}`)
				.query(query)
				.expect(200),
		]);

		expect(analyticsRes.body.financial.kpis).toEqual(revenueRes.body.kpis);
		expect(analyticsRes.body.financial.kpis.payout).toBeNull();
		expect(analyticsRes.body.operations.fillRate).toBe(80);
		expect(analyticsRes.body.operations.totalGuests).toBe(8);
		expect(analyticsRes.body.operations.cancellationRate).toBe(50);
		expect(analyticsRes.body.upcoming.tripCount).toBe(1);
		expect(analyticsRes.body.upcoming.includesHeldSeats).toBe(true);
		expect(analyticsRes.body.profit).toBeNull();
		expect(analyticsRes.body.profitStatus).toBe("insufficient_data");
		expect(analyticsRes.body.externalSeason).toEqual({ status: "not_available" });
		expect(analyticsRes.body.seasonality.basis).toBe("all_history");

		// Seasonality is calculated on all_history regardless of from/to window
		const narrowRes = await request(app.getHttpServer())
			.get("/api/host/analytics")
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.query({
				from: "2026-11-01T00:00:00.000Z",
				to: "2026-11-15T23:59:59.000Z",
				areaCode: "DNG-SON-TRA",
			})
			.expect(200);
		expect(narrowRes.body.seasonality).toEqual(analyticsRes.body.seasonality);

		// Camper forbidden
		await request(app.getHttpServer())
			.get("/api/host/analytics")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(403);
	});

	it("runs full suggestion job lifecycle, isolates Host B, and validates quick-create-context", async () => {
		const nextMonth = new Date();
		nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
		const monthHint = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`;

		mockAiProvider.generatePlanningSelections.mockResolvedValueOnce({
			selections: [
				{
					candidateId: "cand-1",
					monthHint,
					rationaleCodes: ["high_fill_history"],
				},
			],
		});

		const createRes = await request(app.getHttpServer())
			.post("/api/host/analytics/suggestions")
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.send({
				from: "2026-10-01T00:00:00.000Z",
				to: "2026-10-31T23:59:59.000Z",
				areaCode: "DNG-SON-TRA",
			})
			.expect(202);

		const jobId: string = createRes.body.id;

		// Different params while active -> 409
		await request(app.getHttpServer())
			.post("/api/host/analytics/suggestions")
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.send({
				from: "2026-09-01T00:00:00.000Z",
				to: "2026-10-31T23:59:59.000Z",
			})
			.expect(409);

		// Host B cannot read Host A's job
		await request(app.getHttpServer())
			.get(`/api/host/analytics/suggestions/${jobId}`)
			.set("Authorization", `Bearer ${hostB.accessToken}`)
			.expect(404);

		// Process queued job
		await suggestionsService.processNextJob();

		const latestRes = await request(app.getHttpServer())
			.get("/api/host/analytics/suggestions/latest")
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.expect(200);

		expect(latestRes.body.status).toBe("succeeded");
		expect(latestRes.body.suggestions).toHaveLength(1);
		const sugId: string = latestRes.body.suggestions[0].id;

		const quickCtx = await request(app.getHttpServer())
			.get(`/api/host/analytics/suggestions/${sugId}/quick-create-context`)
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.expect(200);

		expect(quickCtx.body).toEqual({
			valid: true,
			prefill: {
				routeId: routeA,
				areaCode: "DNG-SON-TRA",
				tripType: "day_trip",
				pricePerPerson: 650000,
				capacityMin: 4,
				suggestedMonth: monthHint,
			},
		});
	});

	async function createAccount(role: "host" | "camper", fullName: string): Promise<TestAccount> {
		const email = `ctms415-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ctms.local`;
		const passwordHash = await hash("Test@123", 4);
		const [user] = await dataSource.query<Array<{ id: string }>>(
			`INSERT INTO users (email, password_hash, full_name, role, status)
			 VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
			[email, passwordHash, fullName, role]
		);
		cleanup.users.push(user.id);
		await dataSource.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [
			user.id,
			role,
		]);
		const accessToken = jwtService.sign({ sub: user.id, roles: [role] });
		return { id: user.id, accessToken };
	}

	async function createRoute(hostId: string, name: string): Promise<string> {
		const [route] = await dataSource.query<Array<{ id: string }>>(
			`INSERT INTO trekking_routes (host_id, name, description, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Tuyến kiểm thử tích hợp', ST_GeomFromEWKT('SRID=4326;LINESTRING(108.22 16.05, 108.25 16.07)'), 4200, 'moderate', 180, 'active')
			 RETURNING id`,
			[hostId, name]
		);
		cleanup.routes.push(route.id);
		return route.id;
	}

	async function createTrip(input: {
		hostId: string;
		routeId: string;
		title: string;
		areaCode: string;
		status: string;
		startsAt: string;
		endsAt: string;
		capacityMax: number | null;
		seatsTaken: number;
		pricePerPerson: number;
	}): Promise<string> {
		const [trip] = await dataSource.query<Array<{ id: string }>>(
			`INSERT INTO trips (host_id, route_id, title, description, trip_type, duration_nights,
				starts_at, ends_at, meeting_point, meeting_at, booking_deadline, capacity_min, capacity_max,
				seats_taken, price_per_person, status, area_code, area_name, province_code, province_name)
			 SELECT $1::uuid, $2::uuid, $3::varchar, 'Mô tả chuyến đi', 'day_trip', 0,
				$4::timestamptz, $5::timestamptz, ST_SetSRID(ST_MakePoint(108.22, 16.05), 4326)::geography,
				$4::timestamptz - interval '30 minutes', $4::timestamptz - interval '2 days',
				4, $6::int, $7::int, $8::numeric, $9::trip_status,
				ga.code, ga.name, ga.province_code, ga.province_name
			 FROM geo_areas ga WHERE ga.code = $10
			 RETURNING id`,
			[
				input.hostId,
				input.routeId,
				input.title,
				input.startsAt,
				input.endsAt,
				input.capacityMax,
				input.seatsTaken,
				input.pricePerPerson,
				input.status,
				input.areaCode,
			]
		);
		cleanup.trips.push(trip.id);
		return trip.id;
	}

	async function createBooking(input: {
		tripId: string;
		userId: string;
		status: string;
		numPeople: number;
		totalAmount: number;
		startsAt: string;
		createdAt: string;
	}): Promise<string> {
		const [booking] = await dataSource.query<Array<{ id: string }>>(
			`INSERT INTO bookings (trip_id, user_id, num_people, status, payment_status, total_amount, trip_starts_at_snapshot, created_at)
			 VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7) RETURNING id`,
			[
				input.tripId,
				input.userId,
				input.numPeople,
				input.status,
				input.totalAmount,
				input.startsAt,
				input.createdAt,
			]
		);
		cleanup.bookings.push(booking.id);
		return booking.id;
	}
});
