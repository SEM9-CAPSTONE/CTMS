import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { type Socket as ClientSocket, io } from "socket.io-client";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { EmergencyBroadcastPayload } from "../src/modules/emergency-broadcasts/emergency-broadcasts.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

/** How long a socket that must NOT receive the broadcast is observed after the recipients got it. */
const NEGATIVE_OBSERVATION_MS = 1_000;

/** CTMS-081 (Jira CTMS-361): Trip-scoped emergency broadcast against PostgreSQL + HTTP + socket.io. */
describe("CTMS-081 emergency broadcast to Trip (PostgreSQL + HTTP + socket.io)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let baseUrl: string;
	const sockets: ClientSocket[] = [];

	const host = randomUUID();
	const otherHost = randomUUID();
	const camper = randomUUID();
	const registeredCamper = randomUUID();
	const removedCamper = randomUUID();
	const pendingCamper = randomUUID();
	const strangerCamper = randomUUID();
	const porter = randomUUID();
	const unassignedPorter = randomUUID();
	const users = [
		host,
		otherHost,
		camper,
		registeredCamper,
		removedCamper,
		pendingCamper,
		strangerCamper,
		porter,
		unassignedPorter,
	];
	const route = randomUUID();
	const ongoing = randomUUID();
	const completed = randomUUID();
	const trips = [ongoing, completed];
	const booking = randomUUID();
	const pendingBooking = randomUUID();
	const roles: Record<string, string> = {
		[host]: "host",
		[otherHost]: "host",
		[camper]: "camper",
		[registeredCamper]: "camper",
		[removedCamper]: "camper",
		[pendingCamper]: "camper",
		[strangerCamper]: "camper",
		[porter]: "porter",
		[unassignedPorter]: "porter",
	};

	const token = (id: string) => jwt.sign({ sub: id, roles: [roles[id]] });
	const endpoint = (tripId = ongoing) => `/api/trips/${tripId}/emergency-broadcasts`;
	const body = (overrides: Record<string, unknown> = {}) => ({
		id: randomUUID(),
		alertType: "severe_weather",
		content: "Mưa lớn, dừng tại Trạm nghỉ suối và chờ Porter.",
		...overrides,
	});
	const post = (payload: object, as = host, tripId = ongoing) =>
		request(app.getHttpServer())
			.post(endpoint(tripId))
			.set("Authorization", `Bearer ${token(as)}`)
			.send(payload);

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
		await app.listen(0, "127.0.0.1");
		const { port } = app.getHttpServer().address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${port}`;
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		await assertSafeTestDatabase(db);

		for (const id of users) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','Broadcast 81')",
				[id, `b81-${id}@example.test`, roles[id]]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, roles[id]]);
		}
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			 VALUES($1,$2,'Route 81',ST_GeogFromText('SRID=4326;LINESTRING(108.2 16.0,108.2 16.1)'),11000,'moderate',300,'active')`,
			[route, host]
		);
		for (const [id, status] of [
			[ongoing, "ongoing"],
			[completed, "completed"],
		]) {
			await db.query(
				`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
				 VALUES($1,$2,$3,'Trip 81','day_trip',0,now()-interval '1 hour',now()+interval '6 hours',ST_GeogFromText('SRID=4326;POINT(108.2 16.0)'),now()-interval '1 day',1,20,0,$4)`,
				[id, host, route, status]
			);
		}
		await db.query(
			"INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status) VALUES($1,$2,$3,4,'confirmed','not_required'),($4,$2,$5,1,'cancelled','not_required')",
			[booking, ongoing, camper, pendingBooking, pendingCamper]
		);
		for (const [userId, status, bookingId] of [
			[camper, "joined", booking],
			[registeredCamper, "registered", booking],
			[removedCamper, "removed", booking],
			[null, "joined", booking], // guest without an account
			[pendingCamper, "registered", pendingBooking],
		]) {
			await db.query(
				"INSERT INTO booking_members(id,booking_id,user_id,member_status) VALUES($1,$2,$3,$4)",
				[randomUUID(), bookingId, userId, status]
			);
		}
		await db.query(
			"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned'),($1,$3,'unassigned')",
			[ongoing, porter, unassignedPorter]
		);
	}, 60_000);

	afterEach(() => {
		for (const socket of sockets.splice(0)) socket.disconnect();
	});

	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query(
				`DELETE FROM audit_logs WHERE target_type='emergency_broadcast' AND target_id IN
				 (SELECT id FROM emergency_broadcasts WHERE trip_id=ANY($1))`,
				[trips]
			);
			await db.query("DELETE FROM emergency_broadcasts WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM booking_members WHERE booking_id=ANY($1)", [
				[booking, pendingBooking],
			]);
			await db.query("DELETE FROM bookings WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM trip_porters WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM trips WHERE id=ANY($1)", [trips]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [route]);
			await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [users]);
			await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [users]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
		}
		await app?.close();
	});

	function connect(userId: string): Promise<ClientSocket> {
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: { token: token(userId) },
		});
		sockets.push(socket);
		return new Promise((resolve, reject) => {
			socket.once("connected", () => resolve(socket));
			socket.once("auth.error", () => reject(new Error("socket rejected")));
			socket.once("connect_error", reject);
		});
	}

	function collect(socket: ClientSocket): EmergencyBroadcastPayload[] {
		const received: EmergencyBroadcastPayload[] = [];
		socket.on("emergency.broadcast", (payload: EmergencyBroadcastPayload) =>
			received.push(payload)
		);
		return received;
	}

	async function waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (!predicate()) {
			if (Date.now() > deadline) throw new Error(`condition not met within ${timeoutMs}ms`);
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	it("persists trip_id, alert type and content, and delivers only to eligible members and Porters (AC1-AC3)", async () => {
		const listeners = Object.fromEntries(
			await Promise.all(
				[
					camper,
					registeredCamper,
					porter,
					host,
					removedCamper,
					pendingCamper,
					strangerCamper,
					unassignedPorter,
					otherHost,
				].map(async (id) => [id, collect(await connect(id))] as const)
			)
		);
		const payload = body();
		const response = await post(payload).expect(201);
		expect(response.body).toMatchObject({
			id: payload.id,
			tripId: ongoing,
			hostId: host,
			alertType: "severe_weather",
			content: payload.content,
			recipientCount: 3,
		});

		const [row] = (await db.query(
			"SELECT trip_id, alert_type::text, content, recipient_count FROM emergency_broadcasts WHERE id=$1",
			[payload.id]
		)) as Array<Record<string, unknown>>;
		expect(row).toEqual({
			trip_id: ongoing,
			alert_type: "severe_weather",
			content: payload.content,
			recipient_count: 3,
		});
		const stored = (await db.query(
			"SELECT user_id, role::text FROM emergency_broadcast_recipients WHERE broadcast_id=$1 ORDER BY role, user_id",
			[payload.id]
		)) as Array<{ user_id: string; role: string }>;
		expect(stored.map((r) => r.user_id).sort()).toEqual([camper, registeredCamper, porter].sort());
		expect(stored.find((r) => r.user_id === porter)?.role).toBe("porter");

		for (const id of [camper, registeredCamper, porter, host]) {
			await waitUntil(() => listeners[id].length === 1);
			expect(listeners[id][0]).toMatchObject({
				eventId: payload.id,
				broadcastId: payload.id,
				tripId: ongoing,
				tripTitle: "Trip 81",
				alertType: "severe_weather",
				content: payload.content,
			});
		}
		await new Promise((resolve) => setTimeout(resolve, NEGATIVE_OBSERVATION_MS));
		for (const id of [removedCamper, pendingCamper, strangerCamper, unassignedPorter, otherHost]) {
			expect(listeners[id]).toHaveLength(0);
		}
		const audit = (await db.query(
			"SELECT action, actor_id FROM audit_logs WHERE target_type='emergency_broadcast' AND target_id=$1",
			[payload.id]
		)) as Array<{ action: string; actor_id: string }>;
		expect(audit).toEqual([{ action: "EMERGENCY_BROADCAST_CREATED", actor_id: host }]);
	});

	it("rejects an unrelated Host (404), non-Host roles (403), unauthenticated callers (401) and a completed Trip (409)", async () => {
		await request(app.getHttpServer()).post(endpoint()).send(body()).expect(401);
		await post(body(), otherHost).expect(404);
		await post(body(), camper).expect(403);
		await post(body(), porter).expect(403);
		await post(body(), host, completed).expect(409);
		await post(body(), host, randomUUID()).expect(404);
		const count = (await db.query(
			"SELECT count(*)::int AS n FROM emergency_broadcasts WHERE trip_id=$1 AND host_id=$2",
			[ongoing, otherHost]
		)) as Array<{ n: number }>;
		expect(count[0].n).toBe(0);
	});

	it.each([
		["area targeting", { area: { latitude: 16, longitude: 108.2, radiusMeters: 5000 } }],
		["explicit recipients", { recipients: [strangerCamper] }],
		["empty content", { content: "   " }],
		["content over 1000 characters", { content: "x".repeat(1001) }],
		["unknown alert type", { alertType: "marketing" }],
		["missing client ID", { id: undefined }],
	])("rejects %s with 422 (AC4)", async (_label, overrides) => {
		await post(body(overrides)).expect(422);
	});

	it("does not create a duplicate under sequential or concurrent retries (AC5)", async () => {
		const camperSocket = await connect(camper);
		const received = collect(camperSocket);
		const payload = body({ alertType: "evacuation", content: "Sơ tán về điểm tập kết." });

		const results = await Promise.all([post(payload), post(payload), post(payload)]);
		expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
		await post(payload).expect(200);
		expect(new Set(results.map((r) => r.body.id))).toEqual(new Set([payload.id]));

		const rows = (await db.query(
			"SELECT count(*)::int AS n FROM emergency_broadcasts WHERE id=$1",
			[payload.id]
		)) as Array<{ n: number }>;
		expect(rows[0].n).toBe(1);
		await waitUntil(() => received.length >= 1);
		await new Promise((resolve) => setTimeout(resolve, NEGATIVE_OBSERVATION_MS));
		expect(received.filter((p) => p.broadcastId === payload.id)).toHaveLength(1);

		await post({ ...payload, content: "Nội dung khác" }).expect(409);
	});

	it("lists all broadcasts for the Host and only addressed ones for recipients; strangers get 404", async () => {
		const get = (as: string) =>
			request(app.getHttpServer())
				.get(endpoint())
				.set("Authorization", `Bearer ${token(as)}`);

		const hostList = (await get(host).expect(200)).body as Array<{ recipientCount: number | null }>;
		expect(hostList.length).toBeGreaterThanOrEqual(2);
		expect(hostList.every((b) => typeof b.recipientCount === "number")).toBe(true);

		const camperList = (await get(camper).expect(200)).body as Array<{
			recipientCount: number | null;
		}>;
		expect(camperList).toHaveLength(hostList.length);
		expect(camperList.every((b) => b.recipientCount === null)).toBe(true);

		// Removed before any broadcast: still linked to the Trip, but never addressed.
		expect((await get(removedCamper).expect(200)).body).toEqual([]);
		await get(strangerCamper).expect(404);
		await get(otherHost).expect(404);
	});
});
