import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { GpsTrackingIneligibleReason } from "../src/modules/gps-tracking/gps-tracking.enums";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import {
	SafetyEventIngestStatus,
	SafetyEventRejectionReason,
	SafetyEventType,
} from "../src/modules/safety-events/safety-events.enums";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;

describe("Route-deviation safety events (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

	let host: Account;
	let joinedCamper: Account;
	let otherJoinedCamper: Account;
	let assignedPorter: Account;
	let outsider: Account;
	let routeId: string;
	let routeVersion: string;
	let ongoingTripId: string;
	let publishedTripId: string;
	let otherRouteTripId: string;
	let tripStart: Date;

	beforeAll(async () => {
		jest.setTimeout(60_000);
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
		await assertSafeTestDatabase(dataSource);
		await createFixture();
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (tripIds.length > 0) {
				await dataSource.query(
					`DELETE FROM "audit_logs" WHERE "target_type" = 'safety_event'
					 AND "target_id" IN (SELECT "id" FROM "safety_events" WHERE "trip_id" = ANY($1))`,
					[tripIds]
				);
				await dataSource.query('DELETE FROM "safety_events" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
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
				`safety-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Safety ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(endLongitude: number): Promise<string> {
		const id = randomUUID();
		routeIds.push(id);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'Safety route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint($3, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			 )`,
			[id, host.id, endLongitude, TrekkingRouteStatus.ACTIVE]
		);
		return id;
	}

	async function createTrip(tripRouteId: string, status: TripStatus): Promise<string> {
		const tripId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'Safety Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 0, 0, $5
			 )`,
			[tripId, host.id, tripRouteId, tripStart, status]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function addJoinedCamper(tripId: string, camperId: string) {
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount"
			 ) VALUES ($1, $2, $3, 1, $4, 'not_required', now(), now() + interval '8 hours', 0, 0)`,
			[bookingId, tripId, camperId, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at", "status_updated_by"
			 ) VALUES ($1, $2, $3, true, $4, $5, $6)`,
			[
				randomUUID(),
				bookingId,
				camperId,
				BookingMemberStatus.JOINED,
				new Date(tripStart.getTime() - HOUR_MS / 2),
				host.id,
			]
		);
		bookingIds.push(bookingId);
	}

	async function createFixture(): Promise<void> {
		host = await createAccount(UserRole.HOST, "host");
		joinedCamper = await createAccount(UserRole.CAMPER, "joined");
		otherJoinedCamper = await createAccount(UserRole.CAMPER, "other-joined");
		assignedPorter = await createAccount(UserRole.PORTER, "assigned-porter");
		outsider = await createAccount(UserRole.CAMPER, "outsider");

		routeId = await createRoute(108.25);
		const otherRouteId = await createRoute(108.3);
		tripStart = new Date(Date.now() - 2 * HOUR_MS);
		ongoingTripId = await createTrip(routeId, TripStatus.ONGOING);
		publishedTripId = await createTrip(routeId, TripStatus.PUBLISHED);
		otherRouteTripId = await createTrip(otherRouteId, TripStatus.ONGOING);

		for (const tripId of [ongoingTripId, publishedTripId, otherRouteTripId]) {
			await addJoinedCamper(tripId, joinedCamper.id);
		}
		await addJoinedCamper(ongoingTripId, otherJoinedCamper.id);
		await dataSource.query(
			`INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3)`,
			[ongoingTripId, assignedPorter.id, TripPorterStatus.ASSIGNED]
		);

		const context = await getContext(joinedCamper, ongoingTripId).expect(200);
		routeVersion = context.body.routeVersion;
	}

	function offRouteEvent(overrides: Record<string, unknown> = {}) {
		return {
			id: randomUUID(),
			eventType: SafetyEventType.OFF_ROUTE,
			eventTime: new Date(tripStart.getTime() + HOUR_MS).toISOString(),
			latitude: 16.054321,
			longitude: 108.234567,
			accuracyMeters: 7.5,
			distanceToRouteMeters: 65.2,
			consecutiveValidSamples: 3,
			detectedOffline: true,
			routeVersion,
			packageVersion: "pkg-2026.10.1",
			configVersion: "v3",
			...overrides,
		};
	}

	function getContext(account: Account, tripId: string) {
		return request(app.getHttpServer())
			.get(`/api/trips/${tripId}/route-deviation/context`)
			.set("Authorization", `Bearer ${account.accessToken}`);
	}

	function postEvents(account: Account, tripId: string, events: unknown[]) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/safety-events`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send({ events });
	}

	async function countEvents(id: string): Promise<number> {
		const rows = (await dataSource.query(
			'SELECT count(*)::int AS "count" FROM "safety_events" WHERE "id" = $1',
			[id]
		)) as Array<{ count: number }>;
		return rows[0].count;
	}

	describe("GET /trips/:tripId/route-deviation/context (BR-238)", () => {
		it("returns the Trip's Route geometry, a stable version and the fixed V3 thresholds", async () => {
			const response = await getContext(joinedCamper, ongoingTripId).expect(200);

			expect(response.body).toEqual({
				tripId: ongoingTripId,
				eligible: true,
				reason: null,
				participantRole: "camper",
				routeId,
				routeVersion: expect.stringMatching(/^[0-9a-f]{32}$/),
				geometry: {
					type: "LineString",
					coordinates: [
						[108.22, 16.04],
						[108.25, 16.07],
					],
				},
				thresholds: {
					validSampleMaxAccuracyMeters: 20,
					offRouteMinDistanceMeters: 50,
					onRouteMaxDistanceMeters: 20,
					consecutiveSamples: 3,
					gpsDegradedAfterSeconds: 120,
				},
				configVersion: "v3",
			});
			const again = await getContext(assignedPorter, ongoingTripId).expect(200);
			expect(again.body).toMatchObject({ participantRole: "porter", routeVersion });
		});

		it("identifies a different Route geometry with a different version", async () => {
			const response = await getContext(joinedCamper, otherRouteTripId).expect(200);
			expect(response.body.routeVersion).not.toBe(routeVersion);
		});

		it("reports a Trip that is not ongoing as ineligible", async () => {
			const response = await getContext(joinedCamper, publishedTripId).expect(200);
			expect(response.body).toMatchObject({
				eligible: false,
				reason: GpsTrackingIneligibleReason.TRIP_NOT_ONGOING,
			});
		});

		it("denies non-participants, other roles and unknown Trips", async () => {
			await getContext(outsider, ongoingTripId).expect(403);
			await getContext(host, ongoingTripId).expect(403);
			await getContext(joinedCamper, randomUUID()).expect(404);
			await request(app.getHttpServer())
				.get(`/api/trips/${ongoingTripId}/route-deviation/context`)
				.expect(401);
		});
	});

	describe("POST /trips/:tripId/safety-events", () => {
		it("stores an offline OFF_ROUTE with its original client context, server Route and an audit entry", async () => {
			const event = offRouteEvent({
				eventTime: new Date(tripStart.getTime() + HOUR_MS).toISOString().replace("Z", "+00:00"),
			});

			const response = await postEvents(joinedCamper, ongoingTripId, [event]).expect(200);
			expect(response.body).toEqual({
				results: [{ id: event.id, status: SafetyEventIngestStatus.ACCEPTED, reason: null }],
			});

			const [row] = (await dataSource.query(
				`SELECT "user_id" AS "userId", "participant_role" AS "participantRole",
				        "event_type" AS "eventType", "event_time" AS "eventTime",
				        ST_Y("location"::geometry) AS "latitude", ST_X("location"::geometry) AS "longitude",
				        "accuracy_meters" AS "accuracyMeters", "distance_to_route_meters" AS "distance",
				        "consecutive_valid_samples" AS "samples", "detected_offline" AS "detectedOffline",
				        "route_id" AS "routeId", "route_version" AS "routeVersion",
				        "package_version" AS "packageVersion", "config_version" AS "configVersion",
				        "received_at" AS "receivedAt"
				 FROM "safety_events" WHERE "id" = $1`,
				[event.id]
			)) as Array<Record<string, unknown>>;
			expect(row).toMatchObject({
				userId: joinedCamper.id,
				participantRole: "camper",
				eventType: "OFF_ROUTE",
				latitude: 16.054321,
				longitude: 108.234567,
				accuracyMeters: 7.5,
				distance: 65.2,
				samples: 3,
				detectedOffline: true,
				routeId,
				routeVersion,
				packageVersion: "pkg-2026.10.1",
				configVersion: "v3",
			});
			expect((row.eventTime as Date).getTime()).toBe(tripStart.getTime() + HOUR_MS);
			expect((row.receivedAt as Date).getTime()).toBeGreaterThan((row.eventTime as Date).getTime());

			const audits = (await dataSource.query(
				`SELECT "actor_id" AS "actorId", "action", "after" FROM "audit_logs"
				 WHERE "target_type" = 'safety_event' AND "target_id" = $1`,
				[event.id]
			)) as Array<{ actorId: string; action: string; after: Record<string, unknown> }>;
			expect(audits).toHaveLength(1);
			expect(audits[0]).toMatchObject({
				actorId: joinedCamper.id,
				action: "safety_event.received",
				after: { tripId: ongoingTripId, eventType: "OFF_ROUTE", routeId, detectedOffline: true },
			});
		});

		it("accepts recovery and GPS-quality transitions from a Camper and an assigned Porter", async () => {
			const base = tripStart.getTime() + 2 * HOUR_MS;
			const recovered = offRouteEvent({
				eventType: SafetyEventType.ON_ROUTE_RECOVERED,
				distanceToRouteMeters: 12,
			});
			const degraded = {
				id: randomUUID(),
				eventType: SafetyEventType.GPS_DEGRADED,
				eventTime: new Date(base).toISOString(),
				noValidSampleSince: new Date(base - 125_000).toISOString(),
				detectedOffline: true,
				routeVersion,
				configVersion: "v3",
			};
			const restored = offRouteEvent({
				eventType: SafetyEventType.GPS_RESTORED,
				eventTime: new Date(base + 60_000).toISOString(),
				distanceToRouteMeters: undefined,
				consecutiveValidSamples: undefined,
			});

			const camperResponse = await postEvents(joinedCamper, ongoingTripId, [
				recovered,
				degraded,
			]).expect(200);
			const porterResponse = await postEvents(assignedPorter, ongoingTripId, [restored]).expect(
				200
			);

			expect(
				[...camperResponse.body.results, ...porterResponse.body.results].map(
					(result: { status: string }) => result.status
				)
			).toEqual(["accepted", "accepted", "accepted"]);
			const [degradedRow] = (await dataSource.query(
				`SELECT "location", "accuracy_meters" AS "accuracy" FROM "safety_events" WHERE "id" = $1`,
				[degraded.id]
			)) as Array<{ location: unknown; accuracy: number | null }>;
			expect(degradedRow).toEqual({ location: null, accuracy: null });
		});

		it("treats a repeated UUID as duplicate and keeps the first stored context (BR-244)", async () => {
			const event = offRouteEvent();
			await postEvents(joinedCamper, ongoingTripId, [event]).expect(200);

			const retry = await postEvents(joinedCamper, ongoingTripId, [
				{ ...event, distanceToRouteMeters: 90 },
				event,
			]).expect(200);

			expect(retry.body.results).toEqual([
				{ id: event.id, status: SafetyEventIngestStatus.DUPLICATE, reason: null },
				{ id: event.id, status: SafetyEventIngestStatus.DUPLICATE, reason: null },
			]);
			expect(await countEvents(event.id)).toBe(1);
			const [row] = (await dataSource.query(
				`SELECT "distance_to_route_meters" AS "distance",
				        (SELECT count(*)::int FROM "audit_logs" WHERE "target_id" = $1) AS "audits"
				 FROM "safety_events" WHERE "id" = $1`,
				[event.id]
			)) as Array<{ distance: number; audits: number }>;
			expect(row).toEqual({ distance: 65.2, audits: 1 });
		});

		it("stores one row when the same event is uploaded concurrently", async () => {
			const event = offRouteEvent();
			const responses = await Promise.all(
				Array.from({ length: 5 }, () => postEvents(joinedCamper, ongoingTripId, [event]))
			);

			const statuses = responses.map((response) => response.body.results[0].status).sort();
			expect(statuses).toEqual(["accepted", "duplicate", "duplicate", "duplicate", "duplicate"]);
			expect(await countEvents(event.id)).toBe(1);
		});

		it("rejects a UUID that already belongs to another participant", async () => {
			const event = offRouteEvent();
			await postEvents(joinedCamper, ongoingTripId, [event]).expect(200);

			const response = await postEvents(otherJoinedCamper, ongoingTripId, [event]).expect(200);
			expect(response.body.results[0]).toMatchObject({
				status: SafetyEventIngestStatus.REJECTED,
				reason: SafetyEventRejectionReason.ID_CONFLICT,
			});
		});

		it("rejects events whose context does not support the transition, without blocking the rest", async () => {
			const valid = offRouteEvent();
			const response = await postEvents(joinedCamper, ongoingTripId, [
				offRouteEvent({ distanceToRouteMeters: 30 }),
				offRouteEvent({ consecutiveValidSamples: 2 }),
				offRouteEvent({ accuracyMeters: 25 }),
				offRouteEvent({ routeVersion: "f".repeat(32) }),
				offRouteEvent({ eventTime: new Date(tripStart.getTime() - HOUR_MS).toISOString() }),
				valid,
			]).expect(200);

			expect(
				response.body.results.map((result: { reason: string | null }) => result.reason)
			).toEqual([
				SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				SafetyEventRejectionReason.ROUTE_VERSION_MISMATCH,
				SafetyEventRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION,
				null,
			]);
			expect(await countEvents(valid.id)).toBe(1);
		});

		it("rejects events for a Trip that is not ongoing or completed", async () => {
			const response = await postEvents(joinedCamper, publishedTripId, [offRouteEvent()]).expect(
				200
			);
			expect(response.body.results[0].reason).toBe(SafetyEventRejectionReason.TRIP_NOT_TRACKABLE);
		});

		it("returns 422 for a malformed event and 403 for a non-participant", async () => {
			await postEvents(joinedCamper, ongoingTripId, [
				offRouteEvent({ distanceToRouteMeters: undefined }),
			]).expect(422);
			await postEvents(outsider, ongoingTripId, [offRouteEvent()]).expect(403);
		});

		it("enforces the V3 thresholds in the database even outside the API", async () => {
			await expect(
				dataSource.query(
					`INSERT INTO "safety_events" (
						"id", "trip_id", "user_id", "participant_role", "event_type", "event_time", "location",
						"accuracy_meters", "distance_to_route_meters", "consecutive_valid_samples",
						"route_id", "route_version", "config_version"
					 ) VALUES (
						$1, $2, $3, 'camper', 'OFF_ROUTE', now(),
						ST_SetSRID(ST_MakePoint(108.23, 16.05), 4326)::geography, 8, 40, 3, $4, $5, 'v3'
					 )`,
					[randomUUID(), ongoingTripId, joinedCamper.id, routeId, routeVersion]
				)
			).rejects.toThrow(/CHK_safety_events_off_route/);
		});

		it("counts accepted safety events in the server-confirmed device sync status", async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/trips/${ongoingTripId}/device-sync/status`)
				.set("Authorization", `Bearer ${assignedPorter.accessToken}`)
				.expect(200);
			expect(response.body.serverConfirmedSafetyCount).toBe(1);
			expect(response.body.lastReceivedAt).not.toBeNull();
		});
	});
});
