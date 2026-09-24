import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus, TripType } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface TestAccount {
	id: string;
	accessToken: string;
}

/**
 * CTMS-023-T01. Real Postgres, no mocking -- mirrors
 * trips.create.integration-spec.ts's own fixture style. Covers
 * `PATCH /trips/:tripId/review`, the Admin approve/decline step this story
 * adds on top of CTMS-022's already-merged draft -> pending_approval flow.
 */
describe("PATCH /api/trips/:tripId/review (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let cleanupUserIds: string[] = [];
	let cleanupRouteIds: string[] = [];
	let cleanupTripIds: string[] = [];

	beforeAll(async () => {
		jest.setTimeout(60000);
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
	}, 60000);

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupRouteIds = [];
		cleanupTripIds = [];
	});

	afterEach(async () => {
		if (cleanupTripIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				cleanupTripIds,
			]);
			await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = ANY($1)', [
				cleanupTripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [cleanupTripIds]);
		}
		if (cleanupRouteIds.length > 0) {
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [
				cleanupRouteIds,
			]);
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[cleanupUserIds]
			);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
		}
	});

	async function createAccount(role: UserRole): Promise<TestAccount> {
		const id = randomUUID();
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`
			INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[
				id,
				`e2e-trip-review-${role}-${sequence}@example.com`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
				`Trip Review ${role}`,
			]
		);
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
			 ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);

		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(hostId: string, status = TrekkingRouteStatus.ACTIVE): Promise<string> {
		const routeId = randomUUID();
		await dataSource.query(
			`
			INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "description", "route_geom",
				"length_meters", "difficulty", "expected_duration_minutes", "status"
			)
			VALUES (
				$1, $2, $3, $4,
				ST_SetSRID(ST_MakeLine(
					ST_MakePoint(108.2208, 16.0471),
					ST_MakePoint(108.2508, 16.0671)
				), 4326)::geography,
				3500, 'moderate', 240, $5
			)
			`,
			[routeId, hostId, `Trip review route ${routeId}`, "Route for review tests", status]
		);
		cleanupRouteIds.push(routeId);
		return routeId;
	}

	function createPayload(routeId: string) {
		return {
			routeId,
			title: "Da Nang overnight ridge trek",
			description: "Review integration coverage",
			tripType: TripType.OVERNIGHT,
			startsAt: "2026-10-01T12:00:00.000Z",
			endsAt: "2026-10-03T10:00:00.000Z",
			meetingPoint: { type: "Point", coordinates: [108.2208, 16.0471] },
			meetingAt: "2026-10-01T11:30:00.000Z",
			bookingDeadline: "2026-09-30T12:00:00.000Z",
			capacityMin: 2,
			capacityMax: 12,
			pricePerPerson: 0,
			waypoints: [
				{
					type: "start",
					name: "Trailhead",
					location: { type: "Point", coordinates: [108.2208, 16.0471] },
					dayNumber: 1,
					sequenceOrder: 1,
					plannedAt: "2026-10-01T12:00:00.000Z",
				},
				{
					type: "overnight",
					name: "Night one camp",
					location: { type: "Point", coordinates: [108.2358, 16.0571] },
					dayNumber: 1,
					sequenceOrder: 2,
					plannedAt: "2026-10-02T00:00:00.000Z",
				},
				{
					type: "overnight",
					name: "Night two camp",
					location: { type: "Point", coordinates: [108.2428, 16.0611] },
					dayNumber: 2,
					sequenceOrder: 3,
					plannedAt: "2026-10-03T00:00:00.000Z",
				},
				{
					type: "finish",
					name: "Summit exit",
					location: { type: "Point", coordinates: [108.2508, 16.0671] },
					dayNumber: 3,
					sequenceOrder: 4,
					plannedAt: "2026-10-03T10:00:00.000Z",
				},
			],
		};
	}

	/** Creates a draft Trip and submits it for approval (pending_approval),
	 * the one precondition every review test needs. */
	async function createPendingTrip(host: TestAccount, routeId: string): Promise<string> {
		const payload = createPayload(routeId);
		const createResponse = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(payload)
			.expect(201);
		const tripId: string = createResponse.body.id;
		cleanupTripIds.push(tripId);

		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/waypoints`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ waypoints: payload.waypoints })
			.expect(200);

		return tripId;
	}

	function review(token: string | undefined, tripId: string, body: object) {
		const req = request(app.getHttpServer()).patch(`/api/trips/${tripId}/review`);
		return token ? req.set("Authorization", `Bearer ${token}`).send(body) : req.send(body);
	}

	function listPendingReview(token: string | undefined) {
		const req = request(app.getHttpServer()).get("/api/trips/pending-review");
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	describe("GET /api/trips/pending-review", () => {
		it("lists only pending Trips for an Admin, oldest first, and excludes non-pending ones", async () => {
			const admin = await createAccount(UserRole.ADMIN);
			const host = await createAccount(UserRole.HOST);
			const routeId = await createRoute(host.id);
			const firstPendingId = await createPendingTrip(host, routeId);
			const secondPendingId = await createPendingTrip(host, await createRoute(host.id));

			const draftPayload = createPayload(await createRoute(host.id));
			const draftResponse = await request(app.getHttpServer())
				.post("/api/trips")
				.set("Authorization", `Bearer ${host.accessToken}`)
				.send(draftPayload)
				.expect(201);
			cleanupTripIds.push(draftResponse.body.id);

			const response = await listPendingReview(admin.accessToken).expect(200);

			const ids = response.body.map((trip: { id: string }) => trip.id);
			expect(ids).toEqual([firstPendingId, secondPendingId]);
			expect(ids).not.toContain(draftResponse.body.id);
			for (const trip of response.body) {
				expect(trip.status).toBe(TripStatus.PENDING_APPROVAL);
			}
		});

		it("requires authentication and Admin role", async () => {
			const host = await createAccount(UserRole.HOST);

			await listPendingReview(undefined).expect(401);
			await listPendingReview(host.accessToken).expect(403);
		});
	});

	it("Admin approves a pending Trip, publishing it and auditing with no reason", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		const response = await review(admin.accessToken, tripId, { action: "approve" }).expect(200);

		expect(response.body).toMatchObject({ id: tripId, status: TripStatus.PUBLISHED });

		const trips = await dataSource.query('SELECT "status" FROM "trips" WHERE "id" = $1', [tripId]);
		expect(trips[0].status).toBe(TripStatus.PUBLISHED);

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[tripId, "trip.approved"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].actor_id).toBe(admin.id);
		expect(auditRows[0].reason).toBeNull();
	});

	it("Admin declines a pending Trip back to draft, requiring and recording a reason", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		const response = await review(admin.accessToken, tripId, {
			action: "decline",
			reason: "Missing an overnight waypoint description",
		}).expect(200);

		expect(response.body).toMatchObject({ id: tripId, status: TripStatus.DRAFT });

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[tripId, "trip.declined"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].reason).toBe("Missing an overnight waypoint description");
	});

	it("rejects a decline without a reason (422) and creates no side effect", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		await review(admin.accessToken, tripId, { action: "decline" }).expect(422);

		const trips = await dataSource.query('SELECT "status" FROM "trips" WHERE "id" = $1', [tripId]);
		expect(trips[0].status).toBe(TripStatus.PENDING_APPROVAL);
	});

	it("requires authentication and Admin role, with no side effect for a non-admin attempt", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		await review(undefined, tripId, { action: "approve" }).expect(401);
		await review(host.accessToken, tripId, { action: "approve" }).expect(403);

		const trips = await dataSource.query('SELECT "status" FROM "trips" WHERE "id" = $1', [tripId]);
		expect(trips[0].status).toBe(TripStatus.PENDING_APPROVAL);
		void admin;
	});

	it("returns 404 for a Trip that does not exist", async () => {
		const admin = await createAccount(UserRole.ADMIN);

		await review(admin.accessToken, randomUUID(), { action: "approve" }).expect(404);
	});

	it("returns 409 when the Trip is not in pending_approval status, with no side effect", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const payload = createPayload(routeId);
		const createResponse = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(payload)
			.expect(201);
		const draftTripId: string = createResponse.body.id;
		cleanupTripIds.push(draftTripId);

		await review(admin.accessToken, draftTripId, { action: "approve" }).expect(409);

		const trips = await dataSource.query('SELECT "status" FROM "trips" WHERE "id" = $1', [
			draftTripId,
		]);
		expect(trips[0].status).toBe(TripStatus.DRAFT);
	});

	it("rejects approval when the Trip's Route is no longer active (422), leaving the Trip pending", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		await dataSource.query('UPDATE "trekking_routes" SET "status" = $2 WHERE "id" = $1', [
			routeId,
			TrekkingRouteStatus.CLOSED,
		]);

		await review(admin.accessToken, tripId, { action: "approve" }).expect(422);

		const trips = await dataSource.query('SELECT "status" FROM "trips" WHERE "id" = $1', [tripId]);
		expect(trips[0].status).toBe(TripStatus.PENDING_APPROVAL);
		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[tripId, "trip.approved"]
		);
		expect(auditRows).toHaveLength(0);
	});

	it("a retried approval on an already-published Trip returns 409, never double-processing (AC-04)", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const tripId = await createPendingTrip(host, routeId);

		await review(admin.accessToken, tripId, { action: "approve" }).expect(200);
		await review(admin.accessToken, tripId, { action: "approve" }).expect(409);

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[tripId, "trip.approved"]
		);
		expect(auditRows).toHaveLength(1);
	});
});
