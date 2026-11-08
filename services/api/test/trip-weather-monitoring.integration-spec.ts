import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { EventsGateway } from "../src/modules/realtime/events.gateway";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { OpenMeteoWeatherProvider } from "../src/modules/weather/providers/open-meteo-weather.provider";
import type { WeatherForecastHour } from "../src/modules/weather/providers/weather-provider.interface";
import { TripWeatherMonitorService } from "../src/modules/weather/services/trip-weather-monitor.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let forecastMode: "calm" | "stormy" = "calm";

/** Values depend only on the hour's position in the Trip window, so a calm re-check is identical. */
function fakeHours(from: Date, to: Date): WeatherForecastHour[] {
	const hours: WeatherForecastHour[] = [];
	const start = new Date(from.getTime());
	start.setUTCMinutes(0, 0, 0);
	for (let time = start.getTime(); time <= to.getTime(); time += HOUR_MS) {
		const index = hours.length;
		const storm = forecastMode === "stormy" && index === 3;
		hours.push({
			time: new Date(time),
			rainfallMm: storm ? 80 : 0,
			windKph: storm ? 90 : 5,
			temperatureC: 22,
			visibilityM: storm ? 200 : 20000,
			thunderstorm: storm,
			providerWeatherCode: storm ? 95 : 1,
		});
	}
	return hours;
}

