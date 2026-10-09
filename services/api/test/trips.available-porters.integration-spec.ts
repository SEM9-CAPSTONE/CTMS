import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TripPorterStatus } from "../src/modules/profiles/entities/trip-porter.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestActor {
	id: string;
	token: string;
}

interface CandidateOptions {
	id?: string;
	status?: UserStatus;
	primaryRole?: UserRole;
	grantedRoles?: UserRole[];
	profile?: boolean;
	availability?: "available" | "unavailable";
	experienceYears?: number;
}

interface QualificationOptions {
	routeId?: string;
	proficiency?: "learning" | "proficient" | "expert";
	verified?: boolean;
}

const TARGET_START = new Date("2035-06-10T08:00:00.000Z");
const TARGET_END = new Date("2035-06-10T16:00:00.000Z");

describe("CTMS-200 available Porters (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds = new Set<string>();
	const routeIds = new Set<string>();
	const tripIds = new Set<string>();

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
	});

	afterEach(async () => {
		const users = [...userIds];
		const routes = [...routeIds];
		const trips = [...tripIds];
		await dataSource.query(
			"DELETE FROM trip_porters WHERE trip_id = ANY($1::uuid[]) OR porter_id = ANY($2::uuid[])",
			[trips, users]
		);
		await dataSource.query("DELETE FROM trips WHERE id = ANY($1::uuid[])", [trips]);
		await dataSource.query(
			"DELETE FROM porter_route_qualifications WHERE route_id = ANY($1::uuid[]) OR porter_id = ANY($2::uuid[])",
			[routes, users]
		);
		await dataSource.query("DELETE FROM porter_profiles WHERE porter_id = ANY($1::uuid[])", [
			users,
		]);
		await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1::uuid[])", [routes]);
		await dataSource.query("DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])", [users]);
		await dataSource.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]);
		userIds.clear();
		routeIds.clear();
		tripIds.clear();
	});

	afterAll(async () => {
		await app.close();
	});

	async function createActor(role: UserRole, name: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			"INSERT INTO users (id, email, password_hash, role, status, full_name) VALUES ($1, $2, $3, $4, $5, $6)",
			[id, `ctms200-${id}@example.com`, "unused", role, UserStatus.ACTIVE, name]
		);
		await dataSource.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createCandidate(name: string, options: CandidateOptions = {}): Promise<string> {
		const id = options.id ?? randomUUID();
		const primaryRole = options.primaryRole ?? UserRole.PORTER;
		const grantedRoles = options.grantedRoles ?? [UserRole.PORTER];
		userIds.add(id);
		await dataSource.query(
			"INSERT INTO users (id, email, password_hash, role, status, full_name) VALUES ($1, $2, $3, $4, $5, $6)",
			[
				id,
				`ctms200-${id}@example.com`,
				"unused",
				primaryRole,
				options.status ?? UserStatus.ACTIVE,
				name,
			]
		);
		for (const role of grantedRoles) {
			await dataSource.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
		}
		if (options.profile !== false) {
			await dataSource.query(
				"INSERT INTO porter_profiles (porter_id, experience_years, availability_status) VALUES ($1, $2, $3)",
				[id, options.experienceYears ?? 0, options.availability ?? "available"]
			);
		}
		return id;
	}

	async function createRoute(hostId: string): Promise<string> {
		const routeId = randomUUID();
		routeIds.add(routeId);
		await dataSource.query(
			"INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status) VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8)",
			[
				routeId,
				hostId,
				`CTMS-200 Route-${routeId}`,
				"SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)",
				2500,
				"moderate",
				180,
				"active",
			]
		);
		return routeId;
	}

	async function createTrip(
		hostId: string,
		routeId: string,
		startsAt = TARGET_START,
		endsAt = TARGET_END
	): Promise<string> {
		const tripId = randomUUID();
		tripIds.add(tripId);
		await dataSource.query(
			"INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, price_per_person, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_GeogFromText($9), $10, $11, $12, $13, $14)",
			[
				tripId,
				hostId,
				routeId,
				`CTMS-200 Trip-${tripId}`,
				"day_trip",
				0,
				startsAt,
				endsAt,
				"SRID=4326;POINT(108.45 11.94)",
				new Date(startsAt.getTime() - 24 * 60 * 60 * 1000),
				1,
				20,
				100000,
				"draft",
			]
		);
		return tripId;
	}

	async function qualify(
		porterId: string,
		targetRouteId: string,
		verifierId: string,
		options: QualificationOptions = {}
	): Promise<void> {
		await dataSource.query(
			"INSERT INTO porter_route_qualifications (porter_id, route_id, proficiency, times_led, verified_by, verified_at) VALUES ($1, $2, $3, $4, $5, $6)",
			[
				porterId,
				options.routeId ?? targetRouteId,
				options.proficiency ?? "proficient",
				1,
				options.verified === false ? null : verifierId,
				options.verified === false ? null : new Date("2034-01-01T00:00:00.000Z"),
			]
		);
	}

	async function assign(porterId: string, tripId: string, status: TripPorterStatus): Promise<void> {
		await dataSource.query(
			"INSERT INTO trip_porters (trip_id, porter_id, status) VALUES ($1, $2, $3)",
			[tripId, porterId, status]
		);
	}

	function search(token: string, tripId: string, query: Record<string, unknown>) {
		return request(app.getHttpServer())
			.get(`/api/trips/${tripId}/available-porters`)
			.set("Authorization", `Bearer ${token}`)
			.query(query);
	}

	it("enforces authorization, ownership, existence, validation, and an empty result", async () => {
		const host = await createActor(UserRole.HOST, "Owning Host");
		const foreignHost = await createActor(UserRole.HOST, "Foreign Host");
		const camper = await createActor(UserRole.CAMPER, "Camper");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);

		const empty = await search(host.token, tripId, { role: "support" }).expect(200);
		expect(empty.body).toEqual({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		await search(foreignHost.token, tripId, { role: "support" }).expect(403);
		await search(host.token, randomUUID(), { role: "support" }).expect(404);
		await search(camper.token, tripId, { role: "support" }).expect(403);
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/available-porters`)
			.query({ role: "support" })
			.expect(401);
		await search(host.token, tripId, { role: "invalid" }).expect(422);
		await search(host.token, tripId, { role: "support", minExperienceYears: -1 }).expect(422);
		await search(host.token, tripId, { role: "support", limit: 101 }).expect(422);
	});

	it("filters base eligibility and experience with privacy-safe stable pagination", async () => {
		const host = await createActor(UserRole.HOST, "Host");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);
		const lowId = await createCandidate("Low", {
			id: "10000000-0000-4000-8000-000000000001",
			experienceYears: 1,
		});
		const equalId = await createCandidate("Equal", {
			id: "10000000-0000-4000-8000-000000000002",
			experienceYears: 4,
		});
		const highId = await createCandidate("High", {
			id: "10000000-0000-4000-8000-000000000003",
			experienceYears: 8,
		});
		await createCandidate("Inactive", { status: UserStatus.SUSPENDED, experienceYears: 9 });
		await createCandidate("Non-current", {
			primaryRole: UserRole.PORTER,
			grantedRoles: [UserRole.CAMPER],
			experienceYears: 9,
		});
		await createCandidate("Missing Profile", { profile: false });
		await createCandidate("Unavailable", { availability: "unavailable", experienceYears: 9 });

		const omitted = await search(host.token, tripId, { role: "support" }).expect(200);
		expect(omitted.body.items.map((item: { porterId: string }) => item.porterId)).toEqual([
			lowId,
			equalId,
			highId,
		]);
		expect(Object.keys(omitted.body.items[0]).sort()).toEqual(
			[
				"porterId",
				"displayName",
				"experienceYears",
				"availabilityStatus",
				"ratingAvg",
				"completedTrips",
			].sort()
		);

		const firstPage = await search(host.token, tripId, {
			role: "support",
			minExperienceYears: 4,
			limit: 1,
		}).expect(200);
		expect(firstPage.body.items[0].porterId).toBe(equalId);
		expect(firstPage.body.pagination).toEqual({
			page: 1,
			limit: 1,
			total: 2,
			totalPages: 2,
		});
		const secondPage = await search(host.token, tripId, {
			role: "support",
			minExperienceYears: 4,
			page: 2,
			limit: 1,
		}).expect(200);
		expect(secondPage.body.items[0].porterId).toBe(highId);
	});

	it("requires exact-Route verified proficient or expert qualification only for lead", async () => {
		const host = await createActor(UserRole.HOST, "Host");
		const routeId = await createRoute(host.id);
		const wrongRouteId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);
		const proficient = await createCandidate("Proficient");
		const expert = await createCandidate("Expert");
		const learning = await createCandidate("Learning");
		const unverified = await createCandidate("Unverified");
		const wrongRoute = await createCandidate("Wrong Route");
		const missing = await createCandidate("Missing");
		await qualify(proficient, routeId, host.id);
		await qualify(expert, routeId, host.id, { proficiency: "expert" });
		await qualify(learning, routeId, host.id, { proficiency: "learning" });
		await qualify(unverified, routeId, host.id, { verified: false });
		await qualify(wrongRoute, routeId, host.id, { routeId: wrongRouteId });

		const support = await search(host.token, tripId, { role: "support" }).expect(200);
		expect(support.body.items.map((item: { porterId: string }) => item.porterId).sort()).toEqual(
			[proficient, expert, learning, unverified, wrongRoute, missing].sort()
		);
		const lead = await search(host.token, tripId, { role: "lead" }).expect(200);
		expect(lead.body.items.map((item: { porterId: string }) => item.porterId).sort()).toEqual(
			[proficient, expert].sort()
		);
		expect(lead.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ porterId: proficient, proficiency: "proficient" }),
				expect.objectContaining({ porterId: expert, proficiency: "expert" }),
			])
		);
	});

	it("uses half-open overlap and only schedule-holding compatibility statuses", async () => {
		const host = await createActor(UserRole.HOST, "Host");
		const routeId = await createRoute(host.id);
		const targetTripId = await createTrip(host.id, routeId);
		const assigned = await createCandidate("Assigned");
		const pending = await createCandidate("Pending");
		const unassigned = await createCandidate("Unassigned");
		const nonOverlap = await createCandidate("Non overlap");
		const touchesStart = await createCandidate("Touches start");
		const touchesEnd = await createCandidate("Touches end");
		const overnight = await createCandidate("Overnight");
		const sameTrip = await createCandidate("Same Trip");
		const unaffected = await createCandidate("Unaffected");

		await assign(
			assigned,
			await createTrip(
				host.id,
				routeId,
				new Date("2035-06-10T09:00:00Z"),
				new Date("2035-06-10T10:00:00Z")
			),
			TripPorterStatus.ASSIGNED
		);
		await assign(
			pending,
			await createTrip(
				host.id,
				routeId,
				new Date("2035-06-10T07:00:00Z"),
				new Date("2035-06-10T09:00:00Z")
			),
			TripPorterStatus.PENDING_RECONFIRMATION
		);
		await assign(
			unassigned,
			await createTrip(
				host.id,
				routeId,
				new Date("2035-06-10T09:00:00Z"),
				new Date("2035-06-10T12:00:00Z")
			),
			TripPorterStatus.UNASSIGNED
		);
		await assign(
			nonOverlap,
			await createTrip(
				host.id,
				routeId,
				new Date("2035-06-09T08:00:00Z"),
				new Date("2035-06-09T16:00:00Z")
			),
			TripPorterStatus.ASSIGNED
		);
		await assign(
			touchesStart,
			await createTrip(host.id, routeId, new Date("2035-06-10T06:00:00Z"), TARGET_START),
			TripPorterStatus.ASSIGNED
		);
		await assign(
			touchesEnd,
			await createTrip(host.id, routeId, TARGET_END, new Date("2035-06-10T18:00:00Z")),
			TripPorterStatus.ASSIGNED
		);
		await assign(
			overnight,
			await createTrip(
				host.id,
				routeId,
				new Date("2035-06-09T20:00:00Z"),
				new Date("2035-06-11T08:00:00Z")
			),
			TripPorterStatus.ASSIGNED
		);
		await assign(sameTrip, targetTripId, TripPorterStatus.ASSIGNED);

		const response = await search(host.token, targetTripId, { role: "support" }).expect(200);
		const ids = response.body.items.map((item: { porterId: string }) => item.porterId);
		expect(ids).toEqual([unassigned, nonOverlap, touchesStart, touchesEnd, unaffected].sort());
		expect(ids).not.toEqual(expect.arrayContaining([assigned, pending, overnight, sameTrip]));
	});
});
