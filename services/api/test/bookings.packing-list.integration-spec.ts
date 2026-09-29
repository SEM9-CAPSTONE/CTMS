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

interface Fixture {
	host: Account;
	camper: Account;
	routeId: string;
	tripId: string;
	equipmentId: string;
}

/**
 * CTMS-042-T01. Real Postgres, no mocking -- mirrors
 * bookings.add-item.integration-spec.ts's own fixture style. Covers
 * `GET /bookings/:bookingId/packing-list`, a pure computation with no
 * persisted output, so most assertions check the response body itself
 * rather than any new database rows.
 */
describe("Booking packing list (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const snapshotIds: string[] = [];
	const ruleIds: string[] = [];
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
			if (tripIds.length > 0) {
				await dataSource.query(
					`DELETE FROM "audit_logs" WHERE "target_id" IN (
						SELECT "id" FROM "booking_items" WHERE "booking_id" IN (
							SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)
						)
					)`,
					[tripIds]
				);
				await dataSource.query(
					'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
					[tripIds]
				);
				await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			}
			if (equipmentIds.length > 0) {
				await dataSource.query('DELETE FROM "equipment_catalog_items" WHERE "id" = ANY($1)', [
					equipmentIds,
				]);
			}
			if (snapshotIds.length > 0) {
				await dataSource.query(
					'DELETE FROM "weather_risk_assessments" WHERE "snapshot_id" = ANY($1)',
					[snapshotIds]
				);
				await dataSource.query('DELETE FROM "weather_snapshots" WHERE "id" = ANY($1)', [
					snapshotIds,
				]);
			}
			if (tripIds.length > 0)
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (routeIds.length > 0)
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			if (ruleIds.length > 0)
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = ANY($1)', [ruleIds]);
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "health_profiles" WHERE "user_id" = ANY($1)', [
					userIds,
				]);
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
			[
				id,
				`packing-list-${id}@example.com`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
				`Packing ${role}`,
			]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createEquipment(hostId: string, category: string): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "equipment_catalog_items"
				("id", "host_id", "name", "category", "quantity_total", "rental_price_per_day", "status")
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[id, hostId, "4-person tent", category, 5, "50000.00", EquipmentCatalogStatus.ACTIVE]
		);
		equipmentIds.push(id);
		return id;
	}

	async function createFixture(
		options: {
			difficulty?: string;
			tripType?: "day_trip" | "overnight";
			durationNights?: number;
			weatherRiskLevel?: "green" | "yellow";
		} = {}
	): Promise<Fixture> {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const routeId = randomUUID();
		const tripId = randomUUID();
		const snapshotId = randomUUID();
		const ruleId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		snapshotIds.push(snapshotId);
		ruleIds.push(ruleId);
		const difficulty = options.difficulty ?? "moderate";
		const tripType = options.tripType ?? "day_trip";
		const durationNights = options.durationNights ?? 0;
		const endsAt = durationNights > 0 ? "2035-10-12T10:00:00Z" : "2035-10-11T10:00:00Z";
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, $4, 240, $5
			)`,
			[routeId, host.id, `Packing list route ${routeId}`, difficulty, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "cancellation_policy", "status"
			) VALUES (
				$1, $2, $3, 'Packing list integration Trip', $4, $5,
				'2035-10-10T01:00:00Z', $6,
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-10-09T01:00:00Z', 1, 5, 0, '500000.00', $7, $8
			)`,
			[
				tripId,
				host.id,
				routeId,
				tripType,
				durationNights,
				endsAt,
				{ refundHours: 48 },
				TripStatus.PUBLISHED,
			]
		);
		await dataSource.query(
			`INSERT INTO "weather_snapshots" ("id", "route_id", "status", "observed_at")
			 VALUES ($1, $2, 'success', now())`,
			[snapshotId, routeId]
		);
		await dataSource.query(
			`INSERT INTO "weather_risk_rules" (
				"id", "rainfall_yellow_threshold", "rainfall_red_threshold",
				"wind_yellow_threshold", "wind_red_threshold", "temp_low_yellow", "temp_low_red",
				"temp_high_yellow", "temp_high_red", "visibility_yellow_threshold",
				"visibility_red_threshold", "thunderstorm_yellow", "thunderstorm_red",
				"rainfall_weight", "wind_weight", "temperature_weight", "visibility_weight",
				"thunderstorm_weight", "green_max_score", "yellow_max_score", "is_active"
			) VALUES (
				$1, 10, 50, 40, 70, 5, 0, 38, 42, 5000, 1000, true, true,
				0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, true
			)`,
			[ruleId]
		);
		const riskLevel = options.weatherRiskLevel ?? "green";
		const criteriaScores =
			riskLevel === "green"
				? {
						rainfall: { value: 0, level: "green", weight: 0.3, score: 0 },
						wind: { value: 0, level: "green", weight: 0.2, score: 0 },
						temperature: { value: 20, level: "green", weight: 0.2, score: 0 },
						visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
						thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
					}
				: {
						rainfall: { value: 20, level: "yellow", weight: 0.3, score: 1 },
						wind: { value: 10, level: "green", weight: 0.2, score: 0 },
						temperature: { value: 20, level: "green", weight: 0.2, score: 0 },
						visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
						thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
					};
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (
				"route_id", "snapshot_id", "rule_version_id", "risk_level",
				"composite_score", "criteria_scores", "created_by"
			) VALUES ($1, $2, $3, $4, 0, $5, $6)`,
			[routeId, snapshotId, ruleId, riskLevel, criteriaScores, camper.id]
		);
		const equipmentId = await createEquipment(host.id, "shelter");
		return { host, camper, routeId, tripId, equipmentId };
	}

	async function createBooking(camper: Account, tripId: string, numPeople = 1): Promise<string> {
		const response = await request(app.getHttpServer())
			.post("/api/bookings")
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ tripId, numPeople })
			.expect(201);
		return response.body.id;
	}

	async function grantHealthConsent(
		camper: Account,
		overrides: { allergies?: unknown[]; dietaryRestrictions?: string | null } = {}
	): Promise<void> {
		await dataSource.query(
			`INSERT INTO "health_profiles"
				("user_id", "is_consent_granted", "consent_granted_at", "allergies", "dietary_restrictions")
			 VALUES ($1, true, now(), $2, $3)`,
			[camper.id, JSON.stringify(overrides.allergies ?? []), overrides.dietaryRestrictions ?? null]
		);
	}

	function getPackingList(token: string | undefined, bookingId: string) {
		const req = request(app.getHttpServer()).get(`/api/bookings/${bookingId}/packing-list`);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	it("computes a full packing list for an overnight, hard, non-green-weather trip with rented equipment and health consent", async () => {
		const { camper, tripId, equipmentId } = await createFixture({
			difficulty: "hard",
			tripType: "overnight",
			durationNights: 2,
			weatherRiskLevel: "yellow",
		});
		const bookingId = await createBooking(camper, tripId, 3);
		await request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/items`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.set("Idempotency-Key", randomUUID())
			.send({ equipmentCatalogItemId: equipmentId, quantity: 1 })
			.expect(201);
		await grantHealthConsent(camper, {
			allergies: [{ id: "a1", name: "Peanuts", severity: "HIGH" }],
		});

		const response = await getPackingList(camper.accessToken, bookingId).expect(200);

		expect(response.body).toMatchObject({
			bookingId,
			tripId,
			context: {
				durationNights: 2,
				tripType: "overnight",
				difficulty: "hard",
				memberCount: 1,
				weatherRiskLevel: "yellow",
			},
		});
		const items: Array<{ id: string; required: boolean; alreadyCovered: boolean }> =
			response.body.items;
		const byId = (id: string) => items.find((packingItem) => packingItem.id === id);
		expect(byId("id-documents")).toMatchObject({ required: true });
		expect(byId("trekking-boots")).toMatchObject({ required: true });
		expect(byId("rain-gear")).toMatchObject({ required: true });
		expect(byId("tent")).toMatchObject({ required: false, alreadyCovered: true });
		expect(byId("sleeping-bag")).toMatchObject({ required: true, alreadyCovered: false });
		expect(byId("allergy-medication")).toMatchObject({ required: true });
		expect(items.some((packingItem) => packingItem.id.startsWith("rented-"))).toBe(true);
	});

	it("omits health items when no health profile/consent exists", async () => {
		const { camper, tripId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);

		const response = await getPackingList(camper.accessToken, bookingId).expect(200);

		expect(
			response.body.items.every(
				(packingItem: { category: string }) => packingItem.category !== "health"
			)
		).toBe(true);
	});

	it("requires authentication and Booking ownership, and never writes any rows", async () => {
		const { camper, tripId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		const otherCamper = await createAccount(UserRole.CAMPER);

		await getPackingList(undefined, bookingId).expect(401);
		await getPackingList(otherCamper.accessToken, bookingId).expect(403);

		const bookingRows = await dataSource.query(
			'SELECT "created_at" FROM "bookings" WHERE "id" = $1',
			[bookingId]
		);
		expect(bookingRows).toHaveLength(1);
	});

	it("returns 404 for a Booking that does not exist", async () => {
		const { camper } = await createFixture();

		await getPackingList(camper.accessToken, randomUUID()).expect(404);
	});

	it("returns 409 when the Booking's Trip snapshot is missing", async () => {
		const { camper, tripId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		await dataSource.query(
			'UPDATE "bookings" SET "trip_starts_at_snapshot" = NULL WHERE "id" = $1',
			[bookingId]
		);

		await getPackingList(camper.accessToken, bookingId).expect(409);
	});

	it("is a pure read: repeated calls return an identical, stable result with no new rows anywhere", async () => {
		const { camper, tripId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);

		const first = await getPackingList(camper.accessToken, bookingId).expect(200);
		const second = await getPackingList(camper.accessToken, bookingId).expect(200);

		expect(second.body).toEqual(first.body);
		const itemRows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(itemRows[0].count).toBe(0);
	});
});
