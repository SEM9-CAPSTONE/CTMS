import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestAccount {
	id: string;
	email: string;
	accessToken: string;
}

describe("Performance Reports API (CTMS-101, BR-283, BR-211, integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;

	let admin: TestAccount;
	let host: TestAccount;
	let otherHost: TestAccount;
	let camper: TestAccount;

	const cleanupUserIds: string[] = [];
	const cleanupRouteIds: string[] = [];
	const cleanupTripIds: string[] = [];
	const cleanupBookingIds: string[] = [];
	const cleanupSettlementIds: string[] = [];

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

		admin = await createAccount("admin", "Admin System");
		host = await createAccount("host", "Host One");
		otherHost = await createAccount("host", "Host Two");
		camper = await createAccount("camper", "Camper User");

		// Seed a route and trips for host
		const routeRows = (await dataSource.query(
			`INSERT INTO "trekking_routes" ("host_id", "name", "description", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, $3, ST_GeomFromText('LINESTRING(108.2 16.0, 108.3 16.1)', 4326), 15000, 'moderate', 360, 'active')
			 RETURNING "id"`,
			[host.id, "Tuyến Tà Năng - Phan Dũng", "Cung đường đẹp tại Lâm Đồng"]
		)) as Array<{ id: string }>;
		const routeId = routeRows[0].id;
		cleanupRouteIds.push(routeId);

		// Trip 1 for host (Lâm Đồng)
		const trip1Rows = (await dataSource.query(
			`INSERT INTO "trips" ("host_id", "route_id", "title", "description", "trip_type", "duration_nights", "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max", "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, $4, 'overnight', 2, now() + interval '5 days', now() + interval '7 days', ST_GeomFromText('POINT(108.2 16.0)', 4326), now() + interval '3 days', 5, 20, 15, '2000000', 'published')
			 RETURNING "id"`,
			[host.id, routeId, "Chuyến Trekking Tà Năng Lâm Đồng", "Chuyến đi khởi hành từ Lâm Đồng"]
		)) as Array<{ id: string }>;
		const trip1Id = trip1Rows[0].id;
		cleanupTripIds.push(trip1Id);

		// Trip 2 for otherHost (Hà Giang)
		const trip2Rows = (await dataSource.query(
			`INSERT INTO "trips" ("host_id", "route_id", "title", "description", "trip_type", "duration_nights", "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max", "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, $4, 'overnight', 3, now() + interval '10 days', now() + interval '13 days', ST_GeomFromText('POINT(108.2 16.0)', 4326), now() + interval '8 days', 5, 10, 8, '3500000', 'completed')
			 RETURNING "id"`,
			[otherHost.id, routeId, "Chuyến Trekking Mã Pí Lèng Hà Giang", "Chuyến đi Hà Giang"]
		)) as Array<{ id: string }>;
		const trip2Id = trip2Rows[0].id;
		cleanupTripIds.push(trip2Id);

		// Booking for trip 1
		const b1Rows = (await dataSource.query(
			`INSERT INTO "bookings" ("trip_id", "user_id", "num_people", "status", "payment_status", "total_amount")
			 VALUES ($1, $2, 4, 'confirmed', 'paid', '8000000')
			 RETURNING "id"`,
			[trip1Id, camper.id]
		)) as Array<{ id: string }>;
		cleanupBookingIds.push(b1Rows[0].id);

		// Settlement for trip 2 (Actual Revenue ledger)
		const sRows = (await dataSource.query(
			`INSERT INTO "settlements" ("trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at")
			 VALUES ($1, $2, '28000000', '0.0500', '1400000', '26600000', now())
			 RETURNING "id"`,
			[trip2Id, otherHost.id]
		)) as Array<{ id: string }>;
		cleanupSettlementIds.push(sRows[0].id);
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (cleanupSettlementIds.length > 0) {
				await dataSource.query('DELETE FROM "settlements" WHERE "id" = ANY($1)', [
					cleanupSettlementIds,
				]);
			}
			if (cleanupBookingIds.length > 0) {
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [cleanupBookingIds]);
			}
			if (cleanupTripIds.length > 0) {
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [cleanupTripIds]);
			}
			if (cleanupRouteIds.length > 0) {
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [
					cleanupRouteIds,
				]);
			}
			if (cleanupUserIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
					cleanupUserIds,
				]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(
		role: "admin" | "host" | "camper",
		fullName: string
	): Promise<TestAccount> {
		const seq = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const email = `perf-${role}-${seq}@example.com`;
		const passwordHash = await hash("P@ssword123", 4);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, 'active', $4) RETURNING "id"`,
			[email, passwordHash, role, fullName]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
			 ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, email, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	it("GET /api/reports/performance as ADMIN returns platform-wide report (PB AC-3, AC-4, AC-6, AC-7, AC-8)", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/reports/performance")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		expect(res.body).toHaveProperty("timeWindow");
		expect(res.body.scope).toEqual({ role: "admin" });

		// Should include all trips (at least 2)
		expect(res.body.trips.total).toBeGreaterThanOrEqual(2);

		// Revenue distinction: Estimated vs Actual
		expect(res.body.revenue.estimated).toMatchObject({
			label: "Estimated",
			isEstimated: true,
		});
		expect(res.body.revenue.actual).toMatchObject({
			label: "Actual",
			isEstimated: false,
			ledgerSource: "settlements",
		});
		expect(res.body.revenue.actual.amount).toBeGreaterThanOrEqual(28000000);
	});

	it("GET /api/reports/performance as HOST returns report strictly scoped to that host (BR-283)", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/reports/performance")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);

		expect(res.body.scope).toEqual({ role: "host", hostId: host.id });
		// Host 1 only owns Trip 1, NOT Trip 2
		const tripIds = res.body.breakdown.map((t: { id: string }) => t.id);
		expect(tripIds).toContain(cleanupTripIds[0]);
		expect(tripIds).not.toContain(cleanupTripIds[1]);

		// Host 1 has no settlements yet, so actual revenue is 0
		expect(res.body.revenue.actual.amount).toBe(0);
		// But has 1 confirmed booking on Trip 1
		expect(res.body.revenue.estimated.amount).toBe(8000000);
	});

	it("GET /api/reports/performance as CAMPER is rejected with 403 Forbidden (BR-211)", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/reports/performance")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(403);

		expect(res.body.message).toContain("Chỉ Quản trị viên (Admin) hoặc Đối tác (Host)");
	});

	it("GET /api/reports/performance without auth returns 401 Unauthorized", async () => {
		await request(app.getHttpServer()).get("/api/reports/performance").expect(401);
	});

	it("filters by province snapshot keyword (PB AC-2)", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/reports/performance")
			.query({ province: "Lâm Đồng" })
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);

		const titles = res.body.breakdown.map((t: { title: string }) => t.title);
		expect(titles.every((title: string) => title.includes("Lâm Đồng"))).toBe(true);
	});
});
