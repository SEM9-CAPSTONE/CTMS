import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { type Socket, io } from "socket.io-client";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { InAppNotificationDeliveryWorker } from "../src/modules/in-app-notifications/in-app-notification-delivery.worker";
import { InAppNotificationType as EventType } from "../src/modules/in-app-notifications/in-app-notification.entity";
import { InAppNotificationsService } from "../src/modules/in-app-notifications/in-app-notifications.service";
import { EventsGateway } from "../src/modules/realtime/events.gateway";
import { WaypointType } from "../src/modules/trips/entities/trip-waypoint.entity";
import { TripReviewDeadlineService } from "../src/modules/trips/services/trip-review-deadline.service";
import { TripsService } from "../src/modules/trips/services/trips.service";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-379 in-app notifications (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let service: InAppNotificationsService;
	let trips: TripsService;
	let worker: InAppNotificationDeliveryWorker;
	let jwt: JwtService;
	let gateway: EventsGateway;
	let deliverySpy: jest.SpyInstance;
	const host = randomUUID();
	const admin = randomUUID();
	const camper = randomUUID();
	const suspended = randomUUID();
	const route = randomUUID();
	let trip: string;
	const tripIds: string[] = [];
	const emit = jest.fn().mockResolvedValue(undefined);
	const round = "2026-11-17T00:00:00.000Z";
	const now = new Date("2026-11-17T23:10:00.000Z");

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(TripReviewDeadlineService)
			.useValue({ runOnce: jest.fn() })
			.compile();
		app = module.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
		);
		await app.init();
		db = module.get(DataSource);
		await assertSafeTestDatabase(db);
		service = module.get(InAppNotificationsService);
		trips = module.get(TripsService);
		worker = module.get(InAppNotificationDeliveryWorker);
		jwt = module.get(JwtService);
		gateway = module.get(EventsGateway);
		deliverySpy = jest.spyOn(gateway, "emitInAppNotification").mockImplementation(emit);
		for (const [id, role, status, name] of [
			[host, "host", "active", "Lê Văn Hoàng"],
			[admin, "admin", "active", "Nguyễn Minh Anh"],
			[camper, "camper", "active", "Trần Thanh Mai"],
			[suspended, "admin", "suspended", "Đỗ Quang Huy"],
		]) {
			await db.query(
				`INSERT INTO users(id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused-integration-hash', $3, $4, $5)`,
				[id, `${id}@example.org`, role, status, name]
			);
			await db.query("INSERT INTO user_roles(user_id, role) VALUES ($1, $2)", [id, role]);
		}
		await db.query(
			`INSERT INTO trekking_routes(id, host_id, name, description, route_geom,
			length_meters, difficulty, expected_duration_minutes, status)
			VALUES ($1, $2, 'Đường mòn Hải Vân', 'Tuyến ven rừng',
			ST_GeogFromText('LINESTRING(108.1 16.1,108.2 16.2)'), 3500, 'moderate', 240, 'active')`,
			[route, host]
		);
	}, 120000);

	beforeEach(async () => {
		emit.mockClear().mockResolvedValue(undefined);
		await db.query("DELETE FROM in_app_notifications WHERE recipient_id = ANY($1::uuid[])", [
			[host, admin, camper, suspended],
		]);
		await db.query("UPDATE users SET status = 'active' WHERE id = $1", [admin]);
		await db.query("UPDATE user_roles SET role = 'admin' WHERE user_id = $1", [admin]);
		trip = randomUUID();
		tripIds.push(trip);
		await db.query(
			`INSERT INTO trips(id, host_id, route_id, title, trip_type, duration_nights,
			starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, price_per_person, status, updated_at)
			VALUES ($1, $2, $3, 'Khám phá đèo Hải Vân', 'day_trip', 0,
			'2027-01-01T01:00:00Z', '2027-01-01T10:00:00Z', ST_GeogFromText('POINT(108.1 16.1)'),
			'2026-12-30T01:00:00Z', 1, 30, 0, 'pending_approval', $4)`,
			[trip, host, route, round]
		);
	});

	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM in_app_notifications WHERE recipient_id = ANY($1::uuid[])", [
				[host, admin, camper, suspended],
			]);
			await db.query("DELETE FROM audit_logs WHERE target_id = ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM trip_waypoints WHERE trip_id = ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM trips WHERE id = ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM trekking_routes WHERE id = $1", [route]);
			await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
				[host, admin, camper, suspended],
			]);
		}
		await app?.close();
	});
	function enqueue(type = EventType.REVIEW_REQUESTED, roundAt = round) {
		return db.transaction((manager) =>
			service.enqueueTripReview(manager, trip, type, roundAt, now)
		);
	}
	function get(path: string, user = admin) {
		return request(app.getHttpServer())
			.get(`/api/in-app-notifications${path}`)
			.set("Authorization", `Bearer ${jwt.sign({ sub: user, roles: [] })}`);
	}

	it("stores unread notices for active Admins only and isolates recipient inboxes", async () => {
		await enqueue();
		const rows: { recipient_id: string }[] = await db.query(
			"SELECT recipient_id FROM in_app_notifications"
		);
		expect(rows).toEqual([{ recipient_id: admin }]);
		const response = await get("").expect(200);
		expect(response.body.items[0]).toMatchObject({
			readAt: null,
			eventType: EventType.REVIEW_REQUESTED,
			target: { tripId: trip, title: "Khám phá đèo Hải Vân", action: "review" },
		});
		expect((await get("", camper).expect(200)).body.items).toEqual([]);
	});
	it("creates the Admin notification through the real stored-waypoint submit transaction", async () => {
		await db.query("UPDATE trips SET status = 'draft' WHERE id = $1", [trip]);
		await db.query(
			`INSERT INTO trip_waypoints(trip_id, type, name, location, day_number, sequence_order, planned_at)
			VALUES ($1, 'start', 'Điểm xuất phát', ST_GeogFromText('POINT(108.1 16.1)'), 1, 1, '2027-01-01T01:00:00Z'),
			($1, 'finish', 'Điểm kết thúc', ST_GeogFromText('POINT(108.2 16.2)'), 1, 2, '2027-01-01T10:00:00Z')`,
			[trip]
		);
		await trips.submitForApproval(host, trip, {});
		await trips.submitForApproval(host, trip, {});
		// A mutable updatedAt must not change the identity of the submission event.
		await enqueue(EventType.REVIEW_REQUESTED, "2026-11-20T00:00:00Z");
		const response = await get("").expect(200);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			eventType: EventType.REVIEW_REQUESTED,
			target: { tripId: trip },
		});
		await db.query("UPDATE trips SET status = 'draft' WHERE id = $1", [trip]);
		await trips.submitForApproval(host, trip, {});
		expect((await get("")).body.items).toHaveLength(2);
		await db.query("UPDATE trips SET status = 'draft' WHERE id <> $1 AND id = ANY($2::uuid[])", [
			trip,
			tripIds,
		]);
		const clock = new Date(Date.now() + (23 * 60 + 10) * 60_000);
		await trips.processPendingReviewDeadlines(clock);
		await db.query("UPDATE trips SET updated_at = updated_at + interval '1 minute' WHERE id = $1", [
			trip,
		]);
		await trips.processPendingReviewDeadlines(clock);
		const reminders: { id: string }[] = await db.query(
			"SELECT id FROM audit_logs WHERE target_id = $1 AND action = 'trip.review.reminder_sent'",
			[trip]
		);
		expect(reminders).toHaveLength(1);
	});
	it("creates the Admin notification through configureWaypoints without duplicating repeated submissions", async () => {
		await db.query("UPDATE trips SET status = 'draft' WHERE id = $1", [trip]);
		const dto = {
			waypoints: [
				{
					type: WaypointType.START,
					name: "Điểm xuất phát",
					location: { type: "Point" as const, coordinates: [108.1, 16.1] as [number, number] },
					dayNumber: 1,
					sequenceOrder: 1,
					plannedAt: "2027-01-01T01:00:00Z",
				},
				{
					type: WaypointType.FINISH,
					name: "Điểm kết thúc",
					location: { type: "Point" as const, coordinates: [108.2, 16.2] as [number, number] },
					dayNumber: 1,
					sequenceOrder: 2,
					plannedAt: "2027-01-01T10:00:00Z",
				},
			],
		};
		await trips.configureWaypoints(host, trip, dto);
		await trips.configureWaypoints(host, trip, dto);
		expect((await get("")).body.items).toHaveLength(1);
	});
	it("does not expose or deliver uncommitted/rolled-back notices", async () => {
		await expect(
			db.transaction(async (manager) => {
				await service.enqueueTripReview(manager, trip, EventType.REVIEW_REQUESTED, round, now);
				expect((await get("").expect(200)).body.items).toEqual([]);
				await worker.runOnce();
				expect(emit).not.toHaveBeenCalled();
				throw new Error("rollback");
			})
		).rejects.toThrow("rollback");
		expect((await get("").expect(200)).body.items).toEqual([]);
	});
	it("deduplicates concurrent retries but permits a new approval round", async () => {
		await Promise.all([enqueue(), enqueue(), enqueue()]);
		expect((await get("").expect(200)).body.items).toHaveLength(1);
		await enqueue(EventType.REVIEW_REQUESTED, "2026-11-18T00:00:00Z");
		expect((await get("").expect(200)).body.items).toHaveLength(2);
	});
	it("marks read idempotently, updates count, and returns the same 404 for foreign/missing ids", async () => {
		await enqueue();
		const id: string = (await get("").expect(200)).body.items[0].id;
		const mark = (user: string, noticeId = id) =>
			request(app.getHttpServer())
				.patch(`/api/in-app-notifications/${noticeId}/read`)
				.set("Authorization", `Bearer ${jwt.sign({ sub: user, roles: [] })}`);
		expect((await get("/unread-count")).body).toEqual({ unreadCount: 1 });
		await mark(admin).expect(204);
		const first = (await get("")).body.items[0].readAt;
		await mark(admin).expect(204);
		expect((await get("")).body.items[0].readAt).toBe(first);
		expect((await get("/unread-count")).body).toEqual({ unreadCount: 0 });
		expect((await get("?state=unread")).body.items).toEqual([]);
		const foreign = await mark(camper).expect(404);
		const missing = await mark(camper, randomUUID()).expect(404);
		expect(foreign.body).toEqual(missing.body);
	});
	it("redacts a target after Admin permission is revoked and suppresses realtime delivery", async () => {
		await enqueue();
		await db.query("UPDATE user_roles SET role = 'camper' WHERE user_id = $1", [admin]);
		const response = await get("").expect(200);
		expect(response.body.items[0]).toMatchObject({ target: null, targetAvailable: false });
		expect(JSON.stringify(response.body)).not.toContain(trip);
		await worker.runOnce();
		expect(emit).not.toHaveBeenCalled();
	});
	it("delivers after commit and retries a failed transport without duplicating inbox rows", async () => {
		await enqueue();
		emit.mockRejectedValueOnce(new Error("transport unavailable"));
		await worker.runOnce();
		expect(
			(await db.query("SELECT delivered_at FROM in_app_notifications"))[0].delivered_at
		).toBeNull();
		await worker.runOnce();
		expect(emit).toHaveBeenCalledTimes(2);
		expect(emit.mock.calls[0][1].id).toBe(emit.mock.calls[1][1].id);
		expect((await get("")).body.items).toHaveLength(1);
	});
	it("coordinates competing delivery workers with row locks", async () => {
		await enqueue();
		const second = new InAppNotificationDeliveryWorker(db, service, {
			emitInAppNotification: emit,
		} as unknown as EventsGateway);
		await Promise.all([worker.runOnce(), second.runOnce()]);
		expect(emit).toHaveBeenCalledTimes(1);
		expect(emit.mock.calls[0][0]).toBe(admin);
	});
	it("runs concurrent reminder ticks once and permits reminders in the next review round", async () => {
		// Exclude older fixtures from this worker's candidate set.
		await db.query("UPDATE trips SET status = 'draft' WHERE id <> $1 AND id = ANY($2::uuid[])", [
			trip,
			tripIds,
		]);
		await Promise.all([
			trips.processPendingReviewDeadlines(now),
			trips.processPendingReviewDeadlines(now),
		]);
		expect(
			(await get("")).body.items.filter(
				(n: { eventType: string }) => n.eventType === EventType.REVIEW_REMINDER
			)
		).toHaveLength(1);
		await db.query("UPDATE trips SET updated_at = $2 WHERE id = $1", [
			trip,
			"2026-11-19T00:00:00Z",
		]);
		await trips.processPendingReviewDeadlines(new Date("2026-11-19T23:10:00Z"));
		expect((await get("")).body.items).toHaveLength(2);
	});
	it("auto-rejection transaction creates one notice for the owning Host only", async () => {
		await db.query("UPDATE trips SET status = 'draft' WHERE id <> $1 AND id = ANY($2::uuid[])", [
			trip,
			tripIds,
		]);
		await trips.processPendingReviewDeadlines(new Date("2026-11-18T01:00:00Z"));
		const response = await get("", host).expect(200);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			eventType: EventType.AUTO_REJECTED,
			target: { tripId: trip, action: "view" },
		});
		expect((await get("")).body.items).toHaveLength(0);
		await trips.processPendingReviewDeadlines(new Date("2026-11-18T01:01:00Z"));
		expect((await get("", host)).body.items).toHaveLength(1);
	});
	it("paginates without losing rows that differ only by microseconds", async () => {
		for (let index = 0; index < 3; index += 1) {
			await enqueue(EventType.REVIEW_REQUESTED, `2026-11-${20 + index}T00:00:00Z`);
		}
		await db.query(`WITH ranked AS (SELECT id, row_number() OVER (ORDER BY id) AS n FROM in_app_notifications)
			UPDATE in_app_notifications a SET created_at = '2026-11-17T00:00:00.123000Z'::timestamptz + ranked.n * interval '1 microsecond'
			FROM ranked WHERE a.id = ranked.id`);
		const ids: string[] = [];
		let cursor: string | null = null;
		do {
			const response = await get(`?limit=1${cursor ? `&cursor=${cursor}` : ""}`).expect(200);
			ids.push(response.body.items[0].id);
			cursor = response.body.nextCursor;
		} while (cursor);
		expect(new Set(ids).size).toBe(3);
	});
	it("requires authentication and rejects invalid pagination", async () => {
		await request(app.getHttpServer()).get("/api/in-app-notifications").expect(401);
		await get("?limit=101").expect(400);
		await get("?cursor=invalid").expect(422);
	});
	it("retains safe metadata but removes a deleted Trip target", async () => {
		await enqueue();
		await db.query("DELETE FROM trips WHERE id = $1", [trip]);
		const response = await get("").expect(200);
		expect(response.body.items[0]).toMatchObject({
			target: null,
			targetAvailable: false,
			readAt: null,
		});
		await worker.runOnce();
		expect(emit).not.toHaveBeenCalled();
	});
	it("suppresses delivery and denies HTTP after the recipient is suspended", async () => {
		await enqueue();
		await db.query("UPDATE users SET status = 'suspended' WHERE id = $1", [admin]);
		await get("").expect(401);
		await worker.runOnce();
		expect(emit).not.toHaveBeenCalled();
	});
	it("delivers a safe invalidation through real sockets only to the intended recipient", async () => {
		deliverySpy.mockRestore();
		await app.listen(0, "127.0.0.1");
		const url = await app.getUrl();
		const clients: Socket[] = [];
		async function connect(userId: string): Promise<Socket> {
			const client = io(url, {
				autoConnect: false,
				transports: ["websocket"],
				reconnection: false,
				auth: { token: jwt.sign({ sub: userId, roles: [] }) },
			});
			clients.push(client);
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error("Socket authentication timed out")), 5000);
				client.once("connected", () => {
					clearTimeout(timer);
					resolve();
				});
				client.once("connect_error", (error) => {
					clearTimeout(timer);
					reject(error);
				});
				client.connect();
			});
			return client;
		}
		try {
			const recipient = await connect(admin);
			const unrelated = await connect(camper);
			const unrelatedEvent = jest.fn();
			unrelated.on("notification.created", unrelatedEvent);
			await enqueue();
			const notificationId: string = (await get("")).body.items[0].id;
			const received = new Promise<{ event: unknown; meta: { eventId: string } }>(
				(resolve, reject) => {
					const timer = setTimeout(() => reject(new Error("Notification timed out")), 5000);
					recipient.once("notification.created", (event: unknown, meta: { eventId: string }) => {
						clearTimeout(timer);
						resolve({ event, meta });
					});
				}
			);
			await worker.runOnce();
			const result = await received;
			expect(result.event).toEqual({ notificationId, occurredAt: now.toISOString() });
			expect(result.meta.eventId).toBe(notificationId);
			expect(unrelatedEvent).not.toHaveBeenCalled();
		} finally {
			for (const client of clients) client.disconnect();
			deliverySpy = jest.spyOn(gateway, "emitInAppNotification").mockImplementation(emit);
		}
	});
});
