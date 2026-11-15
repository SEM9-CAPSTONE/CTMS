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
	accessToken: string;
}

/**
 * CTMS-110. Ledger fixture (Host A unless noted):
 * - Sơn Trà Trip: charge 4,000,000 succeeded, charge 999,000 pending, refund 500,000 succeeded,
 *   refund 200,000 pending, settled (fee 175,000, net 3,325,000), refund after settlement 300,000.
 * - Hòa Vang Trip: charge 1,000,000 succeeded, not settled yet (held funds).
 * - Payouts: 3,000,000 succeeded, 25,000 pending.
 * - Host B: Sơn Trà Trip with charge 7,000,000 succeeded.
 */
describe("Revenue Analytics API (CTMS-110, integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;

	let admin: TestAccount;
	let hostA: TestAccount;
	let hostB: TestAccount;
	let camper: TestAccount;
	let pendingChargeId: string;

	const cleanup = {
		users: [] as string[],
		routes: [] as string[],
		trips: [] as string[],
		bookings: [] as string[],
	};

	const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

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

		admin = await createAccount("admin", "Trần Thu Hà");
		hostA = await createAccount("host", "Nguyễn Minh Quân");
		hostB = await createAccount("host", "Lê Hoàng Phúc");
		camper = await createAccount("camper", "Phạm Ngọc Anh");

		const routeA = await createRoute(hostA.id, "Cung đường bán đảo Sơn Trà");
		const routeB = await createRoute(hostB.id, "Cung đường đỉnh Bàn Cờ");

		const sonTraTrip = await createTrip(
			hostA.id,
			routeA,
			"Khám phá bán đảo Sơn Trà",
			"DNG-SON-TRA"
		);
		const hoaVangTrip = await createTrip(hostA.id, routeA, "Chinh phục đỉnh Bà Nà", "DNG-HOA-VANG");
		const otherHostTrip = await createTrip(
			hostB.id,
			routeB,
			"Bình minh đỉnh Bàn Cờ",
			"DNG-SON-TRA"
		);

		const booking1 = await createBooking(sonTraTrip);
		const booking2 = await createBooking(hoaVangTrip);
		const booking3 = await createBooking(otherHostTrip);
		const booking4 = await createBooking(sonTraTrip);

		const charge1 = await createPayment(booking1, "charge", "succeeded", "4000000", daysAgo(10));
		pendingChargeId = await createPayment(booking4, "charge", "pending", "999000");
		await createPayment(booking1, "refund", "succeeded", "500000", daysAgo(8), charge1);
		await createPayment(booking1, "refund", "pending", "200000", undefined, charge1);
		await createPayment(booking2, "charge", "succeeded", "1000000", daysAgo(4));
		await createPayment(booking3, "charge", "succeeded", "7000000", daysAgo(6));

		const settlementRows = (await dataSource.query(
			`INSERT INTO "settlements" ("trip_id", "host_id", "settlement_base", "commission_rate", "platform_fee", "net_amount", "settled_at")
			 VALUES ($1, $2, '3500000', '0.0500', '175000', '3325000', $3) RETURNING "id"`,
			[sonTraTrip, hostA.id, daysAgo(5)]
		)) as Array<{ id: string }>;
		await dataSource.query(
			`INSERT INTO "financial_adjustments" ("booking_id", "trip_id", "host_id", "settlement_id", "type", "amount", "reason", "status", "idempotency_key", "created_at")
			 VALUES ($1, $2, $3, $4, 'post_settlement_refund', '300000', 'Khách bị dị ứng thức ăn, hoàn một phần sau chuyến', 'resolved', $5, $6)`,
			[booking1, sonTraTrip, hostA.id, settlementRows[0].id, `ctms-110-${booking1}`, daysAgo(2)]
		);

		const walletRows = (await dataSource.query(
			`INSERT INTO "host_wallets" ("host_id", "balance") VALUES ($1, '0') RETURNING "id"`,
			[hostA.id]
		)) as Array<{ id: string }>;
		for (const [amount, status, succeededAt] of [
			["3000000", "succeeded", daysAgo(3)],
			["25000", "pending", null],
		] as const) {
			await dataSource.query(
				`INSERT INTO "payouts" ("host_id", "wallet_id", "amount", "status", "bank_name", "account_number", "account_holder_name", "succeeded_at")
				 VALUES ($1, $2, $3, $4, 'Vietcombank', '0071000123456', 'NGUYEN MINH QUAN', $5)`,
				[hostA.id, walletRows[0].id, amount, status, succeededAt]
			);
		}
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const hosts = [hostA?.id, hostB?.id].filter(Boolean);
			await dataSource.query(`DELETE FROM "financial_adjustments" WHERE "host_id" = ANY($1)`, [
				hosts,
			]);
			await dataSource.query(`DELETE FROM "payouts" WHERE "host_id" = ANY($1)`, [hosts]);
			await dataSource.query(`DELETE FROM "host_wallets" WHERE "host_id" = ANY($1)`, [hosts]);
			await dataSource.query(`DELETE FROM "settlements" WHERE "trip_id" = ANY($1)`, [
				cleanup.trips,
			]);
			await dataSource.query(
				`DELETE FROM "payments" WHERE "booking_id" = ANY($1) AND "type" = 'refund'`,
				[cleanup.bookings]
			);
			await dataSource.query(`DELETE FROM "payments" WHERE "booking_id" = ANY($1)`, [
				cleanup.bookings,
			]);
			await dataSource.query(`DELETE FROM "bookings" WHERE "id" = ANY($1)`, [cleanup.bookings]);
			await dataSource.query(`DELETE FROM "trips" WHERE "id" = ANY($1)`, [cleanup.trips]);
			await dataSource.query(`DELETE FROM "trekking_routes" WHERE "id" = ANY($1)`, [
				cleanup.routes,
			]);
			await dataSource.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1)`, [cleanup.users]);
			await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [cleanup.users]);
		}
		await app?.close();
	});

	async function createAccount(
		role: "admin" | "host" | "camper",
		fullName: string
	): Promise<TestAccount> {
		const seq = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, 'active', $4) RETURNING "id"`,
			[`revenue-${role}-${seq}@example.com`, await hash("P@ssword123", 4), role, fullName]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanup.users.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(hostId: string, name: string): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trekking_routes" ("host_id", "name", "description", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Cung đường ven biển Đà Nẵng', ST_GeomFromText('LINESTRING(108.2 16.0, 108.3 16.1)', 4326), 12000, 'moderate', 300, 'active')
			 RETURNING "id"`,
			[hostId, name]
		)) as Array<{ id: string }>;
		cleanup.routes.push(rows[0].id);
		return rows[0].id;
	}

	async function createTrip(
		hostId: string,
		routeId: string,
		title: string,
		areaCode: string
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "trips" ("host_id", "route_id", "title", "trip_type", "duration_nights", "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max", "seats_taken", "price_per_person", "status",
				"area_code", "area_name", "province_code", "province_name")
			 SELECT $1::uuid, $2::uuid, $3::varchar, 'overnight', 1, now() - interval '12 days', now() - interval '11 days', ST_GeomFromText('POINT(108.2 16.0)', 4326), now() - interval '13 days', 2, 20, 4, '1000000', 'completed',
				ga."code", ga."name", ga."province_code", ga."province_name"
			 FROM "geo_areas" ga WHERE ga."code" = $4
			 RETURNING "id"`,
			[hostId, routeId, title, areaCode]
		)) as Array<{ id: string }>;
		cleanup.trips.push(rows[0].id);
		return rows[0].id;
	}

	async function createBooking(tripId: string): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "bookings" ("trip_id", "user_id", "num_people", "status", "payment_status", "total_amount")
			 VALUES ($1, $2, 2, 'completed', 'paid', '2000000') RETURNING "id"`,
			[tripId, camper.id]
		)) as Array<{ id: string }>;
		cleanup.bookings.push(rows[0].id);
		return rows[0].id;
	}

	async function createPayment(
		bookingId: string,
		type: "charge" | "refund",
		status: "pending" | "succeeded",
		amount: string,
		succeededAt?: string,
		parentPaymentId?: string
	): Promise<string> {
		const rows = (await dataSource.query(
			`INSERT INTO "payments" ("booking_id", "amount", "type", "status", "parent_payment_id", "succeeded_at")
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
			[bookingId, amount, type, status, parentPaymentId ?? null, succeededAt ?? null]
		)) as Array<{ id: string }>;
		return rows[0].id;
	}

	const getReport = (token: string, query: Record<string, string> = {}) =>
		request(app.getHttpServer())
			.get("/api/reports/revenue")
			.query({ period: "30d", ...query })
			.set("Authorization", `Bearer ${token}`);

	it("returns separate ledger-backed KPIs for the Host's own scope (BR-320..BR-325)", async () => {
		const res = await getReport(hostA.accessToken).expect(200);

		expect(res.body.currency).toBe("VND");
		expect(res.body.scope).toEqual({ role: "host", hostId: hostA.id });
		expect(res.body.kpis).toEqual({
			grossRevenue: 5000000,
			refundAmount: 500000,
			platformFee: 175000,
			postSettlementRefund: 300000,
			netRevenue: 3025000,
			payout: 3000000,
			heldFunds: 1000000,
			pendingPayout: 25000,
			pendingRefundAmount: 200000,
			pendingRefundCount: 1,
		});
		expect(res.body.dateBasis).toMatchObject({
			grossRevenue: "payment_succeeded_at",
			refundAmount: "refund_succeeded_at",
			netRevenue: "settled_at",
			payout: "payout_succeeded_at",
		});
	});

	it("keeps per-trip and per-area breakdowns reconciled with the KPIs (BR-329)", async () => {
		const res = await getReport(hostA.accessToken).expect(200);
		const byTrip = res.body.byTrip as Array<Record<string, number | string>>;
		const total = (key: string) => byTrip.reduce((sum, trip) => sum + Number(trip[key]), 0);

		expect(byTrip.map((trip) => trip.title).sort()).toEqual([
			"Chinh phục đỉnh Bà Nà",
			"Khám phá bán đảo Sơn Trà",
		]);
		expect(total("grossRevenue")).toBe(res.body.kpis.grossRevenue);
		expect(total("netRevenue")).toBe(res.body.kpis.netRevenue);
		expect(total("heldFunds")).toBe(res.body.kpis.heldFunds);
		expect(res.body.byArea).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ areaName: "Sơn Trà", grossRevenue: 4000000, grossShare: 80 }),
				expect.objectContaining({
					areaName: "Hòa Vang",
					grossRevenue: 1000000,
					heldFunds: 1000000,
				}),
			])
		);
	});

	it("ignores a hostId sent by a Host (BR-318)", async () => {
		const res = await getReport(hostA.accessToken, { hostId: hostB.id }).expect(200);
		expect(res.body.scope.hostId).toBe(hostA.id);
		expect(res.body.kpis.grossRevenue).toBe(5000000);
	});

	it("lets an Admin narrow the report to one Host", async () => {
		const res = await getReport(admin.accessToken, { hostId: hostB.id }).expect(200);
		expect(res.body.kpis.grossRevenue).toBe(7000000);
		expect(res.body.hosts).toEqual(
			expect.arrayContaining([{ id: hostB.id, fullName: "Lê Hoàng Phúc" }])
		);
	});

	it("filters by the Trip area snapshot and does not attribute payouts to an area", async () => {
		const res = await getReport(hostA.accessToken, { areaCode: "DNG-SON-TRA" }).expect(200);
		expect(res.body.kpis).toMatchObject({
			grossRevenue: 4000000,
			heldFunds: 0,
			payout: null,
			pendingPayout: null,
		});
		expect(res.body.payoutAreaScoped).toBe(false);
	});

	it("keeps the stored area name when the area list is renamed later (BR-319)", async () => {
		await dataSource.query(
			`UPDATE "geo_areas" SET "name" = 'Quận Sơn Trà' WHERE "code" = 'DNG-SON-TRA'`
		);
		try {
			const res = await getReport(hostA.accessToken, { areaCode: "DNG-SON-TRA" }).expect(200);
			expect(res.body.byTrip[0].areaName).toBe("Sơn Trà");
		} finally {
			await dataSource.query(
				`UPDATE "geo_areas" SET "name" = 'Sơn Trà' WHERE "code" = 'DNG-SON-TRA'`
			);
		}
	});

	it("uses the settlement fee snapshot even if the commission rate changes (BR-322)", async () => {
		await dataSource.query(
			`UPDATE "settlements" SET "commission_rate" = '0.1000' WHERE "host_id" = $1`,
			[hostA.id]
		);
		const res = await getReport(hostA.accessToken).expect(200);
		expect(res.body.kpis.platformFee).toBe(175000);
	});

	it("counts a charge only once it succeeds, dated by when it succeeded", async () => {
		await dataSource.query(`UPDATE "payments" SET "status" = 'succeeded' WHERE "id" = $1`, [
			pendingChargeId,
		]);
		try {
			const rows = (await dataSource.query(
				`SELECT "succeeded_at" FROM "payments" WHERE "id" = $1`,
				[pendingChargeId]
			)) as Array<{ succeeded_at: Date | null }>;
			expect(rows[0].succeeded_at).not.toBeNull();

			const res = await getReport(hostA.accessToken).expect(200);
			expect(res.body.kpis.grossRevenue).toBe(5999000);
		} finally {
			await dataSource.query(`UPDATE "payments" SET "status" = 'pending' WHERE "id" = $1`, [
				pendingChargeId,
			]);
		}
	});

	it("rejects an inverted date range", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/reports/revenue")
			.query({ from: "2026-11-10T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" })
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.expect(400);
		expect(res.body.error).toBe("INVALID_DATE_RANGE");
	});

	it("rejects Campers and anonymous callers", async () => {
		await getReport(camper.accessToken).expect(403);
		await request(app.getHttpServer()).get("/api/reports/revenue").expect(401);
	});

	it("lists the active reporting areas", async () => {
		const res = await request(app.getHttpServer())
			.get("/api/geo-areas")
			.set("Authorization", `Bearer ${hostA.accessToken}`)
			.expect(200);
		expect(res.body).toHaveLength(8);
		expect(res.body[0]).toEqual({
			code: "DNG-HAI-CHAU",
			name: "Hải Châu",
			provinceCode: "DNG",
			provinceName: "Đà Nẵng",
		});
	});
});
