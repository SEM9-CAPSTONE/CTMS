import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import { type Socket as ClientSocket, io } from "socket.io-client";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import type {
	SosCreatedPayload,
	SosStateChangedPayload,
} from "../src/modules/realtime/events.gateway";
import { SosAlert } from "../src/modules/sos/entities/sos-alert.entity";
import { EmergencyType, SosStatus } from "../src/modules/sos/sos.enums";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

/** BR-260 target, measured from server persistence (`persistedAt`) to client receipt. */
const SOS_DELIVERY_BUDGET_MS = 5_000;
/** How long a socket that must NOT receive an event is observed after the Host already got it. */
const NEGATIVE_OBSERVATION_MS = 1_000;

describe("Real-time SOS delivery (CTMS-079, BR-259/BR-260, integration, real Postgres + socket.io)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let baseUrl: string;
	const sockets: ClientSocket[] = [];
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

	let host: Account;
	let otherHost: Account;
	let camper: Account;
	let tripId: string;

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
		await createFixture();
	}, 60_000);

	afterEach(() => {
		for (const socket of sockets.splice(0)) socket.disconnect();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (tripIds.length > 0) {
				await dataSource.query(
					`DELETE FROM "audit_logs" WHERE "target_type" = 'sos_alert' AND "target_id" IN
					 (SELECT "id" FROM "sos_alerts" WHERE "trip_id" = ANY($1))`,
					[tripIds]
				);
				await dataSource.query('DELETE FROM "sos_alerts" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
					bookingIds,
				]);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, label: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`sos-ctms79-${label}-${id}@example.com`,
				await hash("P@ssword123", 4),
				role,
				UserStatus.ACTIVE,
				`SOS ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createFixture(): Promise<void> {
		host = await createAccount(UserRole.HOST, "host");
		otherHost = await createAccount(UserRole.HOST, "other-host");
		camper = await createAccount(UserRole.CAMPER, "camper");

		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'SOS Route 79',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2, 16.05), ST_MakePoint(108.22, 16.07)), 4326)::geography,
				2000, 'moderate', 120, $3
			 )`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		tripId = randomUUID();
		tripIds.push(tripId);
		const start = new Date(Date.now() - 3600_000);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'Real-time SOS Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.05), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 1, 0, $5
			 )`,
			[tripId, host.id, routeId, start, TripStatus.ONGOING]
		);

		const bookingId = randomUUID();
		bookingIds.push(bookingId);
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status")
			 VALUES ($1, $2, $3, 1, 0, $4)`,
			[bookingId, tripId, camper.id, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at"
			 ) VALUES ($1, $2, $3, true, $4, now())`,
			[randomUUID(), bookingId, camper.id, BookingMemberStatus.JOINED]
		);
	}

	/** Opens a socket and resolves once the gateway has finished authenticating it. */
	function connect(token?: string): Promise<ClientSocket> {
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: token ? { token } : {},
		});
		sockets.push(socket);
		return new Promise((resolve, reject) => {
			socket.once("connected", () => resolve(socket));
			socket.once("auth.error", () => reject(new Error("socket rejected")));
			socket.once("connect_error", reject);
		});
	}

	/** Resolves with the auth error once the gateway rejects and drops the socket. */
	function expectRejected(token: string): Promise<{ message: string }> {
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: { token },
		});
		sockets.push(socket);
		return new Promise((resolve, reject) => {
			let error: { message: string } | undefined;
			socket.once("auth.error", (payload: { message: string }) => {
				error = payload;
			});
			socket.once("connected", () => reject(new Error("socket was accepted")));
			socket.once("disconnect", () =>
				error ? resolve(error) : reject(new Error("disconnected without auth.error"))
			);
		});
	}

	function collect<T>(socket: ClientSocket, event: string): Array<T & { receivedAt: number }> {
		const received: Array<T & { receivedAt: number }> = [];
		socket.on(event, (payload: T) => received.push({ ...payload, receivedAt: Date.now() }));
		return received;
	}

	async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (!predicate()) {
			if (Date.now() > deadline) throw new Error(`condition not met within ${timeoutMs}ms`);
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	async function createSos(): Promise<string> {
		const res = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.INJURY,
				location: { latitude: 16.052, longitude: 108.205 },
				batteryLevel: 40,
				eventTime: new Date().toISOString(),
			});
		expect(res.status).toBe(201);
		return res.body.id as string;
	}

	it("BR-260: the authorized Host receives the persisted SOS over WebSocket in under 5 seconds", async () => {
		const hostSocket = await connect(host.accessToken);
		const received = collect<SosCreatedPayload>(hostSocket, "sos.created");

		const sosId = await createSos();
		await waitUntil(() => received.length > 0, SOS_DELIVERY_BUDGET_MS);

		const [event] = received;
		const row = await dataSource.getRepository(SosAlert).findOneByOrFail({ id: sosId });
		expect(event).toMatchObject({
			eventId: sosId,
			sosId,
			tripId,
			senderId: camper.id,
			emergencyType: EmergencyType.INJURY,
			status: SosStatus.ACTIVE,
			persistedAt: row.receivedAt.toISOString(),
		});
		const latencyMs = event.receivedAt - Date.parse(event.persistedAt);
		expect(latencyMs).toBeGreaterThanOrEqual(0);
		expect(latencyMs).toBeLessThan(SOS_DELIVERY_BUDGET_MS);

		// Receipt is not acknowledgement.
		expect(row.status).toBe(SosStatus.ACTIVE);
		expect(row.acknowledgedAt).toBeNull();
	});

	it("BR-259 / PB AC-3: other Hosts, the non-Host sender and anonymous sockets receive nothing", async () => {
		const hostSocket = await connect(host.accessToken);
		const otherHostSocket = await connect(otherHost.accessToken);
		const camperSocket = await connect(camper.accessToken);
		const anonymousSocket = await connect();
		const hostEvents = collect<SosCreatedPayload>(hostSocket, "sos.created");
		const otherHostEvents = collect<SosCreatedPayload>(otherHostSocket, "sos.created");
		const camperEvents = collect<SosCreatedPayload>(camperSocket, "sos.created");
		const anonymousEvents = collect<SosCreatedPayload>(anonymousSocket, "sos.created");

		await createSos();
		await waitUntil(() => hostEvents.length > 0, SOS_DELIVERY_BUDGET_MS);
		await settle(NEGATIVE_OBSERVATION_MS);

		expect(hostEvents).toHaveLength(1);
		expect(otherHostEvents).toHaveLength(0);
		expect(camperEvents).toHaveLength(0);
		expect(anonymousEvents).toHaveLength(0);
	});

	it("BR-259: an invalid or expired token is rejected and never joined to a room", async () => {
		await expect(expectRejected("not-a-jwt")).resolves.toMatchObject({
			message: expect.any(String),
		});
		const expired = jwtService.sign(
			{ sub: host.id, roles: [UserRole.HOST] },
			{ expiresIn: "-10s" }
		);
		await expect(expectRejected(expired)).resolves.toMatchObject({
			message: expect.any(String),
		});
	});

	it("BR-259: a suspended Host is rejected even with an unexpired token", async () => {
		await dataSource.query('UPDATE "users" SET "status" = $2 WHERE "id" = $1', [
			otherHost.id,
			UserStatus.SUSPENDED,
		]);
		try {
			await expect(expectRejected(otherHost.accessToken)).resolves.toMatchObject({
				message: expect.any(String),
			});
		} finally {
			await dataSource.query('UPDATE "users" SET "status" = $2 WHERE "id" = $1', [
				otherHost.id,
				UserStatus.ACTIVE,
			]);
		}
	});

	it("each open Host session receives one copy, and reconnecting does not replay or duplicate events", async () => {
		const tabA = await connect(host.accessToken);
		const tabB = await connect(host.accessToken);
		const tabAEvents = collect<SosCreatedPayload>(tabA, "sos.created");
		const tabBEvents = collect<SosCreatedPayload>(tabB, "sos.created");

		const firstSosId = await createSos();
		await waitUntil(() => tabAEvents.length > 0 && tabBEvents.length > 0, SOS_DELIVERY_BUDGET_MS);

		// Host goes offline; an SOS persisted meanwhile is not delivered over the socket.
		tabA.disconnect();
		tabB.disconnect();
		const missedSosId = await createSos();

		const reconnected = await connect(host.accessToken);
		const reconnectedEvents = collect<SosCreatedPayload>(reconnected, "sos.created");
		await settle(NEGATIVE_OBSERVATION_MS);

		expect(tabAEvents.map((e) => e.eventId)).toEqual([firstSosId]);
		expect(tabBEvents.map((e) => e.eventId)).toEqual([firstSosId]);
		expect(reconnectedEvents).toHaveLength(0);

		// Missed-event recovery goes through the authorized Host API, keyed by the same SOS identity.
		const res = await request(app.getHttpServer())
			.get("/api/host/sos-alerts")
			.query({ tripId, status: SosStatus.ACTIVE, limit: 50 })
			.set("Authorization", `Bearer ${host.accessToken}`);
		expect(res.status).toBe(200);
		const activeIds = (res.body.items as Array<{ id: string }>).map((item) => item.id);
		expect(activeIds).toEqual(expect.arrayContaining([firstSosId, missedSosId]));
	});

	it("sos.state_changed reaches only the Trip Host and the SOS sender", async () => {
		const sosId = await createSos();
		const hostSocket = await connect(host.accessToken);
		const camperSocket = await connect(camper.accessToken);
		const otherHostSocket = await connect(otherHost.accessToken);
		const anonymousSocket = await connect();
		const hostEvents = collect<SosStateChangedPayload>(hostSocket, "sos.state_changed");
		const camperEvents = collect<SosStateChangedPayload>(camperSocket, "sos.state_changed");
		const otherHostEvents = collect<SosStateChangedPayload>(otherHostSocket, "sos.state_changed");
		const anonymousEvents = collect<SosStateChangedPayload>(anonymousSocket, "sos.state_changed");

		const ack = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/acknowledge`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send();
		expect(ack.status).toBe(200);

		await waitUntil(() => hostEvents.length > 0 && camperEvents.length > 0, SOS_DELIVERY_BUDGET_MS);
		await settle(NEGATIVE_OBSERVATION_MS);

		expect(hostEvents).toEqual([
			expect.objectContaining({ sosId, status: SosStatus.ACKNOWLEDGED, acknowledgedBy: host.id }),
		]);
		expect(camperEvents).toHaveLength(1);
		expect(otherHostEvents).toHaveLength(0);
		expect(anonymousEvents).toHaveLength(0);
	});
});
