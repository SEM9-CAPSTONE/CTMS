import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PushNotificationsService } from "../src/modules/push-notifications/push-notifications.service";
import {
	PUSH_SENDER,
	type PushMessage,
	type PushSendResult,
	type PushSender,
} from "../src/modules/push-notifications/push-notifications.types";
import { EventsGateway } from "../src/modules/realtime/events.gateway";
import { TripsService } from "../src/modules/trips/services/trips.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface PushRow {
	recipientId: string;
	category: string;
	mandatory: boolean;
	status: string;
	skipReason: string | null;
	attempts: number;
	title: string;
	data: Record<string, string>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Records every push instead of calling Firebase; per-token outcomes can be scripted. */
class FakePushSender implements PushSender {
	readonly configured = true;
	readonly sent: PushMessage[] = [];
	outcome: (message: PushMessage) => PushSendResult = () => ({ ok: true });

	async send(message: PushMessage): Promise<PushSendResult> {
		const result = this.outcome(message);
		if (result.ok) this.sent.push(message);
		return result;
	}
}

describe("Background push notifications (CTMS-090, BR-273/BR-194/BR-195/BR-196/BR-197/BR-198, integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let gateway: EventsGateway;
	let pushes: PushNotificationsService;
	let tripsService: TripsService;
	const sender = new FakePushSender();
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];

	let host: Account;
	let camper: Account;
	let otherCamper: Account;
	let porter: Account;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(PUSH_SENDER)
			.useValue(sender)
			.compile();
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
		gateway = moduleRef.get(EventsGateway);
		pushes = moduleRef.get(PushNotificationsService);
		tripsService = moduleRef.get(TripsService);
		await assertSafeTestDatabase(dataSource);

		host = await createAccount(UserRole.HOST);
		camper = await createAccount(UserRole.CAMPER);
		otherCamper = await createAccount(UserRole.CAMPER);
		porter = await createAccount(UserRole.PORTER);
	}, 60_000);

	beforeEach(() => {
		sender.sent.length = 0;
		sender.outcome = () => ({ ok: true });
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await gateway.flushPublished();
			const bookingIds = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
			await dataSource.query(
				`DELETE FROM "booking_members" WHERE "booking_id" IN (${bookingIds})`,
				[tripIds]
			);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query(
				`DELETE FROM "realtime_events" WHERE "user_ids" && $1::uuid[] OR "trip_id" = ANY($2::uuid[])`,
				[userIds, tripIds]
			);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			// push_devices / push_notifications rows go with their users (ON DELETE CASCADE).
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Push user')`,
			[id, `push-ctms90-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(title: string, startsInDays = 10): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Push route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		const startsAt = new Date(Date.now() + startsInDays * DAY_MS);
		startsAt.setUTCHours(1, 0, 0, 0);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, $4, 'day_trip', 0, $5, $6,
			   ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $7, 1, 20, 0, 0, 'published')`,
			[
				tripId,
				host.id,
				routeId,
				title,
				startsAt,
				new Date(startsAt.getTime() + 9 * HOUR_MS),
				new Date(startsAt.getTime() - 2 * DAY_MS),
			]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function book(account: Account, tripId: string, memberStatus = "registered") {
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status", "payment_status")
			 VALUES ($1, $2, $3, 1, 0, 'confirmed', 'not_required')`,
			[bookingId, tripId, account.id]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" ("id", "booking_id", "user_id", "is_primary", "member_status")
			 VALUES ($1, $2, $3, true, $4)`,
			[randomUUID(), bookingId, account.id, memberStatus]
		);
		await dataSource.query(`UPDATE "trips" SET "seats_taken" = "seats_taken" + 1 WHERE "id" = $1`, [
			tripId,
		]);
		return bookingId;
	}

	const api = () => request(app.getHttpServer());

	function registerDevice(account: Account, token: string, platform = "android") {
		return api()
			.put("/api/me/push-devices")
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send({ token, platform });
	}

	async function pushesFor(recipientId: string, type?: string): Promise<PushRow[]> {
		await gateway.flushPublished();
		return dataSource.query(
			`SELECT "recipient_id" AS "recipientId", "category", "mandatory", "status",
			        "skip_reason" AS "skipReason", "attempts", "title", "data"
			 FROM "push_notifications"
			 WHERE "recipient_id" = $1 AND ($2::text IS NULL OR "data"->>'type' = $2)
			 ORDER BY "created_at"`,
			[recipientId, type ?? null]
		);
	}

	/** Runs delivery passes until nothing is due (the worker is off in integration tests). */
	async function deliver(now = new Date()) {
		await gateway.flushPublished();
		let report = await pushes.deliverDue(now, 200);
		while (report.claimed > 0) report = await pushes.deliverDue(now, 200);
	}

	describe("device registration", () => {
		it("registers, moves a shared token to the signed-in account and removes it on sign-out", async () => {
			const token = `fcm-${randomUUID()}`;
			await registerDevice(otherCamper, token).expect(200);
			const moved = await registerDevice(camper, token, "ios").expect(200);
			expect(moved.body).toEqual({ id: expect.any(String), platform: "ios" });
			const owners = await dataSource.query(
				`SELECT "user_id" AS "userId" FROM "push_devices" WHERE "token" = $1`,
				[token]
			);
			expect(owners).toEqual([{ userId: camper.id }]);

			await api()
				.delete("/api/me/push-devices")
				.set("Authorization", `Bearer ${otherCamper.accessToken}`)
				.send({ token })
				.expect(404);
			await api()
				.delete("/api/me/push-devices")
				.set("Authorization", `Bearer ${camper.accessToken}`)
				.send({ token })
				.expect(204);
		});

		it("rejects anonymous calls and invalid payloads", async () => {
			await api().put("/api/me/push-devices").send({ token: "x", platform: "android" }).expect(401);
			const invalid = await registerDevice(camper, "x", "windows");
			expect([400, 422]).toContain(invalid.status);
		});
	});

	it("pushes a Booking update after a Host reschedule (AC-1), once even if processed again (AC-5)", async () => {
		await registerDevice(camper, `fcm-camper-${randomUUID()}`).expect(200);
		const tripId = await createTrip("Push đổi lịch");
		const bookingId = await book(camper, tripId);
		const startsAt = new Date(Date.now() + 14 * DAY_MS);
		startsAt.setUTCHours(1, 0, 0, 0);

		await tripsService.reschedule(host.id, tripId, {
			startsAt: startsAt.toISOString(),
			endsAt: new Date(startsAt.getTime() + 9 * HOUR_MS).toISOString(),
		});
		const queued = await pushesFor(camper.id, "booking.updated");
		expect(queued).toEqual([
			expect.objectContaining({
				category: "booking",
				status: "pending",
				title: "Chuyến đi đã đổi lịch",
				data: expect.objectContaining({ bookingId, status: "pending_reconfirmation", tripId }),
			}),
		]);

		// The same change processed again (retried job, second publish) adds nothing.
		const event = queued[0].data.eventId;
		gateway.emitBookingUpdated(camper.id, {
			eventId: event,
			bookingId,
			tripId,
			tripTitle: "Push đổi lịch",
			status: "pending_reconfirmation",
			updatedAt: new Date().toISOString(),
		});
		expect(await pushesFor(camper.id, "booking.updated")).toHaveLength(1);

		await deliver();
		expect(await pushesFor(camper.id, "booking.updated")).toEqual([
			expect.objectContaining({ status: "sent", attempts: 1 }),
		]);
		expect(sender.sent.filter((message) => message.data.bookingId === bookingId)).toHaveLength(1);
		await deliver();
		expect(sender.sent.filter((message) => message.data.bookingId === bookingId)).toHaveLength(1);
	});

	it("pushes a Booking cancellation to every owner when the Host cancels the Trip", async () => {
		const tripId = await createTrip("Push huỷ chuyến");
		await book(camper, tripId);
		await book(otherCamper, tripId);
		await tripsService.cancel(host.id, tripId, { reason: "Đường bị sạt lở" });

		for (const account of [camper, otherCamper]) {
			const rows = (await pushesFor(account.id, "booking.updated")).filter(
				(row) => row.data.tripId === tripId
			);
			expect(rows).toEqual([expect.objectContaining({ title: "Đơn đặt chỗ đã bị huỷ" })]);
		}
	});

	it("pushes a new Porter request to the Porter (AC-2)", async () => {
		await registerDevice(porter, `fcm-porter-${randomUUID()}`).expect(200);
		const tripId = await createTrip("Push porter");
		gateway.emitPorterRequestCreated({
			requestId: randomUUID(),
			tripId,
			porterId: porter.id,
			requestedBy: host.id,
			requestedRole: "guide",
			expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
		});
		await deliver();
		expect(await pushesFor(porter.id, "porter.request.created")).toEqual([
			expect.objectContaining({ category: "porter_assignment", status: "sent" }),
		]);
		expect(await pushesFor(host.id, "porter.request.created")).toEqual([]);
	});

	it("delivers a Red weather alert to each eligible recipient independently and skips a Camper who left (AC-3)", async () => {
		await registerDevice(host, `fcm-host-${randomUUID()}`).expect(200);
		await registerDevice(camper, `fcm-camper-${randomUUID()}`).expect(200);
		await registerDevice(otherCamper, `fcm-other-${randomUUID()}`).expect(200);
		const tripId = await createTrip("Push thời tiết", 2);
		await book(camper, tripId, "joined");
		await book(otherCamper, tripId, "left");
		gateway.emitTripWeatherChanged([host.id, camper.id, otherCamper.id], {
			eventId: randomUUID(),
			tripId,
			tripTitle: "Push thời tiết",
			tripStartsAt: new Date().toISOString(),
			previousRiskLevel: "yellow",
			riskLevel: "red",
			createdAt: new Date().toISOString(),
		});
		await deliver();

		const forTrip = async (account: Account) =>
			(await pushesFor(account.id, "trip.weather.changed")).filter(
				(row) => row.data.tripId === tripId
			);
		expect(await forTrip(host)).toEqual([
			expect.objectContaining({ category: "weather", mandatory: true, status: "sent" }),
		]);
		expect(await forTrip(camper)).toEqual([expect.objectContaining({ status: "sent" })]);
		// AC-5 / PB AC-6: no longer in the Trip team → the event is not exposed.
		expect(await forTrip(otherCamper)).toEqual([
			expect.objectContaining({ status: "skipped", skipReason: "not_eligible" }),
		]);
	});

	it("sends an SOS as a high-priority push to the Host (AC-3)", async () => {
		await registerDevice(host, `fcm-host-${randomUUID()}`).expect(200);
		const tripId = await createTrip("Push SOS", 0);
		const sosId = randomUUID();
		gateway.emitSosCreated(host.id, {
			eventId: sosId,
			sosId,
			tripId,
			senderId: camper.id,
			emergencyType: "injury",
			status: "active",
			eventTime: new Date().toISOString(),
			persistedAt: new Date().toISOString(),
		});
		await deliver();
		expect((await pushesFor(host.id, "sos.created")).at(-1)).toEqual(
			expect.objectContaining({ category: "sos", mandatory: true, status: "sent" })
		);
		expect(sender.sent.find((message) => message.data.sosId === sosId)?.highPriority).toBe(true);
	});

	it("records a provider failure for a later bounded retry, never as sent (BR-197/BR-198)", async () => {
		const outsider = await createAccount(UserRole.CAMPER);
		await registerDevice(outsider, `fcm-outsider-${randomUUID()}`).expect(200);
		sender.outcome = () => ({
			ok: false,
			unregistered: false,
			retryable: true,
			error: "FCM 503 UNAVAILABLE",
		});
		const tripId = await createTrip("Push lỗi");
		gateway.emitBookingUpdated(outsider.id, {
			eventId: randomUUID(),
			bookingId: randomUUID(),
			tripId,
			tripTitle: "Push lỗi",
			status: "confirmed",
			updatedAt: new Date().toISOString(),
		});
		const now = new Date();
		await deliver(now);
		const [failed] = await pushesFor(outsider.id);
		expect(failed).toEqual(expect.objectContaining({ status: "pending", attempts: 1 }));
		const [{ nextAttemptAt, lastError }] = await dataSource.query(
			`SELECT "next_attempt_at" AS "nextAttemptAt", "last_error" AS "lastError"
			 FROM "push_notifications" WHERE "recipient_id" = $1`,
			[outsider.id]
		);
		expect(new Date(nextAttemptAt).getTime()).toBeGreaterThanOrEqual(now.getTime() + 60_000);
		expect(lastError).toBe("FCM 503 UNAVAILABLE");

		// Once the provider recovers, the retry delivers it exactly once.
		sender.outcome = () => ({ ok: true });
		await deliver(new Date(now.getTime() + 2 * 60_000));
		expect((await pushesFor(outsider.id))[0]).toEqual(
			expect.objectContaining({ status: "sent", attempts: 2 })
		);
	});

	it("skips a recipient without a device and disables a token the app no longer owns", async () => {
		const lonely = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip("Push không thiết bị");
		gateway.emitBookingUpdated(lonely.id, {
			eventId: randomUUID(),
			bookingId: randomUUID(),
			tripId,
			tripTitle: "Push không thiết bị",
			status: "expired",
			updatedAt: new Date().toISOString(),
		});
		await deliver();
		expect(await pushesFor(lonely.id)).toEqual([
			expect.objectContaining({ status: "skipped", skipReason: "no_device" }),
		]);

		const token = `fcm-dead-${randomUUID()}`;
		await registerDevice(lonely, token).expect(200);
		sender.outcome = () => ({ ok: false, unregistered: true, error: "FCM 404 UNREGISTERED" });
		gateway.emitBookingUpdated(lonely.id, {
			eventId: randomUUID(),
			bookingId: randomUUID(),
			tripId,
			tripTitle: "Push không thiết bị",
			status: "confirmed",
			updatedAt: new Date().toISOString(),
		});
		await deliver();
		const [{ disabledAt }] = await dataSource.query(
			`SELECT "disabled_at" AS "disabledAt" FROM "push_devices" WHERE "token" = $1`,
			[token]
		);
		expect(disabledAt).not.toBeNull();
	});
});
