import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { RiskLevel } from "../src/modules/weather/entities/weather-risk-assessment.entity";
import { OpenMeteoWeatherProvider } from "../src/modules/weather/providers/open-meteo-weather.provider";
import type { WeatherForecastHour } from "../src/modules/weather/providers/weather-provider.interface";
import {
	HttpWeatherRiskReviewProvider,
	WeatherRiskReviewError,
} from "../src/modules/weather/providers/weather-risk-review.provider";
import { TripWeatherForecastsRepository } from "../src/modules/weather/repositories/trip-weather-forecasts.repository";
import {
	TripWeatherAiReviewService,
	WEATHER_AI_REVIEW_MAX_ATTEMPTS,
} from "../src/modules/weather/services/trip-weather-ai-review.service";
import { TripWeatherMonitorService } from "../src/modules/weather/services/trip-weather-monitor.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Every Trip in this suite gets a stormy hour, so the thresholds always say Red. */
function stormyHours(from: Date, to: Date): WeatherForecastHour[] {
	const hours: WeatherForecastHour[] = [];
	const start = new Date(from.getTime());
	start.setUTCMinutes(0, 0, 0);
	for (let time = start.getTime(); time <= to.getTime(); time += HOUR_MS) {
		const storm = hours.length === 2;
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

describe("Hybrid weather risk AI review (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let monitor: TripWeatherMonitorService;
	let aiReview: TripWeatherAiReviewService;
	let reviewSpy: jest.SpyInstance;
	let forecasts: TripWeatherForecastsRepository;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let createdRuleId: string | null = null;

	beforeAll(async () => {
		jest
			.spyOn(OpenMeteoWeatherProvider.prototype, "fetchHourlyForecast")
			.mockImplementation(async (_lat, _lon, from, to) => ({
				hours: stormyHours(from, to),
				raw: { fake: true },
			}));
		jest.spyOn(HttpWeatherRiskReviewProvider.prototype, "isConfigured").mockReturnValue(true);
		reviewSpy = jest.spyOn(HttpWeatherRiskReviewProvider.prototype, "review");

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
		aiReview = moduleRef.get(TripWeatherAiReviewService);
		forecasts = moduleRef.get(TripWeatherForecastsRepository);
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
		reviewSpy.mockReset();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query(
				'DELETE FROM "trip_weather_change_notices" WHERE "trip_id" = ANY($1)',
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
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'AI review user')`,
			[id, `weather-ai-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createForecastTrip(host: Account, now: Date): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'AI review route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		const startsAt = new Date(now.getTime() + 2 * DAY_MS);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Trip đánh giá kết hợp', 'day_trip', 0, $4, $5,
			   ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $6, 1, 20, 0, 0, 'published')`,
			[
				tripId,
				host.id,
				routeId,
				startsAt,
				new Date(startsAt.getTime() + 9 * HOUR_MS),
				new Date(startsAt.getTime() - DAY_MS),
			]
		);
		tripIds.push(tripId);
		await monitor.checkDueTrips(500, now);
		return tripId;
	}

	const aiColumns = async (tripId: string) =>
		(
			(await dataSource.query(
				`SELECT "id", "risk_level" AS "riskLevel", "ai_risk_level" AS "aiRiskLevel",
				   "ai_reason" AS "aiReason", "ai_model" AS "aiModel",
				   "ai_review_attempts" AS "attempts", "ai_review_acknowledged_by" AS "acknowledgedBy"
				 FROM "trip_weather_forecasts" WHERE "trip_id" = $1
				 ORDER BY "created_at" DESC LIMIT 1`,
				[tripId]
			)) as Array<{
				id: string;
				riskLevel: string;
				aiRiskLevel: string | null;
				aiReason: string | null;
				aiModel: string | null;
				attempts: number;
				acknowledgedBy: string | null;
			}>
		)[0];

	const mismatches = (account: Account) =>
		request(app.getHttpServer())
			.get("/api/admin/weather/ai-mismatches")
			.set("Authorization", `Bearer ${account.accessToken}`);

	it("stores an AI opinion, lists the disagreement for Admins only and lets them mark it as seen", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		const now = new Date();
		const tripId = await createForecastTrip(host, now);
		expect((await aiColumns(tripId)).riskLevel).toBe("red");

		reviewSpy.mockResolvedValue({
			level: RiskLevel.GREEN,
			reason: "Chỉ một giờ mưa ngắn, phần lớn thời gian trời đẹp.",
			confidence: 0.65,
			model: "gpt-4o-mini",
		});
		await aiReview.reviewPending(now, 500);
		expect(reviewSpy).toHaveBeenCalledWith(
			expect.objectContaining({ rainfallMm: 80, windKph: 90, thunderstorm: true })
		);
		const row = await aiColumns(tripId);
		expect(row).toMatchObject({ riskLevel: "red", aiRiskLevel: "green", aiModel: "gpt-4o-mini" });

		// A reviewed forecast leaves the queue, so the AI is not asked again for it.
		const queue = await forecasts.findPendingAiReviews(now, 500, WEATHER_AI_REVIEW_MAX_ATTEMPTS);
		expect(queue.some((forecast) => forecast.id === row.id)).toBe(false);

		const listed = (await mismatches(admin).expect(200)).body as Array<Record<string, unknown>>;
		expect(listed.find((item) => item.tripId === tripId)).toMatchObject({
			forecastId: row.id,
			riskLevel: "red",
			aiRiskLevel: "green",
			gap: 2,
			hostName: "AI review user",
		});
		await mismatches(host).expect(403);

		// Host sees the opinion on the Trip forecast; travellers only ever see the official level.
		const latest = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/latest`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(latest.body).toMatchObject({
			riskLevel: "red",
			aiReview: { level: "green", matchesRule: false, acknowledgedAt: null },
		});
		const history = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/weather-forecast/history`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.expect(200);
		expect(history.body[0].aiReview).toBeNull();

		const ack = await request(app.getHttpServer())
			.post(`/api/admin/weather/ai-mismatches/${row.id}/acknowledge`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect((await aiColumns(tripId)).acknowledgedBy).toBe(admin.id);
		const again = await request(app.getHttpServer())
			.post(`/api/admin/weather/ai-mismatches/${row.id}/acknowledge`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(again.body.acknowledgedAt).toBe(ack.body.acknowledgedAt);
		const after = (await mismatches(admin).expect(200)).body as Array<{ tripId: string }>;
		expect(after.some((item) => item.tripId === tripId)).toBe(false);
	});

	it("does not list Trips where the AI agrees, and refuses to acknowledge them", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const host = await createAccount(UserRole.HOST);
		const now = new Date();
		const tripId = await createForecastTrip(host, now);
		reviewSpy.mockResolvedValue({
			level: RiskLevel.RED,
			reason: "Dông sét và gió rất mạnh.",
			confidence: 0.9,
			model: "gpt-4o-mini",
		});
		await aiReview.reviewPending(now, 500);
		const row = await aiColumns(tripId);
		expect(row.aiRiskLevel).toBe("red");

		const listed = (await mismatches(admin).expect(200)).body as Array<{ tripId: string }>;
		expect(listed.some((item) => item.tripId === tripId)).toBe(false);
		await request(app.getHttpServer())
			.post(`/api/admin/weather/ai-mismatches/${row.id}/acknowledge`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(409);
	});

	it("gives up on a forecast after the maximum number of failed attempts", async () => {
		const host = await createAccount(UserRole.HOST);
		const now = new Date();
		const tripId = await createForecastTrip(host, now);
		const { id } = await aiColumns(tripId);
		reviewSpy.mockImplementation(async () => {
			throw new WeatherRiskReviewError("provider_http_503", true);
		});
		for (let pass = 0; pass < WEATHER_AI_REVIEW_MAX_ATTEMPTS; pass += 1) {
			await aiReview.reviewPending(now, 500);
		}
		expect((await aiColumns(tripId)).attempts).toBe(WEATHER_AI_REVIEW_MAX_ATTEMPTS);
		const pending = await forecasts.findPendingAiReviews(now, 500, WEATHER_AI_REVIEW_MAX_ATTEMPTS);
		expect(pending.some((forecast) => forecast.id === id)).toBe(false);
		expect((await aiColumns(tripId)).aiRiskLevel).toBeNull();
	});

	it("rejects threshold rules outside sensible bounds before saving anything", async () => {
		const admin = await createAccount(UserRole.ADMIN);
		const [{ count: before }] = await dataSource.query(
			`SELECT count(*)::int AS "count" FROM "weather_risk_rules"`
		);
		const response = await request(app.getHttpServer())
			.post("/api/weather/rules")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({
				rainfallYellowThreshold: 0.5,
				rainfallRedThreshold: 1,
				windYellowThreshold: 40,
				windRedThreshold: 70,
				tempLowYellow: 5,
				tempLowRed: 0,
				tempHighYellow: 38,
				tempHighRed: 42,
				visibilityYellowThreshold: 5000,
				visibilityRedThreshold: 1000,
				thunderstormYellow: true,
				thunderstormRed: true,
				rainfallWeight: 0.3,
				windWeight: 0.25,
				temperatureWeight: 0.15,
				visibilityWeight: 0.15,
				thunderstormWeight: 0.15,
				greenMaxScore: 0.5,
				yellowMaxScore: 1.2,
				isActive: false,
			})
			.expect(400);
		expect(JSON.stringify(response.body)).toContain(
			"rainfallRedThreshold must be between 10 and 100"
		);
		const [{ count: after }] = await dataSource.query(
			`SELECT count(*)::int AS "count" FROM "weather_risk_rules"`
		);
		expect(after).toBe(before);
	});
});
