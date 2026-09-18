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

interface CreateTripPayload {
	routeId: string;
	title: string;
	description?: string;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	meetingPoint: {
		type: "Point";
		coordinates: [number, number];
	};
	meetingAt?: string;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	pricePerPerson: number;
	waypoints: Array<{
		type: string;
		name: string;
		location: {
			type: "Point";
			coordinates: [number, number];
		};
		dayNumber: number;
		sequenceOrder: number;
		plannedAt?: string;
	}>;
}

describe("POST /api/trips (integration, real Postgres)", () => {
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
			INSERT INTO "users" (
				"id",
				"email",
				"password_hash",
				"role",
				"status",
				"full_name"
			)
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[
				id,
				`e2e-trip-${role}-${sequence}@example.com`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
				`Trip ${role}`,
			]
		);
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
			 ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);

		return {
			id,
			accessToken: jwtService.sign({ sub: id, roles: [role] }),
		};
	}

	async function createRoute(hostId: string, status = TrekkingRouteStatus.ACTIVE): Promise<string> {
		const routeId = randomUUID();
		await dataSource.query(
			`
			INSERT INTO "trekking_routes" (
				"id",
				"host_id",
				"name",
				"description",
				"route_geom",
				"length_meters",
				"difficulty",
				"expected_duration_minutes",
				"status"
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				ST_SetSRID(ST_MakeLine(
					ST_MakePoint(108.2208, 16.0471),
					ST_MakePoint(108.2508, 16.0671)
				), 4326)::geography,
				3500,
				'moderate',
				240,
				$5
			)
			`,
			[routeId, hostId, `Trip route ${routeId}`, "Route for Create Trip tests", status]
		);
		cleanupRouteIds.push(routeId);
		return routeId;
	}

	function createPayload(routeId: string): CreateTripPayload {
		return {
			routeId,
			title: "Da Nang overnight ridge trek",
			description: "Create Trip integration coverage",
			tripType: TripType.OVERNIGHT,
			startsAt: "2026-10-01T12:00:00.000Z",
			endsAt: "2026-10-03T10:00:00.000Z",
			meetingPoint: {
				type: "Point",
				coordinates: [108.2208, 16.0471],
			},
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
					type: "finish",
					name: "Summit exit",
					location: { type: "Point", coordinates: [108.2508, 16.0671] },
					dayNumber: 2,
					sequenceOrder: 2,
					plannedAt: "2026-10-03T10:00:00.000Z",
				},
			],
		};
	}

	it("creates a draft Trip from an owned active Route and persists derived state", async () => {
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);

		const response = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(createPayload(routeId))
			.expect(201);

		const tripId: string = response.body.id;
		cleanupTripIds.push(tripId);

		expect(response.body).toMatchObject({
			id: tripId,
			hostId: host.id,
			routeId,
			title: "Da Nang overnight ridge trek",
			tripType: TripType.OVERNIGHT,
			durationNights: 2,
			status: TripStatus.DRAFT,
			seatsTaken: 0,
			pricePerPerson: 0,
		});
		expect(response.body.isFree).toBeUndefined();
		expect(response.body.provinceCode).toBeUndefined();
		expect(response.body.cityCode).toBeUndefined();
		expect(response.body.waypoints).toHaveLength(2);

		const trips = await dataSource.query(
			`
			SELECT
				"host_id" AS "hostId",
				"route_id" AS "routeId",
				"duration_nights" AS "durationNights",
				"status",
				"seats_taken" AS "seatsTaken",
				"price_per_person" AS "pricePerPerson"
			FROM "trips"
			WHERE "id" = $1
			`,
			[tripId]
		);
		expect(trips[0]).toMatchObject({
			hostId: host.id,
			routeId,
			durationNights: 2,
			status: TripStatus.DRAFT,
			seatsTaken: 0,
		});
		expect(Number(trips[0].pricePerPerson)).toBe(0);

		const auditRows = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[tripId, "trip.created"]
		);
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0].actor_id).toBe(host.id);
		expect(auditRows[0].after).toMatchObject({
			routeId,
			status: TripStatus.DRAFT,
			durationNights: 2,
			pricePerPerson: 0,
		});
	});

	it("creates a draft Trip with unlimited maximum capacity", async () => {
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);

		const response = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ ...createPayload(routeId), capacityMax: null })
			.expect(201);

		const tripId: string = response.body.id;
		cleanupTripIds.push(tripId);

		expect(response.body.capacityMin).toBe(2);
		expect(response.body.capacityMax).toBeNull();

		const trips = await dataSource.query(
			'SELECT "capacity_min" AS "capacityMin", "capacity_max" AS "capacityMax" FROM "trips" WHERE "id" = $1',
			[tripId]
		);
		expect(Number(trips[0].capacityMin)).toBe(2);
		expect(trips[0].capacityMax).toBeNull();
	});

	it("rejects a day Trip that spans multiple dates", async () => {
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const beforeRows = await dataSource.query('SELECT COUNT(*)::int AS "count" FROM "trips"');

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({
				...createPayload(routeId),
				tripType: TripType.DAY_TRIP,
				startsAt: "2026-10-01T12:00:00.000Z",
				endsAt: "2026-10-02T10:00:00.000Z",
				waypoints: createPayload(routeId).waypoints.map((waypoint) => ({
					...waypoint,
					plannedAt: undefined,
				})),
			})
			.expect(422);

		const afterRows = await dataSource.query('SELECT COUNT(*)::int AS "count" FROM "trips"');
		expect(afterRows[0].count).toBe(beforeRows[0].count);
	});

	it("requires authentication and Host role", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const routeId = await createRoute(host.id);

		await request(app.getHttpServer()).post("/api/trips").send(createPayload(routeId)).expect(401);

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send(createPayload(routeId))
			.expect(403);
	});

	it("rejects missing, foreign, or non-active Routes", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const foreignRouteId = await createRoute(otherHost.id);
		const draftRouteId = await createRoute(host.id, TrekkingRouteStatus.DRAFT);

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(createPayload(randomUUID()))
			.expect(404);

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(createPayload(foreignRouteId))
			.expect(403);

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(createPayload(draftRouteId))
			.expect(409);
	});

	it("rejects invalid schedule, capacity, and waypoint data without creating a Trip", async () => {
		const host = await createAccount(UserRole.HOST);
		const routeId = await createRoute(host.id);
		const beforeRows = await dataSource.query('SELECT COUNT(*)::int AS "count" FROM "trips"');

		const invalidPayload = {
			...createPayload(routeId),
			endsAt: "2026-10-01T12:00:00.000Z",
			bookingDeadline: "2026-10-01T13:00:00.000Z",
			capacityMin: 20,
			waypoints: [
				{
					type: "start",
					name: "Only start",
					location: { type: "Point", coordinates: [108.2208, 16.0471] },
					dayNumber: 1,
					sequenceOrder: 1,
				},
			],
		};

		await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(invalidPayload)
			.expect(422);

		const afterRows = await dataSource.query('SELECT COUNT(*)::int AS "count" FROM "trips"');
		expect(afterRows[0].count).toBe(beforeRows[0].count);
	});
});
