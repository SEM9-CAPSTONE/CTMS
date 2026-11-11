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
	tripId: string;
	equipmentId: string;
}

/**
 * CTMS-040-T01. Real Postgres, no mocking -- mirrors
 * bookings.create.integration-spec.ts's own fixture style. Covers
 * `POST /bookings/:bookingId/items` and `GET /bookings/:bookingId/items`,
 * the equipment-rental add-on this story builds on top of CTMS-029's
 * already-merged Booking creation and CTMS-039's equipment catalog.
 */
describe("Booking equipment items (integration, real Postgres)", () => {
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
			[id, `booking-item-${id}@example.com`, passwordHash, role, UserStatus.ACTIVE, `Item ${role}`]
		);
		await dataSource.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createEquipment(
		hostId: string,
		overrides: { quantityTotal?: number; status?: EquipmentCatalogStatus } = {}
	): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "equipment_catalog_items"
				("id", "host_id", "name", "category", "quantity_total", "rental_price_per_day", "status")
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				id,
				hostId,
				"4-person tent",
				"shelter",
				overrides.quantityTotal ?? 5,
				"50000.00",
				overrides.status ?? EquipmentCatalogStatus.ACTIVE,
			]
		);
		equipmentIds.push(id);
		return id;
	}

	async function createFixture(options: { host?: Account } = {}): Promise<Fixture> {
		const host = options.host ?? (await createAccount(UserRole.HOST));
		const camper = await createAccount(UserRole.CAMPER);
		const routeId = randomUUID();
		const tripId = randomUUID();
		const snapshotId = randomUUID();
		const ruleId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		snapshotIds.push(snapshotId);
		ruleIds.push(ruleId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			) VALUES (
				$1, $2, $3,
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
				3500, 'moderate', 240, $4
			)`,
			[routeId, host.id, `Booking item route ${routeId}`, TrekkingRouteStatus.ACTIVE]
		);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "cancellation_policy", "status"
			) VALUES (
				$1, $2, $3, 'Booking item integration Trip', 'day_trip', 0,
				'2035-10-10T01:00:00Z', '2035-10-11T10:00:00Z',
				ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
				'2035-10-09T01:00:00Z', 1, 5, 0, '500000.00', $4, $5
			)`,
			[tripId, host.id, routeId, { refundHours: 48 }, TripStatus.PUBLISHED]
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
		await dataSource.query(
			`INSERT INTO "weather_risk_assessments" (
				"route_id", "snapshot_id", "rule_version_id", "risk_level",
				"composite_score", "criteria_scores", "created_by"
			) VALUES ($1, $2, $3, 'green', 0, $4, $5)`,
			[
				routeId,
				snapshotId,
				ruleId,
				{
					rainfall: { value: 0, level: "green", weight: 0.3, score: 0 },
					wind: { value: 0, level: "green", weight: 0.2, score: 0 },
					temperature: { value: 20, level: "green", weight: 0.2, score: 0 },
					visibility: { value: 10000, level: "green", weight: 0.15, score: 0 },
					thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
				},
				camper.id,
			]
		);
		const equipmentId = await createEquipment(host.id);
		return { host, camper, tripId, equipmentId };
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

	function addItem(
		token: string | undefined,
		bookingId: string,
		idempotencyKey: string,
		body: object
	) {
		const req = request(app.getHttpServer())
			.post(`/api/bookings/${bookingId}/items`)
			.set("Idempotency-Key", idempotencyKey);
		return token ? req.set("Authorization", `Bearer ${token}`).send(body) : req.send(body);
	}

	function listItems(token: string, bookingId: string) {
		return request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}/items`)
			.set("Authorization", `Bearer ${token}`);
	}

	it("adds an equipment item, snapshots price, and recalculates the Booking total", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId, 2);

		const response = await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 2,
		}).expect(201);

		expect(response.body.item).toMatchObject({
			bookingId,
			equipmentCatalogItemId: equipmentId,
			quantity: 2,
			unitPrice: "50000.00",
			rentalDays: 2,
			totalPrice: "200000.00",
		});
		expect(response.body.booking).toMatchObject({ id: bookingId, totalAmount: "1200000.00" });

		const itemRows = await dataSource.query(
			'SELECT "quantity", "total_price" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(itemRows).toHaveLength(1);
		const reservationRows = await dataSource.query(
			'SELECT "quantity", "rental_start_date", "rental_end_date" FROM "equipment_reservations" WHERE "booking_item_id" = $1',
			[response.body.item.id]
		);
		expect(reservationRows[0]).toMatchObject({ quantity: 2 });

		const auditRows = await dataSource.query(
			'SELECT "action" FROM "audit_logs" WHERE "target_id" = $1',
			[response.body.item.id]
		);
		expect(auditRows).toEqual([{ action: "booking_item.added" }]);

		const listResponse = await listItems(camper.accessToken, bookingId).expect(200);
		expect(listResponse.body).toHaveLength(1);
	});

	it("requires authentication and Booking ownership, with no writes", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		const otherCamper = await createAccount(UserRole.CAMPER);

		await addItem(undefined, bookingId, randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 1,
		}).expect(401);
		await addItem(otherCamper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 1,
		}).expect(403);
		await listItems(otherCamper.accessToken, bookingId).expect(403);

		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(rows[0].count).toBe(0);
	});

	it("returns 404 for a missing Booking or a missing Equipment catalog item", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);

		await addItem(camper.accessToken, randomUUID(), randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 1,
		}).expect(404);
		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: randomUUID(),
			quantity: 1,
		}).expect(404);
	});

	it("rejects inactive equipment and equipment from a different Host, with no writes", async () => {
		const { host, camper, tripId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		const inactiveEquipmentId = await createEquipment(host.id, {
			status: EquipmentCatalogStatus.INACTIVE,
		});
		const otherHost = await createAccount(UserRole.HOST);
		const otherHostEquipmentId = await createEquipment(otherHost.id);

		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: inactiveEquipmentId,
			quantity: 1,
		}).expect(422);
		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: otherHostEquipmentId,
			quantity: 1,
		}).expect(422);

		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(rows[0].count).toBe(0);
	});

	it("rejects a quantity that would exceed remaining availability, with no writes", async () => {
		const { host, camper, tripId } = await createFixture({});
		const scarceEquipmentId = await createEquipment(host.id, { quantityTotal: 1 });
		const bookingId = await createBooking(camper, tripId);

		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: scarceEquipmentId,
			quantity: 1,
		}).expect(201);

		const secondCamper = await createAccount(UserRole.CAMPER);
		const secondBookingId = await createBooking(secondCamper, tripId);
		await addItem(secondCamper.accessToken, secondBookingId, randomUUID(), {
			equipmentCatalogItemId: scarceEquipmentId,
			quantity: 1,
		}).expect(409);

		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "equipment_catalog_item_id" = $1',
			[scarceEquipmentId]
		);
		expect(rows[0].count).toBe(1);
	});

	it("serializes concurrent adds and never exceeds quantity_total", async () => {
		const { host, camper, tripId } = await createFixture({});
		const scarceEquipmentId = await createEquipment(host.id, { quantityTotal: 1 });
		const firstBookingId = await createBooking(camper, tripId);
		const secondCamper = await createAccount(UserRole.CAMPER);
		const secondBookingId = await createBooking(secondCamper, tripId);

		const [first, second] = await Promise.all([
			addItem(camper.accessToken, firstBookingId, randomUUID(), {
				equipmentCatalogItemId: scarceEquipmentId,
				quantity: 1,
			}),
			addItem(secondCamper.accessToken, secondBookingId, randomUUID(), {
				equipmentCatalogItemId: scarceEquipmentId,
				quantity: 1,
			}),
		]);

		expect([first.status, second.status].sort()).toEqual([201, 409]);
		const rows = await dataSource.query(
			'SELECT COALESCE(SUM("quantity"), 0)::int AS "total" FROM "equipment_reservations" WHERE "equipment_catalog_item_id" = $1',
			[scarceEquipmentId]
		);
		expect(rows[0].total).toBe(1);
	});

	it("rejects adding items to a cancelled Booking, with no writes", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		await dataSource.query('UPDATE "bookings" SET "status" = $2 WHERE "id" = $1', [
			bookingId,
			"cancelled",
		]);

		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 1,
		}).expect(409);
	});

	it("rejects a non-positive quantity without creating a record", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);

		await addItem(camper.accessToken, bookingId, randomUUID(), {
			equipmentCatalogItemId: equipmentId,
			quantity: 0,
		}).expect(422);

		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(rows[0].count).toBe(0);
	});

	it("replays the same Idempotency-Key without creating a second item", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		const key = randomUUID();
		const payload = { equipmentCatalogItemId: equipmentId, quantity: 1 };

		const first = await addItem(camper.accessToken, bookingId, key, payload).expect(201);
		const second = await addItem(camper.accessToken, bookingId, key, payload).expect(201);

		expect(second.body.item.id).toBe(first.body.item.id);
		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(rows[0].count).toBe(1);
	});

	it("returns 409 for the same Idempotency-Key reused with a different payload", async () => {
		const { camper, tripId, equipmentId } = await createFixture();
		const bookingId = await createBooking(camper, tripId);
		const key = randomUUID();

		await addItem(camper.accessToken, bookingId, key, {
			equipmentCatalogItemId: equipmentId,
			quantity: 1,
		}).expect(201);
		await addItem(camper.accessToken, bookingId, key, {
			equipmentCatalogItemId: equipmentId,
			quantity: 2,
		}).expect(409);

		const rows = await dataSource.query(
			'SELECT COUNT(*)::int AS "count" FROM "booking_items" WHERE "booking_id" = $1',
			[bookingId]
		);
		expect(rows[0].count).toBe(1);
	});
});
