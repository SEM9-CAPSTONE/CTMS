import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { HttpWeatherAdviceProvider } from "../src/modules/weather/providers/http-weather-advice.provider";
import { OpenMeteoWeatherProvider } from "../src/modules/weather/providers/open-meteo-weather.provider";
import type { WeatherForecastHour } from "../src/modules/weather/providers/weather-provider.interface";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trip day N days from today, 01:00–10:00 UTC. */
function schedule(daysAhead: number): { startsAt: string; endsAt: string; deadline: string } {
	const day = new Date();
	day.setUTCHours(0, 0, 0, 0);
	const start = new Date(day.getTime() + daysAhead * DAY_MS + 1 * 60 * 60 * 1000);
	const end = new Date(day.getTime() + daysAhead * DAY_MS + 10 * 60 * 60 * 1000);
	const deadline = new Date(start.getTime() - 12 * 60 * 60 * 1000);
	return {
		startsAt: start.toISOString(),
		endsAt: end.toISOString(),
		deadline: deadline.toISOString(),
	};
}

/** Hours the fake provider returns; `stormy` controls the worst hour. */
let forecastMode: "calm" | "stormy" = "calm";

function fakeHours(from: Date, to: Date): WeatherForecastHour[] {
	const hours: WeatherForecastHour[] = [];
	const start = new Date(from.getTime());
	start.setUTCMinutes(0, 0, 0);
	for (let time = start.getTime(); time <= to.getTime(); time += 60 * 60 * 1000) {
		const index = hours.length;
		const stormyHour = forecastMode === "stormy" && index === 3;
		hours.push({
			time: new Date(time),
			rainfallMm: stormyHour ? 80 : 0.1 * index,
			windKph: stormyHour ? 90 : 5 + index,
			temperatureC: 22 + (index % 3),
			visibilityM: stormyHour ? 200 : 20000 - index * 100,
			thunderstorm: stormyHour,
			providerWeatherCode: stormyHour ? 95 : 1,
		});
	}
	return hours;
}

