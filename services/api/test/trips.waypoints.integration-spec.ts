import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

interface WaypointBody {
	type: string;
	name: string;
	location: { type: "Point"; coordinates: [number, number] };
	plannedAt: string;
	metadata?: Record<string, unknown>;
}

const START: WaypointBody = {
	type: "start",
	name: "Trailhead",
	location: { type: "Point", coordinates: [108.2208, 16.0471] },
	plannedAt: "2099-10-01T01:00:00.000Z",
};
const FINISH: WaypointBody = {
	type: "finish",
	name: "Exit",
	location: { type: "Point", coordinates: [108.2508, 16.0671] },
	plannedAt: "2099-10-01T10:00:00.000Z",
};
const REST: WaypointBody = {
	type: "rest",
	name: "Lunch stop",
	location: { type: "Point", coordinates: [108.2308, 16.0571] },
	plannedAt: "2099-10-01T05:00:00.000Z",
	metadata: { routeOrder: "0.4" },
};

describe("Trip waypoint CRUD for draft Trips (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];

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
		await app.init();
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const targets = [...tripIds, ...userIds];
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)',
				[targets, userIds]
			);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Waypoint CRUD user')`,
			[id, `waypoint-crud-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createDraftTrip(host: Account): Promise<string> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Waypoint CRUD route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		const response = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({
				routeId,
				title: "Waypoint CRUD trip",
				tripType: "day_trip",
				startsAt: START.plannedAt,
				endsAt: FINISH.plannedAt,
				meetingPoint: START.location,
				bookingDeadline: "2099-09-30T01:00:00.000Z",
				capacityMin: 1,
				capacityMax: 10,
				pricePerPerson: 0,
				waypoints: [START, FINISH],
			})
			.expect(201);
		tripIds.push(response.body.id);
		return response.body.id;
	}

	const api = (host: Account) => ({
		create: (tripId: string, body: WaypointBody) =>
			request(app.getHttpServer())
				.post(`/api/trips/${tripId}/waypoints`)
				.set("Authorization", `Bearer ${host.accessToken}`)
				.send(body),
		update: (tripId: string, waypointId: string, body: WaypointBody) =>
			request(app.getHttpServer())
				.put(`/api/trips/${tripId}/waypoints/${waypointId}`)
				.set("Authorization", `Bearer ${host.accessToken}`)
				.send(body),
		remove: (tripId: string, waypointId: string) =>
			request(app.getHttpServer())
				.delete(`/api/trips/${tripId}/waypoints/${waypointId}`)
				.set("Authorization", `Bearer ${host.accessToken}`),
		submit: (tripId: string) =>
			request(app.getHttpServer())
				.post(`/api/trips/${tripId}/submit`)
				.set("Authorization", `Bearer ${host.accessToken}`),
	});

	type WaypointRow = { id: string; type: string; name: string; sequenceOrder: number };
	const byType = (waypoints: WaypointRow[], type: string) =>
		waypoints.find((waypoint) => waypoint.type === type) as WaypointRow;

	it("creates, updates and deletes stop waypoints while keeping stable ids and order", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host);
		const calls = api(host);

		const created = await calls.create(tripId, REST).expect(201);
		expect(created.body.waypoints.map((waypoint: WaypointRow) => waypoint.type)).toEqual([
			"start",
			"rest",
			"finish",
		]);
		const rest = byType(created.body.waypoints, "rest");
		expect(rest).toMatchObject({ sequenceOrder: 2, metadata: { routeOrder: "0.4" } });
		const startId = byType(created.body.waypoints, "start").id;

		const updated = await calls
			.update(tripId, rest.id, { ...REST, type: "meal", name: "Picnic" })
			.expect(200);
		expect(byType(updated.body.waypoints, "meal")).toMatchObject({ id: rest.id, name: "Picnic" });
		expect(byType(updated.body.waypoints, "start").id).toBe(startId);

		const deleted = await calls.remove(tripId, rest.id).expect(200);
		expect(deleted.body.waypoints.map((waypoint: WaypointRow) => waypoint.type)).toEqual([
			"start",
			"finish",
		]);

		const [{ count }] = await dataSource.query(
			`SELECT count(*)::int AS count FROM "audit_logs" WHERE "target_id" = $1 AND "action" LIKE 'trip_waypoint.%'`,
			[tripId]
		);
		expect(count).toBe(3);
	});

	it("rejects invalid waypoint changes without persisting them", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host);
		const calls = api(host);
		const trip = await calls.create(tripId, REST).expect(201);
		const startId = byType(trip.body.waypoints, "start").id;
		const restId = byType(trip.body.waypoints, "rest").id;

		await calls.create(tripId, { ...REST, plannedAt: "2099-10-02T05:00:00.000Z" }).expect(422);
		await calls.create(tripId, { ...REST, name: "Duplicate time" }).expect(422);
		await calls.create(tripId, { ...START, plannedAt: "2099-10-01T02:00:00.000Z" }).expect(422);
		await calls
			.create(tripId, { ...REST, type: "overnight", plannedAt: "2099-10-01T06:00:00.000Z" })
			.expect(422);
		await calls.remove(tripId, startId).expect(409);
		await calls.update(tripId, startId, { ...START, type: "rest" }).expect(409);
		await calls.update(tripId, restId, { ...REST, type: "finish" }).expect(409);
		await calls.update(tripId, randomUUID(), REST).expect(404);

		const rows = await dataSource.query(
			`SELECT count(*)::int AS count FROM "trip_waypoints" WHERE "trip_id" = $1`,
			[tripId]
		);
		expect(rows[0].count).toBe(3);
	});

	it("only lets the owning Host change waypoints of a draft Trip", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createDraftTrip(host);

		await api(otherHost).create(tripId, REST).expect(403);
		await api(camper).create(tripId, REST).expect(403);
		await api(host).create(randomUUID(), REST).expect(404);

		await api(host).submit(tripId).expect(200);
		await api(host).create(tripId, REST).expect(409);
	});

	it("submits the stored waypoints for approval and is idempotent", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host);
		const calls = api(host);
		await calls.create(tripId, REST).expect(201);

		const submitted = await calls.submit(tripId).expect(200);
		expect(submitted.body.status).toBe(TripStatus.PENDING_APPROVAL);
		expect(submitted.body.waypoints).toHaveLength(3);
		const again = await calls.submit(tripId).expect(200);
		expect(again.body.status).toBe(TripStatus.PENDING_APPROVAL);
		const logs = await dataSource.query(
			`SELECT count(*)::int AS count FROM "audit_logs" WHERE "target_id" = $1 AND "action" = 'trip.submitted_for_approval'`,
			[tripId]
		);
		expect(logs[0].count).toBe(1);
	});

	it("refuses to submit when the stored waypoints are not approval ready", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host);
		await dataSource.query(
			`UPDATE "trip_waypoints" SET "planned_at" = '2099-10-01T09:00:00Z' WHERE "trip_id" = $1 AND "type" = 'start'`,
			[tripId]
		);
		await dataSource.query(
			`UPDATE "trip_waypoints" SET "planned_at" = '2099-10-01T02:00:00Z' WHERE "trip_id" = $1 AND "type" = 'finish'`,
			[tripId]
		);
		await api(host).submit(tripId).expect(422);
		const [trip] = await dataSource.query(`SELECT "status" FROM "trips" WHERE "id" = $1`, [tripId]);
		expect(trip.status).toBe(TripStatus.DRAFT);
	});

	it("keeps configured stop waypoints when the Host edits the Trip details", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host);
		const created = await api(host).create(tripId, REST).expect(201);
		const restId = byType(created.body.waypoints, "rest").id;
		const [route] = await dataSource.query(
			`SELECT "route_id" AS "routeId" FROM "trips" WHERE "id" = $1`,
			[tripId]
		);

		const edited = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({
				routeId: route.routeId,
				title: "Renamed trip",
				tripType: "day_trip",
				startsAt: START.plannedAt,
				endsAt: FINISH.plannedAt,
				meetingPoint: START.location,
				bookingDeadline: "2099-09-30T01:00:00.000Z",
				capacityMin: 1,
				capacityMax: 10,
				pricePerPerson: 0,
				waypoints: [START, FINISH],
			});
		expect([200, 201]).toContain(edited.status);
		expect(edited.body.title).toBe("Renamed trip");
		expect(edited.body.waypoints.map((waypoint: WaypointRow) => waypoint.id)).toContain(restId);
	});
});
