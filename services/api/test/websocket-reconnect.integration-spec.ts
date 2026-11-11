import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import { type Socket as ClientSocket, io } from "socket.io-client";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import {
	type ConnectedPayload,
	EventsGateway,
	type RealtimeResumeAck,
	RealtimeResumeError,
	type TripRoomAck,
} from "../src/modules/realtime/events.gateway";
import type { RealtimeEventMeta } from "../src/modules/realtime/realtime-events.service";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	token: () => string;
}

interface Received {
	payload: Record<string, unknown>;
	meta: RealtimeEventMeta;
}

const DELIVERY_TIMEOUT_MS = 5_000;

describe("Automatic WebSocket reconnect: missed-event recovery (CTMS-082, BR-263/BR-259, integration, real Postgres + socket.io)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let gateway: EventsGateway;
	let baseUrl: string;
	const sockets: ClientSocket[] = [];
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

	let admin: Account;
	let host: Account;
	let camper: Account;
	let tripId: string;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix("api");
		await app.listen(0, "127.0.0.1");
		const { port } = app.getHttpServer().address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${port}`;
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		gateway = moduleRef.get(EventsGateway);
		await assertSafeTestDatabase(dataSource);

		admin = await createAccount(UserRole.ADMIN, "admin");
		host = await createAccount(UserRole.HOST, "host");
		camper = await createAccount(UserRole.CAMPER, "camper");
		tripId = await createTrip(host);
		await addCamper(tripId, camper, BookingMemberStatus.JOINED);
	}, 60_000);

	afterEach(async () => {
		for (const socket of sockets.splice(0)) socket.disconnect();
		await gateway.flushPublished();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				`DELETE FROM "realtime_events" WHERE "user_ids" && $1::uuid[] OR "trip_id" = ANY($2::uuid[])`,
				[userIds, tripIds]
			);
			await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
				bookingIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
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
				`ws-ctms82-${label}-${id}@example.com`,
				await hash("P@ssword123", 4),
				role,
				UserStatus.ACTIVE,
				`WS82 ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		// A fresh access token on every call, as a client gets after a refresh.
		return { id, token: () => jwtService.sign({ sub: id, roles: [role], jti: randomUUID() }) };
	}

	async function createTrip(owner: Account): Promise<string> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'WS82 route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2, 16.05), ST_MakePoint(108.22, 16.07)), 4326)::geography,
				2000, 'moderate', 120, $3
			 )`,
			[routeId, owner.id, TrekkingRouteStatus.ACTIVE]
		);
		const id = randomUUID();
		tripIds.push(id);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'WS82 Trip', 'day_trip', 0, now() - interval '1 hour', now() + interval '7 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.05), 4326)::geography,
				now() - interval '1 day', 1, 20, 1, 0, $4
			 )`,
			[id, owner.id, routeId, TripStatus.ONGOING]
		);
		return id;
	}

	async function addCamper(trip: string, account: Account, status: BookingMemberStatus) {
		const bookingId = randomUUID();
		bookingIds.push(bookingId);
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status")
			 VALUES ($1, $2, $3, 1, 0, $4)`,
			[bookingId, trip, account.id, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status")
			 VALUES ($1, $2, $3, true, $4)`,
			[randomUUID(), bookingId, account.id, status]
		);
	}

	async function setCamperStatus(status: BookingMemberStatus) {
		await dataSource.query(
			`UPDATE "booking_members" SET "member_status" = $2 WHERE "user_id" = $1`,
			[camper.id, status]
		);
	}

	function connect(token?: string): Promise<{ socket: ClientSocket; connected: ConnectedPayload }> {
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: token ? { token } : {},
		});
		sockets.push(socket);
		return new Promise((resolve, reject) => {
			socket.once("connected", (connected: ConnectedPayload) => resolve({ socket, connected }));
			socket.once("auth.error", () => reject(new Error("socket rejected")));
			socket.once("connect_error", reject);
		});
	}

	function resume(socket: ClientSocket, afterSequence: unknown): Promise<RealtimeResumeAck> {
		return socket.timeout(DELIVERY_TIMEOUT_MS).emitWithAck("realtime.resume", { afterSequence });
	}

	function collect(socket: ClientSocket, event: string): Received[] {
		const received: Received[] = [];
		socket.on(event, (payload: Record<string, unknown>, meta: RealtimeEventMeta) =>
			received.push({ payload, meta })
		);
		return received;
	}

	async function waitUntil(predicate: () => boolean): Promise<void> {
		const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
		while (!predicate()) {
			if (Date.now() > deadline) throw new Error("condition not met in time");
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	function reportIncident(): string {
		const incidentId = randomUUID();
		gateway.emitTripIncidentReported({
			incidentId,
			tripId,
			hostId: host.id,
			reporterId: camper.id,
			category: "lost",
			severity: "medium",
			occurredAt: new Date().toISOString(),
		});
		return incidentId;
	}

	function broadcastTo(userId: string): string {
		const eventId = randomUUID();
		gateway.emitEmergencyBroadcast([userId], {
			eventId,
			broadcastId: eventId,
			tripId,
			tripTitle: "WS82 Trip",
			hostId: host.id,
			alertType: "evacuation",
			content: "Xuống núi ngay",
			createdAt: new Date().toISOString(),
		});
		return eventId;
	}

	function requestReview(): void {
		gateway.emitTripReviewRequested({
			tripId,
			title: "WS82 Trip",
			hostId: host.id,
			submittedAt: new Date().toISOString(),
			deadlineAt: new Date().toISOString(),
		});
	}

	it("gives the reconnect cursor and the bounded backoff on connect", async () => {
		const { connected } = await connect(camper.token());
		expect(connected.authenticated).toBe(true);
		expect(Number.isSafeInteger(connected.latestSequence)).toBe(true);
		expect(connected.reconnect).toEqual({
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			multiplier: 2,
			jitterRatio: 0.2,
		});

		const { connected: anonymous } = await connect();
		expect(anonymous).toEqual(
			expect.objectContaining({ authenticated: false, latestSequence: null })
		);
	});

	it("recovers the user and Trip events missed while offline, once, in order, with the live identity", async () => {
		const { socket, connected } = await connect(camper.token());
		const startCursor = connected.latestSequence as number;
		await expect(
			socket.timeout(DELIVERY_TIMEOUT_MS).emitWithAck("trip.subscribe", { tripId })
		).resolves.toEqual(expect.objectContaining({ ok: true }) as TripRoomAck);
		const live = collect(socket, "trip.incident.reported");
		const liveIncident = reportIncident();
		await waitUntil(() => live.length === 1);
		expect(live[0].payload.incidentId).toBe(liveIncident);
		expect(live[0].meta.sequence).toBeGreaterThan(startCursor);
		const lastSeen = live[0].meta.sequence as number;

		socket.disconnect();
		const missedIncident = reportIncident();
		const missedBroadcast = broadcastTo(camper.id);
		requestReview(); // Admin-only: never recovered by a Camper.
		broadcastTo(host.id); // Another user's private event.
		await gateway.flushPublished();

		const { socket: back } = await connect(camper.token());
		const recovered = await resume(back, lastSeen);
		expect(recovered.ok).toBe(true);
		if (!recovered.ok) return;
		expect(recovered.truncated).toBe(false);
		expect(recovered.events.map((event) => event.event)).toEqual([
			"trip.incident.reported",
			"emergency.broadcast",
		]);
		expect((recovered.events[0].payload as { incidentId: string }).incidentId).toBe(missedIncident);
		expect(recovered.events[1].meta.eventId).toBe(missedBroadcast);
		const sequences = recovered.events.map((event) => event.meta.sequence as number);
		expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
		expect(sequences.every((sequence) => sequence > lastSeen)).toBe(true);

		// From an older cursor the live event comes back too, with the identity it had live,
		// so a client that already showed it drops the copy.
		const fromStart = await resume(back, startCursor);
		if (!fromStart.ok) throw new Error("resume failed");
		const again = fromStart.events.find(
			(event) => (event.payload as { incidentId?: string }).incidentId === liveIncident
		);
		expect(again?.meta).toEqual(live[0].meta);
		expect(new Set(fromStart.events.map((event) => event.meta.eventId)).size).toBe(
			fromStart.events.length
		);
	});

	it("recovers Admin role events for an Admin only", async () => {
		const { connected } = await connect(admin.token());
		const cursor = connected.latestSequence as number;
		requestReview();
		await gateway.flushPublished();

		const { socket: adminBack } = await connect(admin.token());
		const forAdmin = await resume(adminBack, cursor);
		if (!forAdmin.ok) throw new Error("resume failed");
		expect(forAdmin.events.map((event) => event.event)).toEqual(["trip.review.requested"]);

		const { socket: camperBack } = await connect(camper.token());
		const forCamper = await resume(camperBack, cursor);
		if (!forCamper.ok) throw new Error("resume failed");
		expect(forCamper.events).toEqual([]);
	});

	it("does not recover Trip events once the Camper has left the Trip", async () => {
		const { connected } = await connect(camper.token());
		const cursor = connected.latestSequence as number;
		reportIncident();
		const ownBroadcast = broadcastTo(camper.id);
		await gateway.flushPublished();

		await setCamperStatus(BookingMemberStatus.LEFT);
		try {
			const { socket } = await connect(camper.token());
			const recovered = await resume(socket, cursor);
			if (!recovered.ok) throw new Error("resume failed");
			// Only the private event addressed to the Camper; the Trip room event is filtered now.
			expect(recovered.events.map((event) => event.meta.eventId)).toEqual([ownBroadcast]);
		} finally {
			await setCamperStatus(BookingMemberStatus.JOINED);
		}
	});

	it("rejects an expired token and refuses resume from an anonymous socket", async () => {
		const expired = jwtService.sign(
			{ sub: camper.id, roles: [UserRole.CAMPER] },
			{ expiresIn: -10 }
		);
		await expect(connect(expired)).rejects.toThrow("socket rejected");

		const { socket } = await connect();
		await expect(resume(socket, 0)).resolves.toEqual({
			ok: false,
			error: RealtimeResumeError.NOT_AUTHENTICATED,
		});
		const { socket: authenticated } = await connect(camper.token());
		await expect(resume(authenticated, "1")).resolves.toEqual({
			ok: false,
			error: RealtimeResumeError.INVALID_CURSOR,
		});
	});

	it("stores a re-published event once, so its live copies share one identity and cursor", async () => {
		const { socket } = await connect(camper.token());
		const live = collect(socket, "trip.weather.changed");
		const payload = {
			eventId: randomUUID(),
			tripId,
			tripTitle: "WS82 Trip",
			tripStartsAt: new Date().toISOString(),
			previousRiskLevel: "yellow",
			riskLevel: "red",
			createdAt: new Date().toISOString(),
		};
		gateway.emitTripWeatherChanged([camper.id], payload);
		await gateway.flushPublished();
		gateway.emitTripWeatherChanged([camper.id], payload);
		await waitUntil(() => live.length === 2);

		expect(live[1].meta.eventId).toBe(live[0].meta.eventId);
		expect(live[1].meta.sequence).toBe(live[0].meta.sequence);
		const rows = await dataSource.query<Array<{ count: string }>>(
			`SELECT COUNT(*) AS "count" FROM "realtime_events" WHERE "id" = $1`,
			[payload.eventId]
		);
		expect(Number(rows[0].count)).toBe(1);
	});

	it("asks the client to reload when missed events are past the retention window or the cursor is unknown", async () => {
		const { connected } = await connect(camper.token());
		const cursor = connected.latestSequence as number;
		broadcastTo(camper.id);
		await gateway.flushPublished();
		// The first missed event is now older than the 24 h window.
		await dataSource.query(
			`UPDATE "realtime_events" SET "created_at" = now() - interval '25 hours' WHERE "sequence" > $1`,
			[cursor]
		);
		const kept = broadcastTo(camper.id);
		await gateway.flushPublished();

		const { socket } = await connect(camper.token());
		const recovered = await resume(socket, cursor);
		if (!recovered.ok) throw new Error("resume failed");
		expect(recovered.truncated).toBe(true);
		expect(recovered.events.map((event) => event.meta.eventId)).toEqual([kept]);

		const unknown = await resume(socket, recovered.latestSequence + 1000);
		expect(unknown).toEqual(expect.objectContaining({ ok: true, events: [], truncated: true }));
	});
});
