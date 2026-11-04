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
	EventsGateway,
	type TripRoomAck,
	TripRoomError,
	roleRoom,
	tripRoom,
	userRoom,
} from "../src/modules/realtime/events.gateway";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface ConnectedPayload {
	authenticated: boolean;
	rooms?: string[];
}

/** How long a socket that must NOT receive an event is observed after an authorized one got it. */
const NEGATIVE_OBSERVATION_MS = 750;
const DELIVERY_TIMEOUT_MS = 5_000;

describe("Authenticated WebSocket connection (CTMS-078, BR-259/BR-170/BR-171/BR-172, integration, real Postgres + socket.io)", () => {
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
	let hostA: Account;
	let hostB: Account;
	let joinedCamper: Account;
	let registeredCamper: Account;
	let leftCamper: Account;
	let assignedPorter: Account;
	let unassignedPorter: Account;
	let outsider: Account;
	let tripA: string;
	let tripB: string;

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
		await createFixture();
	}, 60_000);

	afterEach(() => {
		for (const socket of sockets.splice(0)) socket.disconnect();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
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
				`ws-ctms78-${label}-${id}@example.com`,
				await hash("P@ssword123", 4),
				role,
				UserStatus.ACTIVE,
				`WS ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(host: Account, title: string): Promise<string> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2, 16.05), ST_MakePoint(108.22, 16.07)), 4326)::geography,
				2000, 'moderate', 120, $4
			 )`,
			[routeId, host.id, `${title} route`, TrekkingRouteStatus.ACTIVE]
		);
		const tripId = randomUUID();
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, $4, 'day_trip', 0, now() - interval '1 hour', now() + interval '7 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.05), 4326)::geography,
				now() - interval '1 day', 1, 20, 3, 0, $5
			 )`,
			[tripId, host.id, routeId, title, TripStatus.ONGOING]
		);
		return tripId;
	}

	async function addCamper(
		tripId: string,
		camper: Account,
		status: BookingMemberStatus
	): Promise<void> {
		const bookingId = randomUUID();
		bookingIds.push(bookingId);
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status")
			 VALUES ($1, $2, $3, 1, 0, $4)`,
			[bookingId, tripId, camper.id, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status")
			 VALUES ($1, $2, $3, true, $4)`,
			[randomUUID(), bookingId, camper.id, status]
		);
	}

	async function createFixture(): Promise<void> {
		admin = await createAccount(UserRole.ADMIN, "admin");
		hostA = await createAccount(UserRole.HOST, "host-a");
		hostB = await createAccount(UserRole.HOST, "host-b");
		joinedCamper = await createAccount(UserRole.CAMPER, "joined");
		registeredCamper = await createAccount(UserRole.CAMPER, "registered");
		leftCamper = await createAccount(UserRole.CAMPER, "left");
		assignedPorter = await createAccount(UserRole.PORTER, "porter-assigned");
		unassignedPorter = await createAccount(UserRole.PORTER, "porter-unassigned");
		outsider = await createAccount(UserRole.CAMPER, "outsider");

		tripA = await createTrip(hostA, "WS Trip A");
		tripB = await createTrip(hostB, "WS Trip B");
		await addCamper(tripA, joinedCamper, BookingMemberStatus.JOINED);
		await addCamper(tripA, registeredCamper, BookingMemberStatus.REGISTERED);
		await addCamper(tripA, leftCamper, BookingMemberStatus.LEFT);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, 'assigned'), ($1, $3, 'unassigned')`,
			[tripA, assignedPorter.id, unassignedPorter.id]
		);
	}

	function open(token?: string): ClientSocket {
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: token ? { token } : {},
		});
		sockets.push(socket);
		return socket;
	}

	/** Resolves with the server's `connected` payload once the handshake has been authorized. */
	function connect(token?: string): Promise<{ socket: ClientSocket; connected: ConnectedPayload }> {
		const socket = open(token);
		return new Promise((resolve, reject) => {
			socket.once("connected", (connected: ConnectedPayload) => resolve({ socket, connected }));
			socket.once("auth.error", () => reject(new Error("socket rejected")));
			socket.once("connect_error", reject);
		});
	}

	function expectRejected(token: string): Promise<void> {
		const socket = open(token);
		return new Promise((resolve, reject) => {
			let rejected = false;
			socket.once("auth.error", () => {
				rejected = true;
			});
			socket.once("connected", () => reject(new Error("socket was accepted")));
			socket.once("disconnect", () =>
				rejected ? resolve() : reject(new Error("disconnected without auth.error"))
			);
		});
	}

	function subscribe(socket: ClientSocket, tripId: unknown): Promise<TripRoomAck> {
		return socket.timeout(DELIVERY_TIMEOUT_MS).emitWithAck("trip.subscribe", { tripId });
	}

	function collect(socket: ClientSocket, event: string): unknown[] {
		const received: unknown[] = [];
		socket.on(event, (payload: unknown) => received.push(payload));
		return received;
	}

	async function waitUntil(predicate: () => boolean): Promise<void> {
		const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
		while (!predicate()) {
			if (Date.now() > deadline) throw new Error("condition not met in time");
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	const settle = () => new Promise((resolve) => setTimeout(resolve, NEGATIVE_OBSERVATION_MS));

	describe("connection authentication (PB AC-1..AC-3, BR-170/BR-171)", () => {
		it("authenticates a valid JWT and joins only the user room and DB-granted role rooms", async () => {
			const { connected } = await connect(hostA.accessToken);

			expect(connected.authenticated).toBe(true);
			expect(connected.rooms).toEqual([userRoom(hostA.id), roleRoom(UserRole.HOST)]);
		});

		it("rejects a malformed token", async () => {
			await expect(expectRejected("not-a-jwt")).resolves.toBeUndefined();
		});

		it("rejects a token signed with another secret", async () => {
			const forged = new JwtService({ secret: "attacker-secret" }).sign({
				sub: admin.id,
				roles: [UserRole.ADMIN],
			});
			await expect(expectRejected(forged)).resolves.toBeUndefined();
		});

		it("rejects an expired token", async () => {
			const expired = jwtService.sign(
				{ sub: hostA.id, roles: [UserRole.HOST] },
				{ expiresIn: "-10s" }
			);
			await expect(expectRejected(expired)).resolves.toBeUndefined();
		});

		it.each([UserStatus.SUSPENDED, UserStatus.PENDING_VERIFICATION, UserStatus.DELETED])(
			"rejects a %s account even with an unexpired token",
			async (status) => {
				await dataSource.query('UPDATE "users" SET "status" = $2 WHERE "id" = $1', [
					outsider.id,
					status,
				]);
				try {
					await expect(expectRejected(outsider.accessToken)).resolves.toBeUndefined();
				} finally {
					await dataSource.query('UPDATE "users" SET "status" = $2 WHERE "id" = $1', [
						outsider.id,
						UserStatus.ACTIVE,
					]);
				}
			}
		);

		it("keeps an anonymous socket out of every private room", async () => {
			const { connected } = await connect();

			expect(connected.authenticated).toBe(false);
			expect(connected.rooms).toBeUndefined();
		});
	});

	describe("role rooms come from the database (BR-172)", () => {
		it("does not grant the admin room to a camper whose token claims admin", async () => {
			const escalated = jwtService.sign({ sub: outsider.id, roles: [UserRole.ADMIN] });
			const { socket: forged, connected } = await connect(escalated);
			const { socket: realAdmin } = await connect(admin.accessToken);
			const forgedEvents = collect(forged, "trip.review.requested");
			const adminEvents = collect(realAdmin, "trip.review.requested");

			gateway.emitTripReviewRequested({
				tripId: tripA,
				title: "WS Trip A",
				hostId: hostA.id,
				submittedAt: new Date().toISOString(),
				deadlineAt: new Date().toISOString(),
			});
			await waitUntil(() => adminEvents.length > 0);
			await settle();

			expect(connected.rooms).toEqual([userRoom(outsider.id), roleRoom(UserRole.CAMPER)]);
			expect(adminEvents).toHaveLength(1);
			expect(forgedEvents).toHaveLength(0);
		});
	});

	describe("Trip room authorization (PB AC-4/AC-5)", () => {
		it.each<[string, () => Account]>([
			["the Trip Host", () => hostA],
			["a joined Camper", () => joinedCamper],
			["a registered Camper", () => registeredCamper],
			["an assigned Porter", () => assignedPorter],
		])("lets %s join the Trip room", async (_label, account) => {
			const { socket } = await connect(account().accessToken);

			await expect(subscribe(socket, tripA)).resolves.toEqual({ ok: true, room: tripRoom(tripA) });
		});

		it.each<[string, () => Account]>([
			["a Host authorized for Trip B only", () => hostB],
			["a Camper who left", () => leftCamper],
			["an unassigned Porter", () => unassignedPorter],
			["an unrelated user", () => outsider],
			["the platform Admin (no Trip relationship)", () => admin],
		])("refuses %s", async (_label, account) => {
			const { socket } = await connect(account().accessToken);

			await expect(subscribe(socket, tripA)).resolves.toEqual({
				ok: false,
				error: TripRoomError.NOT_TRIP_MEMBER,
			});
		});

		it("gives a Host only the room of the Trip they are authorized for", async () => {
			const { socket } = await connect(hostB.accessToken);

			await expect(subscribe(socket, tripB)).resolves.toEqual({ ok: true, room: tripRoom(tripB) });
			await expect(subscribe(socket, tripA)).resolves.toEqual({
				ok: false,
				error: TripRoomError.NOT_TRIP_MEMBER,
			});
		});

		it("refuses anonymous sockets, unknown Trips and malformed ids", async () => {
			const { socket: anonymous } = await connect();
			const { socket: host } = await connect(hostA.accessToken);

			await expect(subscribe(anonymous, tripA)).resolves.toEqual({
				ok: false,
				error: TripRoomError.NOT_AUTHENTICATED,
			});
			await expect(subscribe(host, randomUUID())).resolves.toEqual({
				ok: false,
				error: TripRoomError.TRIP_NOT_FOUND,
			});
			await expect(subscribe(host, "trip:all")).resolves.toEqual({
				ok: false,
				error: TripRoomError.INVALID_TRIP_ID,
			});
		});

		it("delivers Trip events only to authorized subscribers, never to refused or anonymous sockets", async () => {
			const { socket: member } = await connect(joinedCamper.accessToken);
			const { socket: otherHost } = await connect(hostB.accessToken);
			const { socket: left } = await connect(leftCamper.accessToken);
			const { socket: anonymous } = await connect();
			await subscribe(member, tripA);
			await subscribe(otherHost, tripA);
			await subscribe(left, tripA);
			await subscribe(anonymous, tripA);
			const memberEvents = collect(member, "trip.incident.reported");
			const otherHostEvents = collect(otherHost, "trip.incident.reported");
			const leftEvents = collect(left, "trip.incident.reported");
			const anonymousEvents = collect(anonymous, "trip.incident.reported");

			gateway.emitTripIncidentReported({
				incidentId: randomUUID(),
				tripId: tripA,
				hostId: hostA.id,
				reporterId: joinedCamper.id,
				category: "injury",
				severity: "high",
				occurredAt: new Date().toISOString(),
			});
			await waitUntil(() => memberEvents.length > 0);
			await settle();

			expect(memberEvents).toHaveLength(1);
			expect(otherHostEvents).toHaveLength(0);
			expect(leftEvents).toHaveLength(0);
			expect(anonymousEvents).toHaveLength(0);
		});

		it("stops Trip events after trip.unsubscribe", async () => {
			const { socket } = await connect(joinedCamper.accessToken);
			await subscribe(socket, tripA);
			await expect(
				socket.timeout(DELIVERY_TIMEOUT_MS).emitWithAck("trip.unsubscribe", { tripId: tripA })
			).resolves.toEqual({ ok: true, room: tripRoom(tripA) });
			const events = collect(socket, "trip.incident.updated");

			gateway.emitTripIncidentUpdated({
				incidentId: randomUUID(),
				tripId: tripA,
				hostId: hostA.id,
				status: "in_progress",
				assignedTo: null,
				updatedAt: new Date().toISOString(),
			});
			await settle();

			expect(events).toHaveLength(0);
		});

		it("does not carry Trip room membership over a reconnect; authorization is evaluated again", async () => {
			const { socket: first } = await connect(joinedCamper.accessToken);
			await subscribe(first, tripA);
			first.disconnect();

			const { socket: reconnected } = await connect(joinedCamper.accessToken);
			const events = collect(reconnected, "trip.incident.reported");
			gateway.emitTripIncidentReported({
				incidentId: randomUUID(),
				tripId: tripA,
				hostId: hostA.id,
				reporterId: joinedCamper.id,
				category: "lost",
				severity: "medium",
				occurredAt: new Date().toISOString(),
			});
			await settle();
			expect(events).toHaveLength(0);

			// Membership revoked meanwhile: the new subscribe is refused.
			await dataSource.query(
				`UPDATE "booking_members" SET "member_status" = $2
				 WHERE "user_id" = $1`,
				[joinedCamper.id, BookingMemberStatus.LEFT]
			);
			try {
				await expect(subscribe(reconnected, tripA)).resolves.toEqual({
					ok: false,
					error: TripRoomError.NOT_TRIP_MEMBER,
				});
			} finally {
				await dataSource.query(
					`UPDATE "booking_members" SET "member_status" = $2 WHERE "user_id" = $1`,
					[joinedCamper.id, BookingMemberStatus.JOINED]
				);
			}
		});
	});

	describe("scoped delivery of previously global events", () => {
		it("sends Porter requests only to the Porter and the requesting Host", async () => {
			const { socket: porter } = await connect(assignedPorter.accessToken);
			const { socket: host } = await connect(hostA.accessToken);
			const { socket: otherPorter } = await connect(unassignedPorter.accessToken);
			const { socket: anonymous } = await connect();
			const porterEvents = collect(porter, "porter.request.created");
			const hostEvents = collect(host, "porter.request.created");
			const otherEvents = collect(otherPorter, "porter.request.created");
			const anonymousEvents = collect(anonymous, "porter.request.created");

			gateway.emitPorterRequestCreated({
				requestId: randomUUID(),
				tripId: tripA,
				porterId: assignedPorter.id,
				requestedBy: hostA.id,
				requestedRole: "guide",
				expiresAt: new Date().toISOString(),
			});
			await waitUntil(() => porterEvents.length > 0 && hostEvents.length > 0);
			await settle();

			expect(otherEvents).toHaveLength(0);
			expect(anonymousEvents).toHaveLength(0);
		});

		it("sends Trip review auto-rejection to the owning Host and Admins only", async () => {
			const { socket: owner } = await connect(hostA.accessToken);
			const { socket: adminSocket } = await connect(admin.accessToken);
			const { socket: otherHost } = await connect(hostB.accessToken);
			const ownerEvents = collect(owner, "trip.review.auto_rejected");
			const adminEvents = collect(adminSocket, "trip.review.auto_rejected");
			const otherEvents = collect(otherHost, "trip.review.auto_rejected");

			gateway.emitTripReviewAutoRejected({
				tripId: tripA,
				title: "WS Trip A",
				hostId: hostA.id,
				rejectedAt: new Date().toISOString(),
				reason: "review deadline passed",
			});
			await waitUntil(() => ownerEvents.length > 0 && adminEvents.length > 0);
			await settle();

			expect(otherEvents).toHaveLength(0);
		});

		it("still broadcasts public Trip availability to anonymous visitors", async () => {
			const { socket: anonymous } = await connect();
			const events = collect(anonymous, "trip.availability.updated");

			gateway.emitTripAvailabilityUpdated({
				eventId: randomUUID(),
				tripId: tripA,
				seatsTaken: 3,
				capacityMax: 20,
				remainingSeats: 17,
				updatedAt: new Date().toISOString(),
			});
			await waitUntil(() => events.length > 0);

			expect(events).toHaveLength(1);
		});
	});
});
