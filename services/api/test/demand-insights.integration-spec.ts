import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { DemandSuggestion } from "../src/modules/demand-insights/demand-insights.policy";
import {
	type DemandConfiguration,
	DemandInsightsProvider,
} from "../src/modules/demand-insights/demand-insights.provider";
import { DemandInsightsService } from "../src/modules/demand-insights/demand-insights.service";
import { AnalysisProviderError } from "../src/modules/review-analysis/review-analysis.types";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-415 shared Booking demand (real PostgreSQL, fake provider edge)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let service: DemandInsightsService;
	const hosts: User[] = [];
	const campers: User[] = [];
	const tripIds: string[] = [];
	const routeIds: string[] = [];
	const bookingIds: string[] = [];
	const local = new Date(Date.now() + 7 * 3600000);
	const monthAt = (offset: number) =>
		new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - offset, 15))
			.toISOString()
			.slice(0, 7);
	const month = monthAt(1);
	const otherMonth = monthAt(2);
	const initial: DemandConfiguration = {
		minBookers: 10,
		minDaysAfterClose: 3,
		minHosts: 3,
		maxHostShare: 0.75,
		provider: "gemini",
		model: "test-model",
		configVersion: "v1",
		promptVersion: "demand-v1",
	};
	let config = { ...initial };
	const provider = { configuration: () => ({ ...config }), generate: jest.fn() };
	const output: DemandSuggestion[] = [
		{ tripType: "day_trip", difficulty: "easy", reason: "observed_booking_interest" },
	];
	const token = (actor = hosts[0]) => `Bearer ${jwt.sign({ sub: actor.id, roles: [actor.role] })}`;
	const create = (actor = hosts[0], period = month, body: object = {}) =>
		request(app.getHttpServer())
			.post(`/api/host/demand-insights/${period}`)
			.set("Authorization", token(actor))
			.send(body);
	const read = (actor = hosts[0], period = month) =>
		request(app.getHttpServer())
			.get(`/api/host/demand-insights/${period}`)
			.set("Authorization", token(actor));
	async function account(role: UserRole) {
		const user = await db.getRepository(User).save(
			db.getRepository(User).create({
				role,
				status: UserStatus.ACTIVE,
				email: `demand-${randomUUID()}@example.test`,
				passwordHash: "unused-test-hash",
			})
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [user.id, role]);
		return user;
	}
	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(DemandInsightsProvider)
			.useValue(provider)
			.compile();
		app = module.createNestApplication();
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
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		service = module.get(DemandInsightsService);
		await assertSafeTestDatabase(db);
		const existing = await db.query(
			"SELECT id FROM demand_insight_reports WHERE month=ANY($1::text[])",
			[[month, otherMonth]]
		);
		if (existing.length)
			throw new Error(
				"Test months already contain reports; refusing to replace unrelated fixtures"
			);
		for (let i = 0; i < 3; i++) {
			hosts.push(await account(UserRole.HOST));
			const route = randomUUID();
			const trip = randomUUID();
			routeIds.push(route);
			tripIds.push(trip);
			await db.query(
				"INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status) VALUES($1,$2,'Private source route',ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),1000,'easy',60,'active')",
				[route, hosts[i].id]
			);
			await db.query(
				"INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status) VALUES($1,$2,$3,'Private source Trip','day_trip',0,now()+interval '5 days',now()+interval '6 days',ST_GeogFromText('POINT(108.22 16.04)'),now()+interval '4 days',1,100,0,0,'published')",
				[trip, hosts[i].id, route]
			);
		}
		for (let i = 0; i < 10; i++) campers.push(await account(UserRole.CAMPER));
	}, 60000);
	beforeEach(async () => {
		config = { ...initial };
		provider.generate.mockReset().mockResolvedValue(output);
		await db.query("UPDATE demand_insight_control SET last_created_at=NULL WHERE id=1");
		for (let i = 0; i < 10; i++) {
			const id = randomUUID();
			bookingIds.push(id);
			await db.query(
				"INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,created_at) VALUES($1,$2,$3,5,'confirmed','not_required',$4::timestamptz)",
				[id, tripIds[i % 3], campers[i].id, `${month}-15T00:00:00Z`]
			);
		}
	});
	afterEach(async () => {
		await db.query("DELETE FROM demand_insight_reports WHERE month=ANY($1::text[])", [
			[month, otherMonth],
		]);
		await db.query("DELETE FROM payments WHERE booking_id=ANY($1::uuid[]) AND type='refund'", [
			bookingIds,
		]);
		await db.query("DELETE FROM payments WHERE booking_id=ANY($1::uuid[])", [bookingIds]);
		await db.query("DELETE FROM bookings WHERE id=ANY($1::uuid[])", [bookingIds]);
		bookingIds.length = 0;
		await db.query("UPDATE users SET status='active' WHERE id=ANY($1::uuid[])", [
			[...hosts, ...campers].map((u) => u.id),
		]);
		await db.query("UPDATE trips SET status='published' WHERE id=ANY($1::uuid[])", [tripIds]);
	});
	afterAll(async () => {
		if (db) {
			await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM trekking_routes WHERE id=ANY($1::uuid[])", [routeIds]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
				[...hosts, ...campers].map((u) => u.id),
			]);
		}
		if (app) await app.close();
	});
	it("authorizes Hosts, rejects Campers and rejects client overrides/invalid months", async () => {
		await create(campers[0]).expect(403);
		await read(campers[0]).expect(403);
		await create(hosts[0], month, { minBookers: 1 }).expect(422);
		await create(hosts[0], monthAt(0)).expect(422);
		await read(hosts[0], "invalid").expect(422);
		await read().expect(404);
		await db.query("UPDATE users SET status='suspended' WHERE id=$1", [hosts[0].id]);
		await create().expect(401);
	});
	it("does not freeze an unsettled month or call the provider", async () => {
		config.minDaysAfterClose = 31;
		const result = await create().expect(422);
		expect(result.body.code).toBe("period_not_settled");
		expect(result.body.availableAt).toBeDefined();
		await read().expect(404);
		expect(provider.generate).not.toHaveBeenCalled();
	});
	it("creates one shared report for simultaneous Host requests and calls provider only once", async () => {
		const results = await Promise.all([create(), create(hosts[1])]);
		expect(results.map((r) => r.status)).toEqual([202, 202]);
		expect(results[0].body.version).toBe(results[1].body.version);
		expect(await service.processOne()).toBe(true);
		expect(await service.processOne()).toBe(false);
		expect(provider.generate).toHaveBeenCalledTimes(1);
		const first = await read().expect(200);
		expect(first.body.status).toBe("succeeded");
		expect(first.body.stale).toBe(false);
		const second = await read(hosts[2]).expect(200);
		expect(first.body).toEqual(second.body);
		expect(first.body.cells[0].bookerBand).toEqual({ min: 10, max: 19 });
		expect(Object.keys(first.body).sort()).toEqual(
			[
				"advisory",
				"canRetry",
				"cells",
				"dataWindow",
				"errorCode",
				"generatedAt",
				"granularity",
				"month",
				"stale",
				"status",
				"suggestions",
				"version",
			].sort()
		);
		const text = JSON.stringify(first.body);
		for (const user of [...hosts, ...campers]) expect(text).not.toContain(user.id);
		for (const id of [...bookingIds, ...tripIds]) expect(text).not.toContain(id);
		expect(text).not.toMatch(/Private source|source_hash|configuration|model|hostId|bookerId/);
	});
	it("returns insufficient_data before any provider use and never replaces that publication", async () => {
		await db.query("UPDATE bookings SET user_id=$2 WHERE id=ANY($1::uuid[])", [
			bookingIds,
			campers[0].id,
		]);
		await create().expect(200);
		expect(await service.processOne()).toBe(false);
		expect(provider.generate).not.toHaveBeenCalled();
		const response = await read().expect(200);
		expect(response.body.status).toBe("insufficient_data");
		expect(response.body.cells).toEqual([]);
	});
	it.each(["cancelled", "expired", "pending_payment", "pending_reconfirmation"])(
		"excludes %s Bookings",
		async (status) => {
			await db.query(
				"UPDATE bookings SET status=$2,payment_status='unpaid',hold_expires_at=now()+interval '10 minutes' WHERE id=$1",
				[bookingIds[0], status]
			);
			expect((await create().expect(200)).body.status).toBe("insufficient_data");
		}
	);
	it("includes completed Bookings but excludes cancelled Trips", async () => {
		await db.query("UPDATE bookings SET status='completed' WHERE id=ANY($1::uuid[])", [bookingIds]);
		await db.query("UPDATE trips SET status='cancelled' WHERE id=$1", [tripIds[0]]);
		expect((await create().expect(200)).body.status).toBe("insufficient_data");
	});
	it.each(["pending", "succeeded"])(
		"excludes %s refund obligations without sending payment data",
		async (status) => {
			const charge = randomUUID();
			await db.query(
				"INSERT INTO payments(id,booking_id,amount,type,status) VALUES($1,$2,100,'charge','succeeded')",
				[charge, bookingIds[0]]
			);
			await db.query(
				"INSERT INTO payments(booking_id,amount,type,status,parent_payment_id) VALUES($1,100,'refund',$2,$3)",
				[bookingIds[0], status, charge]
			);
			expect((await create().expect(200)).body.status).toBe("insufficient_data");
			expect(provider.generate).not.toHaveBeenCalled();
		}
	);
	it("withholds a published report after deletion or late cancellation without republishing", async () => {
		const created = await create().expect(202);
		await service.processOne();
		await db.query("UPDATE users SET status='deleted' WHERE id=$1", [campers[0].id]);
		const value = (await read().expect(200)).body;
		expect(value.status).toBe("withheld");
		expect(value.stale).toBe(true);
		expect(value.cells).toEqual([]);
		const repeated = await create().expect(200);
		expect(repeated.body.version).toBe(created.body.version);
		expect(repeated.body.cells).toBeUndefined();
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});
	it("marks changed source/config stale while retaining immutable published intervals", async () => {
		await create().expect(202);
		await service.processOne();
		const before = (await read().expect(200)).body;
		const extra = randomUUID();
		bookingIds.push(extra);
		await db.query(
			"INSERT INTO bookings(id,trip_id,user_id,status,created_at) VALUES($1,$2,$3,'confirmed',$4)",
			[extra, tripIds[0], campers[1].id, `${month}-16T00:00:00Z`]
		);
		config.configVersion = "v2";
		const after = (await read().expect(200)).body;
		expect(after.stale).toBe(true);
		expect(after.cells).toEqual(before.cells);
		expect(after.version).toBe(before.version);
		await create().expect(200);
		expect(await service.processOne()).toBe(false);
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});
	it("serializes claims and fences worker A after worker B takes over", async () => {
		await create().expect(202);
		const claims = await Promise.all([service.claim(), service.claim()]);
		const a = claims.find((c) => c !== null);
		expect(claims.filter(Boolean)).toHaveLength(1);
		if (!a) throw new Error("No claim");
		expect(await service.heartbeat(a)).toBe(true);
		await db.query(
			"UPDATE demand_insight_reports SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
			[a.id]
		);
		const b = await service.claim();
		if (!b) throw new Error("No takeover");
		expect(b.attempts).toBe(2);
		expect(await service.heartbeat(a)).toBe(false);
		expect(await service.finish(a, output)).toBe(false);
		expect(await service.finish(b, output)).toBe(true);
		expect((await read().expect(200)).body.status).toBe("succeeded");
	});
	it("lists twelve closed server-owned periods with Host authorization and existing-report availability", async () => {
		const endpoint = "/api/host/demand-insights";
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", token(campers[0]))
			.expect(403);
		const before = await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", token())
			.expect(200);
		expect(before.body.periods).toHaveLength(12);
		expect(before.body.periods[0]).toMatchObject({ month, hasReport: false, canCreate: true });
		expect(before.body.periods.map((p: { month: string }) => p.month)).toEqual(
			Array.from({ length: 12 }, (_, i) => monthAt(i + 1))
		);
		expect(before.headers["cache-control"]).toBe("no-store");
		await create().expect(202);
		const after = await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", token(hosts[1]))
			.expect(200);
		expect(after.body.periods[0]).toMatchObject({ month, hasReport: true, canCreate: false });
	});
	it("derives disabled period availability from the configured stabilization delay", async () => {
		config.minDaysAfterClose = 31;
		const result = await request(app.getHttpServer())
			.get("/api/host/demand-insights")
			.set("Authorization", token())
			.expect(200);
		const period = result.body.periods[0];
		const [year, monthNumber] = month.split("-").map(Number);
		const availableAt = new Date(Date.UTC(year, monthNumber, 1) - 7 * 3600000 + 31 * 86400000);
		expect(period.availableAt).toBe(availableAt.toISOString());
		expect(period.canCreate).toBe(Date.now() >= availableAt.getTime());
	});
	it("caps transient attempts at three and redacts provider errors", async () => {
		await create().expect(202);
		provider.generate.mockRejectedValue(
			new AnalysisProviderError("private transport context", true)
		);
		for (let i = 0; i < 3; i++) {
			await service.processOne();
			await db.query(
				"UPDATE demand_insight_reports SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE month=$1",
				[month]
			);
		}
		expect(await service.processOne()).toBe(false);
		expect(provider.generate).toHaveBeenCalledTimes(3);
		const result = await read().expect(200);
		expect(result.body.status).toBe("failed");
		expect(result.text).not.toContain("private transport");
	});
	it("permits one explicit retry round for transient failures, enforces cooldown and serializes double clicks", async () => {
		const created = await create().expect(202);
		await db.query(
			"UPDATE demand_insight_reports SET status='failed',attempts=3,error_code='provider_transport',next_attempt_at=clock_timestamp()-interval '1 second' WHERE month=$1",
			[month]
		);
		expect((await read().expect(200)).body.canRetry).toBe(true);
		const waiting = await create().expect(429);
		expect(Number(waiting.headers["retry-after"])).toBeGreaterThan(0);
		await db.query(
			"UPDATE demand_insight_control SET last_created_at=clock_timestamp()-interval '61 seconds' WHERE id=1"
		);
		const responses = await Promise.all([create(), create()]);
		expect(responses.map((r) => r.status)).toEqual([202, 202]);
		expect(responses.every((r) => r.body.version === created.body.version)).toBe(true);
		const [row] = await db.query(
			"SELECT manual_retries,attempts FROM demand_insight_reports WHERE month=$1",
			[month]
		);
		expect(row).toEqual({ manual_retries: 1, attempts: 0 });
		await db.query(
			"UPDATE demand_insight_reports SET status='failed',attempts=3,error_code='provider_transport' WHERE month=$1",
			[month]
		);
		expect((await read().expect(200)).body.canRetry).toBe(false);
		await create().expect(200);
		expect(await service.processOne()).toBe(false);
	});
	it("never retries permanent errors or a changed frozen source", async () => {
		await create().expect(202);
		await db.query(
			"UPDATE demand_insight_reports SET status='failed',error_code='invalid_output' WHERE month=$1",
			[month]
		);
		expect((await read().expect(200)).body.canRetry).toBe(false);
		await create().expect(200);
		await db.query(
			"UPDATE demand_insight_reports SET error_code='provider_transport',source_hash='changed' WHERE month=$1",
			[month]
		);
		expect((await read().expect(200)).body.canRetry).toBe(false);
		await create().expect(200);
	});
	it("does not retry invalid output or permit provider-supplied numbers", async () => {
		await create().expect(202);
		provider.generate.mockResolvedValue([{ ...output[0], predictedBookings: 100 }]);
		await service.processOne();
		expect(await service.processOne()).toBe(false);
		expect((await read().expect(200)).body.status).toBe("failed");
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});
	it("rejects source changes during generation and persists cooldown across instances", async () => {
		await create().expect(202);
		await create(hosts[0], otherMonth).expect(200); // Empty months consume no provider budget.
		provider.generate.mockImplementation(async () => {
			await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [bookingIds[0]]);
			return output;
		});
		await service.processOne();
		expect((await read().expect(200)).body.status).toBe("failed");
		const [row] = await db.query("SELECT status FROM demand_insight_reports WHERE month=$1", [
			month,
		]);
		expect(row.status).toBe("failed");
	});
	it("enforces persisted cooldown for two non-empty months and reuses the first row", async () => {
		for (let i = 0; i < 10; i++) {
			const id = randomUUID();
			bookingIds.push(id);
			await db.query(
				"INSERT INTO bookings(id,trip_id,user_id,status,created_at) VALUES($1,$2,$3,'confirmed',$4)",
				[id, tripIds[i % 3], campers[i].id, `${otherMonth}-15T00:00:00Z`]
			);
		}
		await create().expect(202);
		const blocked = await create(hosts[1], otherMonth).expect(429);
		expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
		expect(blocked.headers["retry-after"]).toBe(String(blocked.body.retryAfterSeconds));
		await create(hosts[2]).expect(202);
	});
	it("withholds a cohort dominated by one Host even when three Hosts are represented", async () => {
		for (let i = 0; i < 8; i++)
			await db.query("UPDATE bookings SET trip_id=$2 WHERE id=$1", [bookingIds[i], tripIds[0]]);
		await db.query("UPDATE bookings SET trip_id=$2 WHERE id=$1", [bookingIds[8], tripIds[1]]);
		await db.query("UPDATE bookings SET trip_id=$2 WHERE id=$1", [bookingIds[9], tripIds[2]]);
		expect((await create().expect(200)).body.status).toBe("insufficient_data");
		expect(await service.processOne()).toBe(false);
	});
	it("allows failed refunds but excludes deleted Host contributions", async () => {
		const charge = randomUUID();
		await db.query(
			"INSERT INTO payments(id,booking_id,amount,type,status) VALUES($1,$2,100,'charge','succeeded')",
			[charge, bookingIds[0]]
		);
		await db.query(
			"INSERT INTO payments(booking_id,amount,type,status,parent_payment_id) VALUES($1,100,'refund','failed',$2)",
			[bookingIds[0], charge]
		);
		expect((await create().expect(202)).body.status).toBe("pending");
		await service.processOne();
		await db.query("UPDATE users SET status='deleted' WHERE id=$1", [hosts[1].id]);
		expect((await read(hosts[0]).expect(200)).body.status).toBe("withheld");
	});
	it("fails an abandoned third attempt and rejects an expired completion without a takeover", async () => {
		await create().expect(202);
		const a = await service.claim();
		if (!a) throw new Error("No claim");
		await db.query(
			"UPDATE demand_insight_reports SET attempts=3,lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
			[a.id]
		);
		expect(await service.finish(a, output)).toBe(false);
		expect(await service.claim()).toBeNull();
		expect((await read().expect(200)).body.status).toBe("failed");
	});
});