describe("Trip weather monitoring (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let monitor: TripWeatherMonitorService;
	let emitSpy: jest.SpyInstance;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let createdRuleId: string | null = null;

	beforeAll(async () => {
		jest
			.spyOn(OpenMeteoWeatherProvider.prototype, "fetchHourlyForecast")
			.mockImplementation(async (_lat, _lon, from, to) => ({
				hours: fakeHours(from, to),
				raw: { fake: true },
			}));
		emitSpy = jest.spyOn(EventsGateway.prototype, "emitTripWeatherChanged");

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
		monitor = moduleRef.get(TripWeatherMonitorService);
		await assertSafeTestDatabase(dataSource);

		const active = await dataSource.query(
			`SELECT 1 FROM "weather_risk_rules" WHERE "is_active" = true LIMIT 1`
		);
		if (active.length === 0) {
			createdRuleId = randomUUID();
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
				[createdRuleId]
			);
		}
	}, 60_000);

	beforeEach(() => {
		forecastMode = "calm";
		emitSpy.mockClear();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				'UPDATE "trips" SET "submitted_weather_forecast_id" = NULL WHERE "id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query(
				'DELETE FROM "trip_weather_change_notices" WHERE "trip_id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query(
				'DELETE FROM "booking_members" WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1))',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (createdRuleId) {
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = $1', [createdRuleId]);
			}
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		jest.restoreAllMocks();
		await app?.close();
	});

	async function createAccount(role: UserRole): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Weather monitor user')`,
			[id, `weather-monitor-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createTrip(
		host: Account,
		options: { startsAt: Date; status: string; endsAt?: Date }
	): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Weather monitor route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		const endsAt = options.endsAt ?? new Date(options.startsAt.getTime() + 9 * HOUR_MS);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Trip theo dõi thời tiết', 'day_trip', 0, $4, $5,
			   ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $6, 1, 20, 0, 0, $7)`,
			[
				tripId,
				host.id,
				routeId,
				options.startsAt,
				endsAt,
				new Date(options.startsAt.getTime() - DAY_MS),
				options.status,
			]
		);
		tripIds.push(tripId);
		return tripId;
	}

	async function book(camper: Account, tripId: string, status: string): Promise<void> {
		const awaitingPayment = status === "pending_payment";
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status",
			   "payment_status", "hold_expires_at")
			 VALUES ($1, $2, $3, 1, 0, $4, $5, $6)`,
			[
				randomUUID(),
				tripId,
				camper.id,
				status,
				awaitingPayment ? "unpaid" : "not_required",
				awaitingPayment ? new Date(Date.now() + HOUR_MS) : null,
			]
		);
	}

	const forecastRows = (tripId: string) =>
		dataSource.query(
			`SELECT "id", "risk_level" AS "riskLevel", "provider_response" AS "raw",
			   "checked_at" AS "checkedAt", "created_at" AS "createdAt"
			 FROM "trip_weather_forecasts" WHERE "trip_id" = $1 ORDER BY "created_at"`,
			[tripId]
		) as Promise<
			Array<{ id: string; riskLevel: string; raw: unknown; checkedAt: Date; createdAt: Date }>
		>;

	const notices = (account: Account) =>
		request(app.getHttpServer())
			.get("/api/me/weather-notices")
			.set("Authorization", `Bearer ${account.accessToken}`);

	it("re-forecasts due Trips, records history only on change and notifies level changes to Host and booked Campers only", async () => {
		const host = await createAccount(UserRole.HOST);
		const confirmed = await createAccount(UserRole.CAMPER);
		const awaitingPayment = await createAccount(UserRole.CAMPER);
		const cancelled = await createAccount(UserRole.CAMPER);
		const stranger = await createAccount(UserRole.CAMPER);
		const admin = await createAccount(UserRole.ADMIN);
		const now = new Date();
		const tripId = await createTrip(host, {
			startsAt: new Date(now.getTime() + 5 * DAY_MS),
			status: "published",
		});
		await book(confirmed, tripId, "confirmed");
		await book(awaitingPayment, tripId, "pending_payment");
		await book(cancelled, tripId, "cancelled");

		// First run: the never-forecast Trip is due; the result is stored without raw provider data.
		await monitor.checkDueTrips(500, now);
		let rows = await forecastRows(tripId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ riskLevel: "green", raw: null });

		// One hour later the Trip (5 days out, daily cadence) is not due: nothing changes.
		await monitor.checkDueTrips(500, new Date(now.getTime() + HOUR_MS));
		expect((await forecastRows(tripId))[0].checkedAt).toEqual(rows[0].checkedAt);

		// A day later the same result only moves checked_at: still one history row, no notice.
		const dayLater = new Date(now.getTime() + 25 * HOUR_MS);
		await monitor.checkDueTrips(500, dayLater);
		rows = await forecastRows(tripId);
		expect(rows).toHaveLength(1);
		expect(new Date(rows[0].checkedAt).getTime()).toBe(dayLater.getTime());
		expect(emitSpy).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ tripId })
		);

		// The forecast turns Red: a new history row and one notice per eligible recipient.
		forecastMode = "stormy";
		const twoDaysLater = new Date(now.getTime() + 50 * HOUR_MS);
		await monitor.checkDueTrips(500, twoDaysLater);
		rows = await forecastRows(tripId);
		expect(rows.map((row) => row.riskLevel)).toEqual(["green", "red"]);

		const recipients = (
			(await dataSource.query(
				`SELECT "recipient_id" AS "id" FROM "trip_weather_change_notices" WHERE "trip_id" = $1`,
				[tripId]
			)) as Array<{ id: string }>
		).map((row) => row.id);
		expect(recipients.sort()).toEqual([host.id, confirmed.id, awaitingPayment.id].sort());
		const pushed = emitSpy.mock.calls.find(([, payload]) => payload.tripId === tripId);
		expect(pushed?.[0].sort()).toEqual([host.id, confirmed.id, awaitingPayment.id].sort());
		expect(pushed?.[1]).toMatchObject({ previousRiskLevel: "green", riskLevel: "red" });

		// A retried run at the same moment does not notify anyone twice.
		await monitor.checkDueTrips(500, twoDaysLater);
		const [{ count }] = await dataSource.query(
			`SELECT count(*)::int AS "count" FROM "trip_weather_change_notices" WHERE "trip_id" = $1`,
			[tripId]
		);
		expect(count).toBe(3);

		// The booked Camper reads the notice; strangers, cancelled Campers and Admins have none.
		const inbox = await notices(confirmed).expect(200);
		expect(inbox.body.unreadCount).toBe(1);
		expect(inbox.body.items[0]).toMatchObject({
			tripId,
			previousRiskLevel: "green",
			riskLevel: "red",
			worsened: true,
			readAt: null,
		});
		expect(inbox.body.items[0].message).toMatch(
			/^Cảnh báo sớm: dự báo ngày \d{2}\/\d{2} xấu đi \(Xanh → Đỏ\)/
		);
		for (const other of [stranger, cancelled, admin]) {
			expect((await notices(other).expect(200)).body).toEqual({ items: [], unreadCount: 0 });
		}

		const noticeId = inbox.body.items[0].id as string;
		await request(app.getHttpServer())
			.patch(`/api/me/weather-notices/${noticeId}/read`)
			.set("Authorization", `Bearer ${stranger.accessToken}`)
			.expect(404);
		const read = await request(app.getHttpServer())
			.patch(`/api/me/weather-notices/${noticeId}/read`)
			.set("Authorization", `Bearer ${confirmed.accessToken}`)
			.expect(200);
		expect(read.body.readAt).not.toBeNull();
		expect((await notices(confirmed).expect(200)).body.unreadCount).toBe(0);

		// History: newest first, visible to Campers on a published Trip and to the Host.
		const history = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/history`)
			.set("Authorization", `Bearer ${stranger.accessToken}`)
			.expect(200);
		expect(history.body.map((row: { riskLevel: string }) => row.riskLevel)).toEqual([
			"red",
			"green",
		]);
		expect(history.body[1].checkedAt).toBeDefined();
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/history`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
	}, 60_000);

	it("checks a Trip within 3 days every 6 hours", async () => {
		const host = await createAccount(UserRole.HOST);
		const now = new Date();
		const tripId = await createTrip(host, {
			startsAt: new Date(now.getTime() + 2 * DAY_MS),
			status: "published",
		});
		await monitor.checkDueTrips(500, now);
		const first = (await forecastRows(tripId))[0];
		await monitor.checkDueTrips(500, new Date(now.getTime() + 5 * HOUR_MS));
		expect((await forecastRows(tripId))[0].checkedAt).toEqual(first.checkedAt);
		const sixHoursLater = new Date(now.getTime() + 6 * HOUR_MS + 60_000);
		await monitor.checkDueTrips(500, sixHoursLater);
		expect(new Date((await forecastRows(tripId))[0].checkedAt).getTime()).toBe(
			sixHoursLater.getTime()
		);
	}, 60_000);

	it("hides the history of an unpublished Trip from Campers", async () => {
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host, {
			startsAt: new Date(Date.now() + 5 * DAY_MS),
			status: "draft",
		});
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/history`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(404);
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/history`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
	});

	it("trims the history of Trips that ended over 30 days ago but keeps the submitted forecast", async () => {
		const host = await createAccount(UserRole.HOST);
		const startsAt = new Date(Date.now() - 40 * DAY_MS);
		const tripId = await createTrip(host, { startsAt, status: "completed" });
		const ids = [randomUUID(), randomUUID(), randomUUID()];
		for (const id of ids) {
			await dataSource.query(
				`INSERT INTO "trip_weather_forecasts" ("id", "trip_id", "route_id", "status",
				   "trip_starts_at", "trip_ends_at", "created_by")
				 SELECT $1, "id", "route_id", 'out_of_range', "starts_at", "ends_at", "host_id"
				 FROM "trips" WHERE "id" = $2`,
				[id, tripId]
			);
		}
		await dataSource.query(
			`UPDATE "trips" SET "submitted_weather_forecast_id" = $2 WHERE "id" = $1`,
			[tripId, ids[1]]
		);

		await monitor.trimEndedTripHistory();

		const left = await dataSource.query(
			`SELECT "id" FROM "trip_weather_forecasts" WHERE "trip_id" = $1`,
			[tripId]
		);
		expect(left).toEqual([{ id: ids[1] }]);
	});
});
