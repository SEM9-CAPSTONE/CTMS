import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

/** Small but complete run: every scenario, real sockets, loopback WebSocket. */
const RUN = { sosEvents: 20, normalEvents: 20, concurrentClients: 3, missedEvents: 5 };

describe("Evaluate real-time communication performance (CTMS-100, real Postgres + sockets)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let baseUrl: string;
	const userIds: string[] = [];
	const reportIds: string[] = [];
	let admin: Account;
	let host: Account;

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
		await app.listen(0, "127.0.0.1");
		const { port } = app.getHttpServer().address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${port}`;
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
		admin = await createAccount(UserRole.ADMIN);
		host = await createAccount(UserRole.HOST);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query('DELETE FROM "realtime_evaluation_reports" WHERE "id" = ANY($1)', [
				reportIds,
			]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Realtime evaluation user')`,
			[id, `realtime-evaluation-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	const api = () => request(baseUrl);
	const asAdmin = (call: request.Test) => call.set("Authorization", `Bearer ${admin.accessToken}`);

	it("runs every scenario over real sockets, passes the BR-281 gates and stores payload-free timing samples", async () => {
		const response = await asAdmin(api().post("/api/evaluations/realtime/run"))
			.send(RUN)
			.expect(201);
		reportIds.push(response.body.id);
		const report = response.body;

		expect(report).toMatchObject({
			scenarioVersion: "v3.0.0-realtime-performance",
			configVersion: "v3-realtime-evaluation-1",
			ruleVersion: "BR-281+BR-265+BR-282",
			overallResult: "PASSED",
			evaluatorId: admin.id,
			failureReasons: [],
		});
		expect(report.testConfig).toMatchObject({ ...RUN, warmupEvents: 5 });
		expect(report.metrics.sos).toMatchObject({ count: 20, delivered: 20, undelivered: 0 });
		expect(report.metrics.normal).toMatchObject({ count: 60, delivered: 60, undelivered: 0 });
		expect(report.metrics.sos.p95Ms).toBeLessThan(5000);
		expect(report.metrics.normal.p99Ms).toBeLessThanOrEqual(5000);
		expect(report.metrics.recovery).toMatchObject({ eligible: 5, recovered: 5, rate: 1 });
		expect(report.metrics.observations.concurrentClients).toBe(3);
		expect(report.metrics.observations.duplicateCopiesFiltered).toBeGreaterThan(0);
		for (const gate of [
			"SOS_DELIVERY_P95",
			"NORMAL_EVENT_P95",
			"NORMAL_EVENT_P99",
			"MISSED_EVENT_RECOVERY",
		]) {
			expect(report.gates[gate].passed).toBe(true);
		}
		expect(
			report.scenarioResults.map((scenario: { scenario: string; passed: boolean }) => [
				scenario.scenario,
				scenario.passed,
			])
		).toEqual([
			["STABLE_SOS", true],
			["CONCURRENT_NORMAL", true],
			["RECONNECT_RECOVERY", true],
			["ROOM_RESTORE", true],
			["DUPLICATE_HANDLING", true],
		]);

		// BR-265: timing per event type, no payload column at all.
		const columns = (await dataSource.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'realtime_latency_samples'`
		)) as Array<{ column_name: string }>;
		expect(columns.map((column) => column.column_name)).not.toContain("payload");
		const sos = (await dataSource.query(
			`SELECT "sent_at" AS "sentAt", "received_at" AS "receivedAt", "acknowledged_at" AS "acknowledgedAt",
			        "latency_ms" AS "latencyMs", "event_type" AS "eventType"
			 FROM "realtime_latency_samples" WHERE "report_id" = $1 AND "scenario" = 'STABLE_SOS' AND NOT "warmup"`,
			[report.id]
		)) as Array<Record<string, unknown>>;
		expect(sos).toHaveLength(20);
		for (const row of sos) {
			expect(row).toMatchObject({ eventType: "evaluation.probe.sos" });
			expect(row.sentAt).not.toBeNull();
			expect(row.receivedAt).not.toBeNull();
			expect(row.acknowledgedAt).not.toBeNull();
			expect(Number(row.latencyMs)).toBeGreaterThanOrEqual(0);
		}
		expect(report.sampleCount).toBeGreaterThan(80);

		// Temporary accounts and their stored probe events are gone.
		const [{ probes }] = (await dataSource.query(
			`SELECT count(*)::int AS "probes" FROM "users" WHERE "email" LIKE '%@evaluation.ctms.invalid'`
		)) as Array<{ probes: number }>;
		expect(probes).toBe(0);
		const [{ events }] = (await dataSource.query(
			`SELECT count(*)::int AS "events" FROM "realtime_events" WHERE "event_name" LIKE 'evaluation.probe.%'`
		)) as Array<{ events: number }>;
		expect(events).toBe(0);

		const latest = await asAdmin(api().get("/api/evaluations/realtime/latest")).expect(200);
		expect(latest.body).toMatchObject({ id: report.id, sampleCount: report.sampleCount });
		const byId = await asAdmin(api().get(`/api/evaluations/realtime/reports/${report.id}`)).expect(
			200
		);
		expect(byId.body.id).toBe(report.id);
		const history = await asAdmin(api().get("/api/evaluations/realtime/reports?limit=1")).expect(
			200
		);
		expect(history.body).toHaveLength(1);
	}, 120_000);

	it("allows one run at a time", async () => {
		const [first, second] = await Promise.all([
			asAdmin(api().post("/api/evaluations/realtime/run")).send(RUN),
			asAdmin(api().post("/api/evaluations/realtime/run")).send(RUN),
		]);
		const statuses = [first.status, second.status].sort();
		expect(statuses).toEqual([201, 409]);
		reportIds.push((first.status === 201 ? first : second).body.id);
	}, 120_000);

	it("rejects out-of-range parameters, bad ids and non-Admins", async () => {
		const tooSmall = await asAdmin(api().post("/api/evaluations/realtime/run")).send({
			sosEvents: 5,
		});
		expect([400, 422]).toContain(tooSmall.status);
		const tooMany = await asAdmin(api().post("/api/evaluations/realtime/run")).send({
			concurrentClients: 500,
		});
		expect([400, 422]).toContain(tooMany.status);
		await asAdmin(api().get("/api/evaluations/realtime/reports/not-a-uuid")).expect(422);
		await asAdmin(api().get(`/api/evaluations/realtime/reports/${randomUUID()}`)).expect(404);
		await api()
			.post("/api/evaluations/realtime/run")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(RUN)
			.expect(403);
		await api().get("/api/evaluations/realtime/latest").expect(401);
	});
});