describe("Trip weather forecast over the Trip schedule (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let forecastSpy: jest.SpyInstance;
	let adviceSpy: jest.SpyInstance;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let createdRuleId: string | null = null;

	beforeAll(async () => {
		forecastSpy = jest
			.spyOn(OpenMeteoWeatherProvider.prototype, "fetchHourlyForecast")
			.mockImplementation(async (_lat, _lon, from, to) => ({
				hours: fakeHours(from, to),
				raw: { fake: true },
			}));
		adviceSpy = jest
			.spyOn(HttpWeatherAdviceProvider.prototype, "generate")
			.mockResolvedValue({ adviceText: "Mang áo mưa.", actions: ["Theo dõi dự báo"] });

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

		// Other suites clean up weather rules; make sure one active rule exists.
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
		forecastSpy.mockClear();
		adviceSpy.mockClear();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const targets = [...tripIds, ...userIds];
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)',
				[targets, userIds]
			);
			await dataSource.query(
				'UPDATE "trips" SET "submitted_weather_forecast_id" = NULL WHERE "id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
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
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Trip weather user')`,
			[id, `trip-weather-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createDraftTrip(host: Account, daysAhead: number): Promise<string> {
		const routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Trip weather route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		const { startsAt, endsAt, deadline } = schedule(daysAhead);
		const response = await request(app.getHttpServer())
			.post("/api/trips")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({
				routeId,
				title: "Trip weather trip",
				tripType: "day_trip",
				startsAt,
				endsAt,
				meetingPoint: { type: "Point", coordinates: [108.2208, 16.0471] },
				bookingDeadline: deadline,
				capacityMin: 1,
				capacityMax: 10,
				pricePerPerson: 0,
				waypoints: [
					{
						type: "start",
						name: "Trailhead",
						location: { type: "Point", coordinates: [108.2208, 16.0471] },
						plannedAt: startsAt,
					},
					{
						type: "finish",
						name: "Exit",
						location: { type: "Point", coordinates: [108.2508, 16.0671] },
						plannedAt: endsAt,
					},
				],
			})
			.expect(201);
		tripIds.push(response.body.id);
		return response.body.id;
	}

	const forecast = (account: Account, tripId: string) =>
		request(app.getHttpServer())
			.post(`/api/trips/${tripId}/weather-forecast`)
			.set("Authorization", `Bearer ${account.accessToken}`);
	const submit = (account: Account, tripId: string, body: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post(`/api/trips/${tripId}/submit`)
			.set("Authorization", `Bearer ${account.accessToken}`)
			.send(body);

	it("forecasts the Trip day (not today), scores the worst hour and reuses a recent result", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host, 3);
		const { startsAt, endsAt } = schedule(3);

		const first = await forecast(host, tripId).expect(200);
		expect(first.body).toMatchObject({
			status: "available",
			riskLevel: "green",
			coversWholeTrip: true,
			forecastFrom: startsAt,
		});
		expect(first.body.worstReading).toMatchObject({ hoursCovered: 10, thunderstorm: false });
		const [, , from, to] = forecastSpy.mock.calls[0] as [number, number, Date, Date];
		expect(from.toISOString()).toBe(startsAt);
		expect(to.toISOString()).toBe(endsAt);

		const second = await forecast(host, tripId).expect(200);
		expect(second.body.id).toBe(first.body.id);
		expect(forecastSpy).toHaveBeenCalledTimes(1);
	});

	it("marks a Trip beyond the 15-day horizon as out of range without calling the provider", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host, 30);

		const response = await forecast(host, tripId).expect(200);
		expect(response.body).toMatchObject({
			status: "out_of_range",
			riskLevel: null,
			horizonDays: 15,
		});
		expect(forecastSpy).not.toHaveBeenCalled();

		await submit(host, tripId).expect(200);
		const rows = await dataSource.query(
			'SELECT "submitted_weather_forecast_id" AS "id" FROM "trips" WHERE "id" = $1',
			[tripId]
		);
		expect(rows[0].id).toBe(response.body.id);
	});

	it("requires acknowledgement to submit a Red forecast and shows it to the Admin", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const tripId = await createDraftTrip(host, 2);
		forecastMode = "stormy";

		const red = await forecast(host, tripId).expect(200);
		expect(red.body.riskLevel).toBe("red");
		expect(red.body.worstReading).toMatchObject({
			rainfallMm: 80,
			windKph: 90,
			thunderstorm: true,
		});

		await submit(host, tripId).expect(422);
		await submit(host, tripId, { acknowledgeWeatherRisk: true }).expect(200);

		const pending = await request(app.getHttpServer())
			.get("/api/trips/pending-review")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		const listed = pending.body.find((trip: { id: string }) => trip.id === tripId);
		expect(listed.submittedWeatherForecast).toEqual({
			id: red.body.id,
			status: "available",
			riskLevel: "red",
			riskAcknowledged: true,
		});

		const submitted = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/submitted`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(submitted.body.id).toBe(red.body.id);

		const audit = await dataSource.query(
			`SELECT "after" FROM "audit_logs" WHERE "target_id" = $1 AND "action" = 'trip.submitted_for_approval'`,
			[tripId]
		);
		expect(audit[0].after.weatherForecast).toEqual({
			forecastId: red.body.id,
			status: "available",
			riskLevel: "red",
			acknowledged: true,
		});
	});

	it("submits Green and Yellow without acknowledgement and still submits when no forecast exists", async () => {
		const host = await createAccount(UserRole.HOST);
		const green = await createDraftTrip(host, 4);
		await forecast(host, green).expect(200);
		await submit(host, green).expect(200);

		const noForecast = await createDraftTrip(host, 5);
		await submit(host, noForecast).expect(200);
		const rows = await dataSource.query(
			'SELECT "submitted_weather_forecast_id" AS "id" FROM "trips" WHERE "id" = $1',
			[noForecast]
		);
		expect(rows[0].id).toBeNull();
	});

	it("rejects submitting with a forecast made for an older schedule", async () => {
		const host = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host, 3);
		await forecast(host, tripId).expect(200);
		const shifted = schedule(4);
		await dataSource.query('UPDATE "trips" SET "starts_at" = $2, "ends_at" = $3 WHERE "id" = $1', [
			tripId,
			shifted.startsAt,
			shifted.endsAt,
		]);
		await dataSource.query(
			`UPDATE "trip_waypoints" SET "planned_at" = CASE WHEN "type" = 'start' THEN $2::timestamptz ELSE $3::timestamptz END WHERE "trip_id" = $1`,
			[tripId, shifted.startsAt, shifted.endsAt]
		);

		const response = await submit(host, tripId).expect(422);
		expect(JSON.stringify(response.body)).toContain("weatherForecast");
	});

	it("generates advice once per forecast and enforces ownership", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const tripId = await createDraftTrip(host, 3);

		await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/weather-forecast/advice`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(409);
		await forecast(host, tripId).expect(200);
		const advice = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/weather-forecast/advice`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(advice.body.advice).toMatchObject({
			text: "Mang áo mưa.",
			actions: ["Theo dõi dự báo"],
		});
		await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/weather-forecast/advice`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(adviceSpy).toHaveBeenCalledTimes(1);

		await forecast(otherHost, tripId).expect(403);
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/latest`)
			.set("Authorization", `Bearer ${otherHost.accessToken}`)
			.expect(403);
	});
});
