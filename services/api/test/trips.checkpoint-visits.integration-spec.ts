import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { CheckpointType } from "../src/modules/trekking-routes/entities/checkpoint.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface TestActor {
	id: string;
	token: string;
}

describe("Checkpoint arrival confirmation and operational progress (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;

	const userIds = new Set<string>();
	const routeIds = new Set<string>();
	const tripIds = new Set<string>();
	const checkpointIds = new Set<string>();
	const bookingIds = new Set<string>();

	let host: TestActor;
	let assignedPorter: TestActor;
	let unassignedPorter: TestActor;
	let camper: TestActor;

	let routeId: string;
	let otherRouteId: string;
	let checkpoint1Id: string;
	let checkpoint2Id: string;
	let otherRouteCheckpointId: string;
	let tripId: string;
	let joinedMemberId: string;
	let registeredMemberId: string;

	function createToken(userId: string, role: UserRole): string {
		return jwtService.sign({
			sub: userId,
			roles: [role],
			status: UserStatus.ACTIVE,
		});
	}

	async function createUser(role: UserRole, prefix: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'test-hash', $3, 'active', $4)`,
			[id, `${prefix}-${id}@example.com`, role, `${prefix} User`]
		);
		return { id, token: createToken(id, role) };
	}

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

		host = await createUser(UserRole.HOST, "cp-host");
		assignedPorter = await createUser(UserRole.PORTER, "cp-assigned");
		unassignedPorter = await createUser(UserRole.PORTER, "cp-unassigned");
		camper = await createUser(UserRole.CAMPER, "cp-camper");

		// Route 1 with 2 checkpoints
		routeId = randomUUID();
		routeIds.add(routeId);
		await dataSource.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Route Alpha', ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2, 16.0), ST_MakePoint(108.3, 16.1)), 4326)::geography, 5000, 'moderate', 300, $3)`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		checkpoint1Id = randomUUID();
		checkpointIds.add(checkpoint1Id);
		await dataSource.query(
			`INSERT INTO checkpoints (id, route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position)
			 VALUES ($1, $2, 'Base Camp Rest', ST_SetSRID(ST_MakePoint(108.22, 16.02), 4326)::geography, 50, $3, 60, 'Rest area', true, 0.3)`,
			[checkpoint1Id, routeId, CheckpointType.REST]
		);

		checkpoint2Id = randomUUID();
		checkpointIds.add(checkpoint2Id);
		await dataSource.query(
			`INSERT INTO checkpoints (id, route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position)
			 VALUES ($1, $2, 'Summit Finish', ST_SetSRID(ST_MakePoint(108.28, 16.08), 4326)::geography, 50, $3, 180, 'Peak', false, 1.0)`,
			[checkpoint2Id, routeId, CheckpointType.FINISH]
		);

		// Route 2 for invalid checkpoint test
		otherRouteId = randomUUID();
		routeIds.add(otherRouteId);
		await dataSource.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Route Beta', ST_SetSRID(ST_MakeLine(ST_MakePoint(109.0, 15.0), ST_MakePoint(109.1, 15.1)), 4326)::geography, 3000, 'easy', 120, $3)`,
			[otherRouteId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		otherRouteCheckpointId = randomUUID();
		checkpointIds.add(otherRouteCheckpointId);
		await dataSource.query(
			`INSERT INTO checkpoints (id, route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter, route_position)
			 VALUES ($1, $2, 'Beta Point', ST_SetSRID(ST_MakePoint(109.05, 15.05), 4326)::geography, 50, $3, 30, 'None', false, 0.5)`,
			[otherRouteCheckpointId, otherRouteId, CheckpointType.REST]
		);

		// Trip on Route 1
		tripId = randomUUID();
		tripIds.add(tripId);
		await dataSource.query(
			`INSERT INTO trips (
				id, host_id, route_id, title, trip_type, duration_nights,
				starts_at, ends_at, meeting_point, booking_deadline,
				capacity_min, capacity_max, seats_taken, price_per_person, status
			) VALUES (
				$1, $2, $3, 'Active Operational Trip', 'day_trip', 0,
				now() - interval '2 hours', now() + interval '6 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.0), 4326)::geography,
				now() - interval '1 day', 1, 10, 2, 500000, $4
			)`,
			[tripId, host.id, routeId, TripStatus.ONGOING]
		);

		// Assign Porter
		await dataSource.query(
			`INSERT INTO trip_porters (trip_id, porter_id, status)
			 VALUES ($1, $2, $3)`,
			[tripId, assignedPorter.id, TripPorterStatus.ASSIGNED]
		);

		// Booking with 1 joined member and 1 registered member
		const bookingId = randomUUID();
		bookingIds.add(bookingId);
		await dataSource.query(
			`INSERT INTO bookings (id, trip_id, user_id, status, total_amount)
			 VALUES ($1, $2, $3, $4, 1000000)`,
			[bookingId, tripId, camper.id, BookingStatus.CONFIRMED]
		);

		joinedMemberId = randomUUID();
		await dataSource.query(
			`INSERT INTO booking_members (id, booking_id, user_id, is_primary, member_status)
			 VALUES ($1, $2, $3, true, $4)`,
			[joinedMemberId, bookingId, camper.id, BookingMemberStatus.JOINED]
		);

		registeredMemberId = randomUUID();
		await dataSource.query(
			`INSERT INTO booking_members (id, booking_id, user_id, is_primary, member_status)
			 VALUES ($1, $2, NULL, false, $3)`,
			[registeredMemberId, bookingId, BookingMemberStatus.REGISTERED]
		);
	}, 60000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query("DELETE FROM checkpoint_visits WHERE trip_id = ANY($1::uuid[])", [
				[...tripIds],
			]);
			await dataSource.query("DELETE FROM booking_members WHERE booking_id = ANY($1::uuid[])", [
				[...bookingIds],
			]);
			await dataSource.query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [[...bookingIds]]);
			await dataSource.query("DELETE FROM trip_porters WHERE trip_id = ANY($1::uuid[])", [
				[...tripIds],
			]);
			await dataSource.query("DELETE FROM trips WHERE id = ANY($1::uuid[])", [[...tripIds]]);
			await dataSource.query("DELETE FROM checkpoints WHERE id = ANY($1::uuid[])", [
				[...checkpointIds],
			]);
			await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1::uuid[])", [
				[...routeIds],
			]);
			await dataSource.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[...userIds]]);
			await app.close();
		}
	});

	describe("POST /api/trips/:tripId/checkpoints/:checkpointId/arrival (BR-234)", () => {
		it("confirms checkpoint arrival and records visits only for joined members", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/trips/${tripId}/checkpoints/${checkpoint1Id}/arrival`)
				.set("Authorization", `Bearer ${assignedPorter.token}`)
				.send({
					arrivedAt: "2026-10-24T10:00:00.000Z",
					location: { type: "Point", coordinates: [108.22, 16.02] },
					capturedOffline: false,
					syncId: "sync-1",
				});

			expect(res.status).toBe(201);
			expect(res.body.tripId).toBe(tripId);
			expect(res.body.visitedCheckpoints).toBe(1);
			expect(res.body.totalCheckpoints).toBe(2);
			expect(res.body.progressPercentage).toBe(50);
			expect(res.body.lastVisitedCheckpoint).toMatchObject({
				checkpointId: checkpoint1Id,
				name: "Base Camp Rest",
			});

			const cp1 = res.body.checkpoints.find(
				(c: { checkpointId: string }) => c.checkpointId === checkpoint1Id
			);
			expect(cp1.status).toBe("arrival_confirmed");
			expect(cp1.visitedMembersCount).toBe(1);
			expect(cp1.visits).toHaveLength(1);
			expect(cp1.visits[0].memberId).toBe(joinedMemberId);

			// Verify in DB that registered member did NOT receive a visit record
			const visits = await dataSource.query(
				"SELECT member_id FROM checkpoint_visits WHERE trip_id = $1 AND checkpoint_id = $2",
				[tripId, checkpoint1Id]
			);
			expect(visits).toHaveLength(1);
			expect(visits[0].member_id).toBe(joinedMemberId);
		});

		it("prevents duplicate visit records when confirming repeatedly (idempotent)", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/trips/${tripId}/checkpoints/${checkpoint1Id}/arrival`)
				.set("Authorization", `Bearer ${assignedPorter.token}`)
				.send({
					arrivedAt: "2026-10-24T10:15:00.000Z",
					capturedOffline: false,
					syncId: "sync-1-repeat",
				});

			expect(res.status).toBe(201);

			// Database must still have only 1 visit record for (trip, checkpoint, member)
			const count = await dataSource.query(
				"SELECT count(*)::int as count FROM checkpoint_visits WHERE trip_id = $1 AND checkpoint_id = $2",
				[tripId, checkpoint1Id]
			);
			expect(count[0].count).toBe(1);
		});

		it("rejects an unassigned Porter with 403 Forbidden", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/trips/${tripId}/checkpoints/${checkpoint1Id}/arrival`)
				.set("Authorization", `Bearer ${unassignedPorter.token}`)
				.send({});

			expect(res.status).toBe(403);
		});

		it("rejects a Checkpoint that does not belong to the Trip Route with 400 Bad Request", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/trips/${tripId}/checkpoints/${otherRouteCheckpointId}/arrival`)
				.set("Authorization", `Bearer ${assignedPorter.token}`)
				.send({});

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Checkpoint does not belong");
		});
	});

	describe("POST /api/trips/:tripId/checkpoints/sync (BR-234)", () => {
		it("synchronizes multiple offline arrival events idempotently", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/trips/${tripId}/checkpoints/sync`)
				.set("Authorization", `Bearer ${assignedPorter.token}`)
				.send({
					arrivals: [
						{
							checkpointId: checkpoint2Id,
							arrivedAt: "2026-10-24T12:00:00.000Z",
							capturedOffline: true,
							syncId: "offline-sync-chk2",
						},
					],
				});

			expect(res.status).toBe(201);
			expect(res.body.visitedCheckpoints).toBe(2);
			expect(res.body.totalCheckpoints).toBe(2);
			expect(res.body.progressPercentage).toBe(100);

			const cp2 = res.body.checkpoints.find(
				(c: { checkpointId: string }) => c.checkpointId === checkpoint2Id
			);
			expect(cp2.status).toBe("arrival_confirmed");
			expect(cp2.visits[0].capturedOffline).toBe(true);
		});
	});

	describe("GET /api/trips/:tripId/progress", () => {
		it("returns authoritative operational progress projection to Porter and Host", async () => {
			const porterRes = await request(app.getHttpServer())
				.get(`/api/trips/${tripId}/progress`)
				.set("Authorization", `Bearer ${assignedPorter.token}`);

			expect(porterRes.status).toBe(200);
			expect(porterRes.body.tripId).toBe(tripId);
			expect(porterRes.body.progressPercentage).toBe(100);
			expect(porterRes.body.checkpoints).toHaveLength(2);

			const hostRes = await request(app.getHttpServer())
				.get(`/api/trips/${tripId}/progress`)
				.set("Authorization", `Bearer ${host.token}`);

			expect(hostRes.status).toBe(200);
			expect(hostRes.body.progressPercentage).toBe(100);
		});
	});
});
