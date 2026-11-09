import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { SettlementsService } from "../src/modules/bookings/settlements.service";
import { EventsGateway } from "../src/modules/realtime/events.gateway";
import { TripsService } from "../src/modules/trips/services/trips.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface PenaltyBody {
	id: string;
	tripId: string;
	violationNumber: number;
	bookingValue: string;
	ratePercent: number;
	amount: string;
	deductedAmount: string;
	outstandingAmount: string;
	status: string;
	hostingBlockedUntil: string | null;
	waiverDeadline: string;
	waiver: { decision: string | null; reviewDueAt: string | null; evidenceUrls: string[] };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EVIDENCE = ["https://example.com/uploads/giay-kham-benh.pdf"];

describe("Host weather penalties, policy §6 (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let tripsService: TripsService;
	let settlements: SettlementsService;
	let penaltySpy: jest.SpyInstance;
	let waiverSpy: jest.SpyInstance;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let ruleId: string;
	let createdRuleId: string | null = null;

	beforeAll(async () => {
		penaltySpy = jest.spyOn(EventsGateway.prototype, "emitHostWeatherPenaltyCreated");
		waiverSpy = jest.spyOn(EventsGateway.prototype, "emitWeatherPenaltyWaiverRequested");
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
		tripsService = moduleRef.get(TripsService);
		settlements = moduleRef.get(SettlementsService);
		await assertSafeTestDatabase(dataSource);
		const rules = (await dataSource.query(
			`SELECT "id" FROM "weather_risk_rules" ORDER BY "is_active" DESC LIMIT 1`
		)) as Array<{ id: string }>;
		if (rules[0]) {
			ruleId = rules[0].id;
		} else {
			createdRuleId = randomUUID();
			ruleId = createdRuleId;
			await dataSource.query(
				`INSERT INTO "weather_risk_rules" (
					"id", "rainfall_yellow_threshold", "rainfall_red_threshold",
					"wind_yellow_threshold", "wind_red_threshold", "temp_low_yellow", "temp_low_red",
					"temp_high_yellow", "temp_high_red", "visibility_yellow_threshold",
					"visibility_red_threshold", "thunderstorm_yellow", "thunderstorm_red",
					"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight",
					"thunderstorm_weight", "green_max_score", "yellow_max_score", "is_active"
				) VALUES (
					$1, 10, 50, 40, 70, 5, 0, 38, 42, 5000, 1000, true, true,
					0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, false
				)`,
				[createdRuleId]
			);
		}
	}, 60_000);

	beforeEach(() => {
		penaltySpy.mockClear();
		waiverSpy.mockClear();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const bookingIds = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
			await dataSource.query('DELETE FROM "host_weather_penalties" WHERE "host_id" = ANY($1)', [
				userIds,
			]);
			await dataSource.query(
				`DELETE FROM "wallet_transactions" WHERE "wallet_id" IN
				   (SELECT "id" FROM "host_wallets" WHERE "host_id" = ANY($1))`,
				[userIds]
			);
			await dataSource.query('DELETE FROM "settlements" WHERE "host_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "host_wallets" WHERE "host_id" = ANY($1)', [userIds]);
			await dataSource.query(`DELETE FROM "payments" WHERE "booking_id" IN (${bookingIds})`, [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query(
				'DELETE FROM "trip_weather_decision_alerts" WHERE "trip_id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "trip_weather_decisions" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (createdRuleId) {
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = $1', [createdRuleId]);
			}
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		jest.restoreAllMocks();
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Weather penalty user')`,
			[id, `weather-penalty-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(
		host: Account,
		startsAt: Date,
		options: { status?: string; risk?: "red" | null } = {}
	): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Weather penalty route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Trip phạt thời tiết', 'day_trip', 0, $4, $5,
			   ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $6, 1, 20, 0, 500000, $7)`,
			[
				tripId,
				host.id,
				routeId,
				startsAt,
				new Date(startsAt.getTime() + 9 * HOUR_MS),
				new Date(startsAt.getTime() - 2 * HOUR_MS),
				options.status ?? "published",
			]
		);
		tripIds.push(tripId);
		if (options.risk !== null) {
			await dataSource.query(
				`INSERT INTO "trip_weather_forecasts" ("id", "trip_id", "route_id", "status", "risk_level",
				   "composite_score", "trip_starts_at", "trip_ends_at", "forecast_from", "forecast_to",
				   "worst_reading", "criteria_scores", "rule_version_id", "created_by")
				 SELECT $1, "id", "route_id", 'available', 'red', 2.5, "starts_at", "ends_at", "starts_at",
				   "ends_at", '{}'::jsonb, '{}'::jsonb, $3, "host_id"
				 FROM "trips" WHERE "id" = $2`,
				[randomUUID(), tripId, ruleId]
			);
		}
		return tripId;
	}

	/** A paid booking of `amount` đ with its succeeded charge. */
	async function bookPaid(tripId: string, amount: number, status = "confirmed"): Promise<void> {
		const camper = await createAccount(UserRole.CAMPER);
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status", "payment_status")
			 VALUES ($1, $2, $3, 1, $4, $5, 'paid')`,
			[bookingId, tripId, camper.id, amount, status]
		);
		await dataSource.query(
			`INSERT INTO "payments" ("booking_id", "amount", "type", "status", "idempotency_key", "request_fingerprint")
			 VALUES ($1, $2, 'charge', 'succeeded', $3, $4)`,
			[bookingId, amount, `charge-${bookingId}`, `fp-${bookingId}`.slice(0, 64)]
		);
	}

	const api = () => request(app.getHttpServer());
	const adminDecides = (admin: Account, tripId: string, decision: string) =>
		api()
			.post(`/api/admin/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision, reason: "Cảnh báo lũ quét" })
			.expect(201);
	const myPenalties = (host: Account) =>
		api()
			.get("/api/me/weather-penalties")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200)
			.then(
				(response) =>
					response.body as {
						items: PenaltyBody[];
						outstandingTotal: string;
						hostingBlockedUntil: string | null;
						suspended: boolean;
					}
			);
	const requestWaiver = (host: Account, penaltyId: string) =>
		api()
			.post(`/api/host/weather-penalties/${penaltyId}/waiver-request`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ reason: "Host nhập viện cấp cứu", evidenceUrls: EVIDENCE });
	const reviewWaiver = (admin: Account, penaltyId: string, approve: boolean) =>
		api()
			.post(`/api/admin/weather-penalties/${penaltyId}/waiver-review`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ approve, note: approve ? "Giấy viện hợp lệ" : "Thiếu bằng chứng" });

	it("penalises a Host who did not answer: 5% of the paid bookings, capped, audited and pushed", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const tripId = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await bookPaid(tripId, 30_000_000);
		await bookPaid(tripId, 20_000_000);

		const decision = await adminDecides(admin, tripId, "cancel");
		const { items, outstandingTotal, hostingBlockedUntil } = await myPenalties(host);
		expect(items).toEqual([
			expect.objectContaining({
				tripId,
				violationNumber: 1,
				bookingValue: "50000000.00",
				ratePercent: 5,
				// 50,000,000đ × 5% = 2,500,000đ, capped at 2,000,000đ
				amount: "2000000.00",
				outstandingAmount: "2000000.00",
				status: "applied",
				hostingBlockedUntil: null,
			}),
		]);
		expect(outstandingTotal).toBe("2000000.00");
		expect(hostingBlockedUntil).toBeNull();
		const audit = await dataSource.query(
			`SELECT "actor_id" AS "actorId", "after" FROM "audit_logs"
			 WHERE "action" = 'host.weather_penalty_created' AND "target_id" = $1`,
			[items[0].id]
		);
		expect(audit).toEqual([
			expect.objectContaining({
				actorId: admin.id,
				after: expect.objectContaining({ decisionId: decision.body.id, violationNumber: 1 }),
			}),
		]);
		expect(penaltySpy).toHaveBeenCalledWith(
			host.id,
			expect.objectContaining({ penaltyId: items[0].id, amount: "2000000.00" })
		);

		// The Admin cannot penalise twice for the same schedule (pause → resume, etc.).
		const second = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await adminDecides(admin, second, "pause");
		await adminDecides(admin, second, "resume");
		expect((await myPenalties(host)).items.filter((item) => item.tripId === second)).toHaveLength(
			1
		);
	});

	it("does not penalise before T-24h or after an on-time Host Keep", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const early = await createTrip(host, new Date(Date.now() + 40 * HOUR_MS));
		await adminDecides(admin, early, "pause");

		const kept = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await dataSource.query(
			`INSERT INTO "trip_weather_decisions" ("trip_id", "decided_by", "decider_role", "decision",
			   "reason", "safety_plan", "late", "trip_starts_at", "created_at")
			 SELECT "id", "host_id", 'host', 'keep', 'Porter quen tuyến', 'Quay đầu trước 14h', false,
			   "starts_at", now() - interval '20 hours'
			 FROM "trips" WHERE "id" = $1`,
			[kept]
		);
		await adminDecides(admin, kept, "pause");
		expect((await myPenalties(host)).items).toEqual([]);
		expect(penaltySpy).not.toHaveBeenCalled();
	});

	it("blocks hosting 14 days on the 2nd violation, does not count a waived one, and refuses a late waiver", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const first = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await bookPaid(first, 10_000_000);
		await adminDecides(admin, first, "cancel");
		const secondTrip = await createTrip(host, new Date(Date.now() + 5 * HOUR_MS));
		await bookPaid(secondTrip, 10_000_000);
		await adminDecides(admin, secondTrip, "keep");

		let mine = await myPenalties(host);
		const second = mine.items.find((item) => item.tripId === secondTrip) as PenaltyBody;
		expect(second).toMatchObject({ violationNumber: 2, ratePercent: 10, amount: "1000000.00" });
		const blockedFor = new Date(second.hostingBlockedUntil as string).getTime() - Date.now();
		expect(blockedFor).toBeGreaterThan(13.9 * DAY_MS);
		expect(blockedFor).toBeLessThanOrEqual(14 * DAY_MS);
		expect(mine.hostingBlockedUntil).toBe(second.hostingBlockedUntil);

		const draft = await createTrip(host, new Date(Date.now() + 20 * DAY_MS), {
			status: "draft",
			risk: null,
		});
		await expect(tripsService.submitForApproval(host.id, draft)).rejects.toMatchObject({
			status: 403,
			response: expect.objectContaining({ blockedUntil: second.hostingBlockedUntil }),
		});

		// Force majeure accepted: the 2nd penalty is waived, the block lifted, and it stops counting.
		await requestWaiver(host, second.id).expect(200);
		expect(waiverSpy).toHaveBeenCalledWith(
			expect.arrayContaining([admin.id]),
			expect.objectContaining({ penaltyId: second.id })
		);
		await requestWaiver(host, second.id).expect(409);
		await reviewWaiver(admin, second.id, true).expect(200);
		await reviewWaiver(admin, second.id, true).expect(409);
		mine = await myPenalties(host);
		expect(mine.items.find((item) => item.id === second.id)).toMatchObject({
			status: "waived",
			outstandingAmount: "0.00",
			hostingBlockedUntil: null,
			waiver: expect.objectContaining({ decision: "approved", evidenceUrls: EVIDENCE }),
		});
		expect(mine.hostingBlockedUntil).toBeNull();

		const third = await createTrip(host, new Date(Date.now() + 8 * HOUR_MS));
		await adminDecides(admin, third, "pause");
		mine = await myPenalties(host);
		const thirdPenalty = mine.items.find((item) => item.tripId === third) as PenaltyBody;
		expect(thirdPenalty.violationNumber).toBe(2);

		// Window closed: 72 h after T-24h.
		await dataSource.query(
			`UPDATE "host_weather_penalties" SET "waiver_deadline" = now() - interval '1 minute' WHERE "id" = $1`,
			[thirdPenalty.id]
		);
		await requestWaiver(host, thirdPenalty.id).expect(409);
		await requestWaiver(await createAccount(UserRole.HOST), thirdPenalty.id).expect(404);

		const pending = await api()
			.get("/api/admin/weather-penalties?status=waiver_pending")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect((pending.body as PenaltyBody[]).map((item) => item.id)).not.toContain(second.id);
		await api()
			.get("/api/admin/weather-penalties")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(403);
	});

	it("deducts the penalty from the next settlement, keeps the rest as debt and refunds it when waived", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const cancelled = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await bookPaid(cancelled, 20_000_000);
		await adminDecides(admin, cancelled, "cancel");
		const penalty = (await myPenalties(host)).items[0];
		expect(penalty.amount).toBe("1000000.00");

		// A completed Trip past the hold and complaint windows: 600,000đ base → 570,000đ net.
		const completed = await createTrip(host, new Date(Date.now() - 6 * DAY_MS), {
			status: "completed",
			risk: null,
		});
		await bookPaid(completed, 600_000, "completed");
		const settled = await settlements.settleTrip(completed, admin.id);
		expect(settled.netAmount).toBe("570000.00");
		expect(settled.walletBalanceAfter).toBe("0.00");

		let mine = await myPenalties(host);
		expect(mine.items[0]).toMatchObject({
			deductedAmount: "570000.00",
			outstandingAmount: "430000.00",
		});
		expect(mine.outstandingTotal).toBe("430000.00");
		const ledger = await dataSource.query(
			`SELECT tx."type", tx."net_amount"::text AS "net", tx."balance_after"::text AS "balance"
			 FROM "wallet_transactions" tx JOIN "host_wallets" wallet ON wallet."id" = tx."wallet_id"
			 WHERE wallet."host_id" = $1 ORDER BY tx."created_at", tx."type" DESC`,
			[host.id]
		);
		expect(ledger).toEqual([
			{ type: "settlement_credit", net: "570000.00", balance: "570000.00" },
			{ type: "penalty_debit", net: "-570000.00", balance: "0.00" },
		]);

		await requestWaiver(host, penalty.id).expect(200);
		const reviewed = await reviewWaiver(admin, penalty.id, true).expect(200);
		expect(reviewed.body).toMatchObject({ status: "waived", deductedAmount: "0.00" });
		const wallet = await dataSource.query(
			`SELECT "balance"::text AS "balance" FROM "host_wallets" WHERE "host_id" = $1`,
			[host.id]
		);
		expect(wallet).toEqual([{ balance: "570000.00" }]);
		mine = await myPenalties(host);
		expect(mine.outstandingTotal).toBe("0.00");
	});

	it("keeps a rejected waiver applied with the Admin's reason", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const tripId = await createTrip(host, new Date(Date.now() + 10 * HOUR_MS));
		await adminDecides(admin, tripId, "keep");
		const penalty = (await myPenalties(host)).items[0];
		await reviewWaiver(admin, penalty.id, false).expect(409);
		await requestWaiver(host, penalty.id).expect(200);
		const rejected = await reviewWaiver(admin, penalty.id, false).expect(200);
		expect(rejected.body).toMatchObject({
			status: "applied",
			waiver: expect.objectContaining({ decision: "rejected", reviewNote: "Thiếu bằng chứng" }),
		});
		const detail = await api()
			.get(`/api/admin/weather-penalties/${penalty.id}`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(detail.body.waiver.reviewDueAt).toEqual(expect.any(String));
	});
});
