import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface Fixture {
	host: Account;
	otherHost: Account;
	assignedPorter: Account;
	pendingPorter: Account;
	unassignedPorter: Account;
	otherPorter: Account;
	camper: Account;
	admin: Account;
	tripId: string;
	otherTripId: string;
	otherTripBookingId: string;
	laterAssignedTripId: string;
}

describe("Trip operational roster reads (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let fixture: Fixture;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

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
		fixture = await createFixture();
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (bookingIds.length > 0)
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [tripIds]);
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = ANY($1)', [
					routeIds,
				]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (userIds.length > 0) {
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
				`trip-roster-${label}-${id}@example.com`,
				await hash("S3curePass!", 4),
				role,
				UserStatus.ACTIVE,
				`Roster ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(hostId: string, routeId: string, title: string, startsAt: Date) {
		const tripId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, $4, 'day_trip', 0, $5, $5::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				$5::timestamptz - interval '1 day', 1, 20, 0, 0, $6
			 )`,
			[tripId, hostId, routeId, title, startsAt, TripStatus.PUBLISHED]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function createBookingMember(
		tripId: string,
		ownerId: string,
		bookingStatus: BookingStatus,
		memberStatus: BookingMemberStatus,
		createdAt: Date,
		isPrimary = true
	) {
		const bookingId = randomUUID();
		const memberId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "status", "payment_status",
				"trip_starts_at_snapshot", "trip_ends_at_snapshot", "base_price", "total_amount", "created_at"
			 ) VALUES (
				$1, $2, $3, 1, $4, 'not_required',
				now(), now() + interval '8 hours', 0, 0, $5
			 )`,
			[bookingId, tripId, ownerId, bookingStatus, createdAt]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status",
				"checked_in_at", "no_show_at", "left_at", "status_updated_by", "created_at"
			 ) VALUES (
				$1, $2, $3, $4, $5::booking_member_status,
				CASE WHEN $5::booking_member_status = 'joined' THEN $6::timestamptz ELSE NULL END,
				CASE WHEN $5::booking_member_status = 'no_show' THEN $6::timestamptz ELSE NULL END,
				CASE WHEN $5::booking_member_status = 'left' THEN $6::timestamptz ELSE NULL END,
				CASE WHEN $5::booking_member_status IN ('joined', 'no_show', 'left') THEN $7::uuid ELSE NULL END,
				$6
			 )`,
			[
				memberId,
				bookingId,
				ownerId,
				isPrimary,
				memberStatus,
				createdAt,
				fixture?.host?.id ?? ownerId,
			]
		);
		bookingIds.push(bookingId);
		return { bookingId, memberId };
	}

	async function createFixture(): Promise<Fixture> {
		const host = await createAccount(UserRole.HOST, "host");
		const otherHost = await createAccount(UserRole.HOST, "other-host");
		const assignedPorter = await createAccount(UserRole.PORTER, "assigned-porter");
		const pendingPorter = await createAccount(UserRole.PORTER, "pending-porter");
		const unassignedPorter = await createAccount(UserRole.PORTER, "unassigned-porter");
		const otherPorter = await createAccount(UserRole.PORTER, "other-porter");
		const camper = await createAccount(UserRole.CAMPER, "camper");
		const admin = await createAccount(UserRole.ADMIN, "admin");
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'Trip roster route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $3
			 )`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		const start = new Date("2035-01-10T08:00:00.000Z");
		const tripId = await createTrip(host.id, routeId, "Roster primary Trip", start);
		const otherTripId = await createTrip(
			host.id,
			routeId,
			"Roster foreign Trip",
			new Date("2035-01-11T08:00:00.000Z")
		);
		const unassignedTripId = await createTrip(
			host.id,
			routeId,
			"Roster unassigned Trip",
			new Date("2035-01-12T08:00:00.000Z")
		);
		const laterAssignedTripId = await createTrip(
			host.id,
			routeId,
			"Roster later assigned Trip",
			new Date("2035-01-13T08:00:00.000Z")
		);

		for (const [targetTripId, porterId, status] of [
			[tripId, assignedPorter.id, TripPorterStatus.ASSIGNED],
			[tripId, pendingPorter.id, TripPorterStatus.PENDING_RECONFIRMATION],
			[tripId, unassignedPorter.id, TripPorterStatus.UNASSIGNED],
			[otherTripId, assignedPorter.id, TripPorterStatus.PENDING_RECONFIRMATION],
			[otherTripId, otherPorter.id, TripPorterStatus.ASSIGNED],
			[unassignedTripId, assignedPorter.id, TripPorterStatus.UNASSIGNED],
			[laterAssignedTripId, assignedPorter.id, TripPorterStatus.ASSIGNED],
		] as const) {
			await dataSource.query(
				'INSERT INTO "trip_porters" ("trip_id", "porter_id", "status") VALUES ($1, $2, $3)',
				[targetTripId, porterId, status]
			);
		}

		const base = new Date("2034-01-01T00:00:00.000Z");
		await createBookingMember(
			tripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.JOINED,
			base
		);
		await createBookingMember(
			tripId,
			camper.id,
			BookingStatus.PENDING_RECONFIRMATION,
			BookingMemberStatus.REGISTERED,
			new Date(base.getTime() + 1_000)
		);
		await createBookingMember(
			tripId,
			camper.id,
			BookingStatus.CANCELLED,
			BookingMemberStatus.NO_SHOW,
			new Date(base.getTime() + 2_000)
		);
		await createBookingMember(
			tripId,
			camper.id,
			BookingStatus.EXPIRED,
			BookingMemberStatus.REMOVED,
			new Date(base.getTime() + 3_000)
		);
		await createBookingMember(
			tripId,
			camper.id,
			BookingStatus.COMPLETED,
			BookingMemberStatus.LEFT,
			new Date(base.getTime() + 4_000)
		);
		const otherTripMember = await createBookingMember(
			otherTripId,
			camper.id,
			BookingStatus.CONFIRMED,
			BookingMemberStatus.REGISTERED,
			base
		);

		return {
			host,
			otherHost,
			assignedPorter,
			pendingPorter,
			unassignedPorter,
			otherPorter,
			camper,
			admin,
			tripId,
			otherTripId,
			otherTripBookingId: otherTripMember.bookingId,
			laterAssignedTripId,
		};
	}

	function rosterRequest(actor?: Account) {
		const call = request(app.getHttpServer()).get(`/api/trips/${fixture.tripId}/members`);
		return actor ? call.set("Authorization", `Bearer ${actor.accessToken}`) : call;
	}

	function operationsRequest(actor?: Account, tripId = fixture.tripId) {
		const call = request(app.getHttpServer()).get(`/api/trips/assigned/${tripId}`);
		return actor ? call.set("Authorization", `Bearer ${actor.accessToken}`) : call;
	}

	it("BR-160: returns only operational fields, current schedule, route and authorized members", async () => {
		const response = await operationsRequest(fixture.assignedPorter).expect(200);
		expect(response.headers["cache-control"]).toContain("no-store");
		expect(response.body).toMatchObject({
			tripId: fixture.tripId,
			assignmentStatus: "assigned",
			title: "Roster primary Trip",
			route: {
				name: "Trip roster route",
				status: "active",
				geometry: { type: "LineString" },
				checkpoints: [],
				dangerZones: [],
			},
			offlinePackage: { status: "unavailable", downloadedAt: null },
			weather: { availability: "unavailable", record: null },
		});
		expect(response.body.retrievedAt).toBeTruthy();
		expect(
			response.body.members.map((member: { memberStatus: string }) => member.memberStatus)
		).toEqual(["joined", "registered", "left"]);
		for (const member of response.body.members)
			expect(Object.keys(member).sort()).toEqual(["displayName", "memberId", "memberStatus"]);
		for (const key of [
			"hostId",
			"host",
			"pricePerPerson",
			"cancellationPolicy",
			"providerResponse",
			"email",
			"health",
			"emergency",
		])
			expect(response.body).not.toHaveProperty(key);
		expect(response.body.route).not.toHaveProperty("hostId");
	});

	it("BR-160: requires authentication and Porter role for operations", async () => {
		await operationsRequest().expect(401);
		for (const actor of [fixture.host, fixture.camper, fixture.admin])
			await operationsRequest(actor).expect(403);
	});

	it("BR-160: denies foreign, pending-reconfirmation, unassigned and missing assignments", async () => {
		for (const actor of [fixture.otherPorter, fixture.pendingPorter, fixture.unassignedPorter])
			await operationsRequest(actor).expect(404);
		await operationsRequest(fixture.assignedPorter, fixture.otherTripId).expect(404);
		await operationsRequest(fixture.assignedPorter, randomUUID()).expect(404);
		await operationsRequest(fixture.assignedPorter, "invalid-id").expect(422);
	});

	it("BR-160: ignores another Porter identity supplied in list or detail query parameters", async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/trips/assigned?porterId=${fixture.otherPorter.id}`)
			.set("Authorization", `Bearer ${fixture.assignedPorter.accessToken}`)
			.expect(200);
		expect(response.body.map((trip: { tripId: string }) => trip.tripId)).toEqual([
			fixture.tripId,
			fixture.laterAssignedTripId,
		]);
		await operationsRequest(fixture.otherPorter)
			.query({ porterId: fixture.assignedPorter.id })
			.expect(404);
	});

	it("BR-160: empty assignments return an empty list", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/trips/assigned")
			.set("Authorization", `Bearer ${fixture.unassignedPorter.accessToken}`)
			.expect(200);
		expect(response.body).toEqual([]);
	});

	it("BR-160: revocation immediately removes detail access and list visibility", async () => {
		await dataSource.query(
			`UPDATE "trip_porters" SET "status" = 'unassigned' WHERE "trip_id" = $1 AND "porter_id" = $2`,
			[fixture.laterAssignedTripId, fixture.assignedPorter.id]
		);
		try {
			await operationsRequest(fixture.assignedPorter, fixture.laterAssignedTripId).expect(404);
			const response = await request(app.getHttpServer())
				.get("/api/trips/assigned")
				.set("Authorization", `Bearer ${fixture.assignedPorter.accessToken}`)
				.expect(200);
			expect(response.body.map((trip: { tripId: string }) => trip.tripId)).toEqual([
				fixture.tripId,
			]);
		} finally {
			await dataSource.query(
				`UPDATE "trip_porters" SET "status" = 'assigned' WHERE "trip_id" = $1 AND "porter_id" = $2`,
				[fixture.laterAssignedTripId, fixture.assignedPorter.id]
			);
		}
	});

	it("BR-160: returns current Trip state even for ongoing/completed assignments", async () => {
		try {
			for (const status of [TripStatus.ONGOING, TripStatus.COMPLETED]) {
				await dataSource.query(`UPDATE "trips" SET "status" = $2 WHERE "id" = $1`, [
					fixture.tripId,
					status,
				]);
				const response = await operationsRequest(fixture.assignedPorter).expect(200);
				expect(response.body.status).toBe(status);
			}
		} finally {
			await dataSource.query(`UPDATE "trips" SET "status" = 'published' WHERE "id" = $1`, [
				fixture.tripId,
			]);
		}
	});

	it("BR-160: hides assigned Trips outside the upcoming, ongoing and finished states", async () => {
		try {
			for (const status of [TripStatus.CANCELLED, TripStatus.DRAFT, TripStatus.REJECTED]) {
				await dataSource.query(`UPDATE "trips" SET "status" = $2 WHERE "id" = $1`, [
					fixture.tripId,
					status,
				]);
				await operationsRequest(fixture.assignedPorter).expect(404);
				const list = await request(app.getHttpServer())
					.get("/api/trips/assigned")
					.set("Authorization", `Bearer ${fixture.assignedPorter.accessToken}`)
					.expect(200);
				expect(list.body.map((trip: { tripId: string }) => trip.tripId)).toEqual([
					fixture.laterAssignedTripId,
				]);
			}
		} finally {
			await dataSource.query(`UPDATE "trips" SET "status" = 'published' WHERE "id" = $1`, [
				fixture.tripId,
			]);
		}
	});

	it("BR-160: lists the route name and returns the Trip schedule with its meeting point", async () => {
		const list = await request(app.getHttpServer())
			.get("/api/trips/assigned")
			.set("Authorization", `Bearer ${fixture.assignedPorter.accessToken}`)
			.expect(200);
		expect(list.body[0]).toMatchObject({ tripId: fixture.tripId, routeName: "Trip roster route" });

		const meetingId = randomUUID();
		const finishId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trip_waypoints" ("id", "trip_id", "type", "name", "location", "day_number", "sequence_order", "planned_at", "duration_minutes") VALUES
			 ($1, $3, 'start', 'Cổng vườn', ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography, 1, 1, '2035-01-10T08:00:00Z', 15),
			 ($2, $3, 'finish', 'Bãi Bắc', ST_SetSRID(ST_MakePoint(108.25, 16.07), 4326)::geography, 1, 2, '2035-01-10T15:00:00Z', NULL)`,
			[meetingId, finishId, fixture.tripId]
		);
		try {
			const response = await operationsRequest(fixture.assignedPorter).expect(200);
			expect(response.body.meetingPointName).toBe("Cổng vườn");
			expect(
				response.body.waypoints.map((wp: { id: string; dayNumber: number }) => [
					wp.id,
					wp.dayNumber,
				])
			).toEqual([
				[meetingId, 1],
				[finishId, 1],
			]);
			expect(response.body.waypoints[0].location).toEqual({
				type: "Point",
				coordinates: [108.22, 16.04],
			});
			expect(Date.parse(response.body.waypoints[0].plannedAt)).toBe(
				Date.parse("2035-01-10T08:00:00Z")
			);
		} finally {
			await dataSource.query(`DELETE FROM "trip_waypoints" WHERE "trip_id" = $1`, [fixture.tripId]);
		}
	});

	it("BR-160: exposes route checkpoints and hazards without route administration data", async () => {
		const checkpointId = randomUUID();
		const hazardId = randomUUID();
		await dataSource.query(
			`INSERT INTO "checkpoints" ("id", "route_id", "name", "location", "radius_m", "type", "expected_arrival_offset", "instructions", "nearby_water_or_shelter", "route_position") VALUES ($1, $2, 'Water stop', ST_SetSRID(ST_MakePoint(108.23, 16.05), 4326)::geography, 50, 'water', 60, 'Refill water', true, 0.5)`,
			[checkpointId, routeIds[0]]
		);
		await dataSource.query(
			`INSERT INTO "route_danger_zones" ("id", "route_id", "geom", "radius_m", "description", "severity") VALUES ($1, $2, ST_SetSRID(ST_MakePoint(108.24, 16.06), 4326)::geography, 30, 'Slippery rocks', 'high')`,
			[hazardId, routeIds[0]]
		);
		try {
			const response = await operationsRequest(fixture.assignedPorter).expect(200);
			expect(response.body.route.checkpoints).toEqual([
				expect.objectContaining({
					id: checkpointId,
					instructions: "Refill water",
					location: { type: "Point", coordinates: [108.23, 16.05] },
				}),
			]);
			expect(response.body.route.dangerZones).toEqual([
				expect.objectContaining({ id: hazardId, severity: "high", description: "Slippery rocks" }),
			]);
		} finally {
			await dataSource.query(`DELETE FROM "checkpoints" WHERE "id" = $1`, [checkpointId]);
			await dataSource.query(`DELETE FROM "route_danger_zones" WHERE "id" = $1`, [hazardId]);
		}
	});

	it.each([
		["success", 0, "recorded"],
		["success", 60, "stale"],
		["success", 120, "stale"],
		["success", -10, "unavailable"],
		["failed", 0, "unavailable"],
	])(
		"AC5: projects snapshot %s aged %s minutes as %s",
		async (status, ageMinutes, availability) => {
			const snapshotId = randomUUID();
			if (status === "failed") {
				await dataSource.query(
					`INSERT INTO "weather_snapshots" ("id", "route_id", "status", "error_message") VALUES ($1, $2, 'failed', 'Provider unavailable')`,
					[snapshotId, routeIds[0]]
				);
			} else {
				await dataSource.query(
					`INSERT INTO "weather_snapshots" ("id", "route_id", "status", "observed_at", "rainfall_mm", "wind_kph", "temperature_c", "visibility_m", "thunderstorm") VALUES ($1, $2, $3, clock_timestamp() - ($4::int * interval '1 minute'), 0, 0, 20, 10000, false)`,
					[snapshotId, routeIds[0], status, ageMinutes]
				);
			}
			try {
				const response = await operationsRequest(fixture.assignedPorter).expect(200);
				expect(response.body.weather.availability).toBe(availability);
				if (availability === "unavailable") expect(response.body.weather.record).toBeNull();
				else
					expect(response.body.weather.record).toMatchObject({
						rainfallMm: 0,
						windKph: 0,
						riskLevel: null,
					});
			} finally {
				await dataSource.query(`DELETE FROM "weather_snapshots" WHERE "id" = $1`, [snapshotId]);
			}
		}
	);

	it("returns a deterministic, privacy-minimal mixed-state roster to the owning Host", async () => {
		const response = await rosterRequest(fixture.host).expect(200);

		expect(response.body).toMatchObject({
			tripId: fixture.tripId,
			status: TripStatus.PUBLISHED,
			startsAt: "2035-01-10T08:00:00.000Z",
		});
		expect(response.body.members).toHaveLength(5);
		expect(response.body.members.map((row: { memberStatus: string }) => row.memberStatus)).toEqual([
			BookingMemberStatus.JOINED,
			BookingMemberStatus.REGISTERED,
			BookingMemberStatus.NO_SHOW,
			BookingMemberStatus.REMOVED,
			BookingMemberStatus.LEFT,
		]);
		expect(
			response.body.members.map((row: { bookingStatus: string }) => row.bookingStatus)
		).toEqual([
			BookingStatus.CONFIRMED,
			BookingStatus.PENDING_RECONFIRMATION,
			BookingStatus.CANCELLED,
			BookingStatus.EXPIRED,
			BookingStatus.COMPLETED,
		]);
		for (const row of response.body.members) {
			expect(row).toEqual(
				expect.objectContaining({
					memberId: expect.any(String),
					bookingId: expect.any(String),
					userId: fixture.camper.id,
					displayName: "Roster camper",
					email: expect.stringContaining("trip-roster-camper-"),
					isPrimary: true,
				})
			);
			expect(row).not.toHaveProperty("statusUpdatedBy");
			expect(row).not.toHaveProperty("paymentStatus");
			expect(row).not.toHaveProperty("health");
			expect(row).not.toHaveProperty("emergency");
		}
	});

	it("allows an assigned Porter and excludes every member from another Trip", async () => {
		const response = await rosterRequest(fixture.assignedPorter).expect(200);
		expect(response.body.members).toHaveLength(5);
		expect(
			response.body.members.some(
				(row: { bookingId: string }) => row.bookingId === fixture.otherTripBookingId
			)
		).toBe(false);
	});

	it("rejects unrelated and non-assigned operational actors", async () => {
		await rosterRequest(fixture.otherHost).expect(403);
		await rosterRequest(fixture.pendingPorter).expect(403);
		await rosterRequest(fixture.unassignedPorter).expect(403);
		await rosterRequest(fixture.otherPorter).expect(403);
	});

	it("rejects anonymous, Camper, and Admin requests", async () => {
		await rosterRequest().expect(401);
		await rosterRequest(fixture.camper).expect(403);
		await rosterRequest(fixture.admin).expect(403);
	});

	it("returns only assigned Trips to the authenticated Porter", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/trips/assigned")
			.set("Authorization", `Bearer ${fixture.assignedPorter.accessToken}`)
			.expect(200);

		expect(response.body.map((trip: { tripId: string }) => trip.tripId)).toEqual([
			fixture.tripId,
			fixture.laterAssignedTripId,
		]);
		for (const trip of response.body) {
			expect(Object.keys(trip).sort()).toEqual(
				["endsAt", "routeName", "startsAt", "status", "title", "tripId"].sort()
			);
		}
	});

	it("protects Porter discovery by authentication and role", async () => {
		await request(app.getHttpServer()).get("/api/trips/assigned").expect(401);
		await request(app.getHttpServer())
			.get("/api/trips/assigned")
			.set("Authorization", `Bearer ${fixture.host.accessToken}`)
			.expect(403);
		await request(app.getHttpServer())
			.get("/api/trips/assigned")
			.set("Authorization", `Bearer ${fixture.camper.accessToken}`)
			.expect(403);
	});
});
