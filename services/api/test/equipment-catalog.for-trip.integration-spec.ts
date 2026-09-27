import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { EquipmentCatalogStatus } from "../src/modules/equipment-catalog/equipment-catalog-status.enum";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

/**
 * CTMS-040-T02. Real Postgres, no mocking. Covers
 * `GET /equipment-catalog/for-trip/:tripId`, the Camper-facing read this
 * story adds so the equipment-rental picker UI has a data source -- no
 * such endpoint existed anywhere in `equipment-catalog` before this task
 * (it only had Host/Admin routes).
 */
describe("GET /api/equipment-catalog/for-trip/:tripId (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const equipmentIds: string[] = [];

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
		if (dataSource?.isInitialized) {
			if (equipmentIds.length > 0) {
				await dataSource.query('DELETE FROM "equipment_catalog_items" WHERE "id" = ANY($1)', [
					equipmentIds,
				]);
			}
			if (tripIds.length > 0)
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, `for-trip-${id}@example.com`, passwordHash, role, UserStatus.ACTIVE, `For Trip ${role}`]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createEquipment(hostId: string, status: EquipmentCatalogStatus): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "equipment_catalog_items"
				("id", "host_id", "name", "category", "quantity_total", "rental_price_per_day", "status")
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[id, hostId, "4-person tent", "shelter", 5, "50000.00", status]
		);
		equipmentIds.push(id);
		return id;
	}

	async function createTrip(host: Account): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			)`,
			[routeId, host.id, `For-trip route ${routeId}`, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			) VALUES (
				$1, $2, $3, 'For-trip integration Trip', 'day_trip', 0,
				'2035-10-10T01:00:00Z', '2035-10-10T10:00:00Z',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-10-09T01:00:00Z', 1, 5, 0, '500000.00', $4
			)`,
			[tripId, host.id, routeId, TripStatus.PUBLISHED]
		);
		return tripId;
	}

	it("lists only the Trip Host's active equipment, ordered by name", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host);
		await createEquipment(host.id, EquipmentCatalogStatus.INACTIVE);
		await createEquipment(host.id, EquipmentCatalogStatus.RETIRED);
		const activeId = await createEquipment(host.id, EquipmentCatalogStatus.ACTIVE);
		const otherHost = await createAccount(UserRole.HOST);
		await createEquipment(otherHost.id, EquipmentCatalogStatus.ACTIVE);

		const response = await request(app.getHttpServer())
			.get(`/api/equipment-catalog/for-trip/${tripId}`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(200);

		expect(response.body).toHaveLength(1);
		expect(response.body[0]).toMatchObject({ id: activeId, hostId: host.id, status: "active" });
	});

	it("requires authentication and Camper role", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createTrip(host);

		await request(app.getHttpServer()).get(`/api/equipment-catalog/for-trip/${tripId}`).expect(401);
		await request(app.getHttpServer())
			.get(`/api/equipment-catalog/for-trip/${tripId}`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(403);
	});

	it("returns 404 for a missing Trip", async () => {
		const camper = await createAccount(UserRole.CAMPER);

		await request(app.getHttpServer())
			.get(`/api/equipment-catalog/for-trip/${randomUUID()}`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(404);
	});
});
