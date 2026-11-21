import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import {
	AUTO_CANCEL_WEATHER_REASON,
	TripWeatherDecisionService,
} from "../src/modules/trips/weather-decisions/trip-weather-decision.service";
import { TripWeatherDecisionsRepository } from "../src/modules/trips/weather-decisions/trip-weather-decisions.repository";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * HOUR_MS;

describe("Weather auto-cancel at T-6h (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let decisionService: TripWeatherDecisionService;
	let repository: TripWeatherDecisionsRepository;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let ruleId: string;
	let createdRuleId: string | null = null;

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
		decisionService = moduleRef.get(TripWeatherDecisionService);
		repository = moduleRef.get(TripWeatherDecisionsRepository);
		await assertSafeTestDatabase(dataSource);
		const rules = (await dataSource.query(
			`SELECT "id" FROM "weather_risk_rules" ORDER BY "is_active" DESC LIMIT 1`
		)) as Array<{ id: string }>;
		if (rules[0]) {
			ruleId = rules[0].id;
		} else {
			createdRuleId = randomUUID();
			ruleId = createdRuleId;
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
					0.30, 0.25, 0.15, 0.15, 0.15, 0.5, 1.2, false
				)`,
				[createdRuleId]
			);
		}
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const bookingIds = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
			await dataSource.query(`DELETE FROM "payments" WHERE "booking_id" IN (${bookingIds})`, [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "host_weather_penalties" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query(
				'DELETE FROM "trip_weather_decision_alerts" WHERE "trip_id" = ANY($1)',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "trip_weather_decisions" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "trip_weather_forecasts" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query(
				`DELETE FROM "audit_logs" WHERE "target_id" = ANY($1) OR "actor_id" = ANY($2)`,
				[tripIds, userIds]
			);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (createdRuleId) {
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = $1', [createdRuleId]);
			}
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
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Weather auto-cancel user')`,
			[id, `weather-auto-cancel-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
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
		startsAt: Date,
		risk: "red" | "green" = "red"
	): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Weather auto-cancel route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Trip tự huỷ vì thời tiết', 'day_trip', 0, $4, $5,
			   ST_GeogFromText('SRID=4326;POINT(108.2208 16.0471)'), $6, 1, 20, 0, 500000, 'published')`,
			[
				tripId,
				host.id,
				routeId,
				startsAt,
				new Date(startsAt.getTime() + 9 * HOUR_MS),
				new Date(startsAt.getTime() - 2 * HOUR_MS),
			]
		);
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO "trip_weather_forecasts" ("id", "trip_id", "route_id", "status", "risk_level",
			   "composite_score", "trip_starts_at", "trip_ends_at", "forecast_from", "forecast_to",
			   "worst_reading", "criteria_scores", "rule_version_id", "created_by")
			 SELECT $1, "id", "route_id", 'available', $3, $4, "starts_at", "ends_at", "starts_at", "ends_at",
			   '{}'::jsonb, '{}'::jsonb, $5, "host_id"
			 FROM "trips" WHERE "id" = $2`,
			[randomUUID(), tripId, risk, risk === "red" ? 2.5 : 0.2, ruleId]
		);
		return tripId;
	}

	async function bookPaid(camper: Account, tripId: string): Promise<string> {
		const bookingId = randomUUID();
		await dataSource.query(
			`INSERT INTO "bookings" ("id", "trip_id", "user_id", "num_people", "total_amount", "status", "payment_status")
			 VALUES ($1, $2, $3, 1, 500000, 'confirmed', 'paid')`,
			[bookingId, tripId, camper.id]
		);
		await dataSource.query(
			`INSERT INTO "payments" ("booking_id", "amount", "type", "status", "idempotency_key", "request_fingerprint")
			 VALUES ($1, 500000, 'charge', 'succeeded', $2, $3)`,
			[bookingId, `charge-${bookingId}`, `fp-${bookingId}`.slice(0, 64)]
		);
		await dataSource.query(`UPDATE "trips" SET "seats_taken" = "seats_taken" + 1 WHERE "id" = $1`, [
			tripId,
		]);
		return bookingId;
	}

	const api = () => request(app.getHttpServer());
	const tripStatus = async (tripId: string) =>
		(
			(await dataSource.query(`SELECT "status" FROM "trips" WHERE "id" = $1`, [tripId])) as Array<{
				status: string;
			}>
		)[0].status;
	const penaltiesOf = (tripId: string) =>
		dataSource.query(
			`SELECT "id", "decision_id" AS "decisionId" FROM "host_weather_penalties" WHERE "trip_id" = $1`,
			[tripId]
		) as Promise<Array<{ id: string; decisionId: string }>>;
	const alertsFor = (account: Account) =>
		api()
			.get("/api/me/weather-decision-alerts")
			.set("Authorization", `Bearer ${account.accessToken}`)
			.expect(200)
			.then(
				(response) =>
					response.body.items as Array<{ tripId: string; milestone: string; message: string }>
			);

	it("cancels an undecided Red Trip at T-6h as the system: full refund, Host penalty, notices, log", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host, new Date(Date.now() + 5 * HOUR_MS));
		const bookingId = await bookPaid(camper, tripId);

		const now = new Date();
		expect(await repository.findAutoCancelCandidateIds(now, SIX_HOURS_MS, 1000)).toContain(tripId);
		await expect(decisionService.autoCancel(tripId, now)).resolves.toBe("cancelled");

		expect(await tripStatus(tripId)).toBe("cancelled");
		const refunds = (await dataSource.query(
			`SELECT "amount"::text AS "amount" FROM "payments" WHERE "booking_id" = $1 AND "type" = 'refund'`,
			[bookingId]
		)) as Array<{ amount: string }>;
		expect(refunds.map((refund) => Number(refund.amount))).toEqual([500000]);

		const [decision] = (await dataSource.query(
			`SELECT "id", "decided_by" AS "decidedBy", "decider_role" AS "deciderRole", "decision", "reason"
			 FROM "trip_weather_decisions" WHERE "trip_id" = $1`,
			[tripId]
		)) as Array<{
			id: string;
			decidedBy: string | null;
			deciderRole: string;
			decision: string;
			reason: string;
		}>;
		expect(decision).toMatchObject({
			decidedBy: null,
			deciderRole: "system",
			decision: "cancel",
			reason: AUTO_CANCEL_WEATHER_REASON,
		});
		expect(await penaltiesOf(tripId)).toEqual([
			expect.objectContaining({ decisionId: decision.id }),
		]);

		const audit = (await dataSource.query(
			`SELECT "actor_id" AS "actorId" FROM "audit_logs" WHERE "target_id" = $1 AND "action" = 'trip.cancelled'`,
			[tripId]
		)) as Array<{ actorId: string | null }>;
		expect(audit).toEqual([{ actorId: null }]);

		for (const account of [host, admin]) {
			const notice = (await alertsFor(account)).find(
				(alert) => alert.tripId === tripId && alert.milestone === "auto_cancelled"
			);
			expect(notice?.message).toContain("hoàn 100%");
		}
		const log = await api()
			.get(`/api/trips/${tripId}/weather-decisions`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(log.body.decisions[0]).toMatchObject({ deciderRole: "system", decidedBy: null });

		// Running the pass again does nothing more.
		await expect(decisionService.autoCancel(tripId, new Date())).resolves.toBe("skipped");
		expect(await penaltiesOf(tripId)).toHaveLength(1);
	});

	it("leaves alone a Trip before T-6h, a non-Red one and one the Host kept", async () => {
		const host = await createAccount(UserRole.HOST);
		const early = await createTrip(host, new Date(Date.now() + 8 * HOUR_MS));
		const green = await createTrip(host, new Date(Date.now() + 5 * HOUR_MS), "green");
		const kept = await createTrip(host, new Date(Date.now() + 5 * HOUR_MS));
		await api()
			.post(`/api/trips/${kept}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "keep", reason: "Porter quen tuyến", safetyPlan: "Quay đầu trước 14h" })
			.expect(201);

		const now = new Date();
		const candidates = await repository.findAutoCancelCandidateIds(now, SIX_HOURS_MS, 1000);
		for (const tripId of [early, green, kept]) {
			expect(candidates).not.toContain(tripId);
			await expect(decisionService.autoCancel(tripId, now)).resolves.toBe("skipped");
			expect(await tripStatus(tripId)).toBe("published");
		}
	});

	it("still cancels a Trip an Admin only paused, without a second penalty", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const tripId = await createTrip(host, new Date(Date.now() + 5 * HOUR_MS));
		await api()
			.post(`/api/admin/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision: "pause", reason: "Chờ cập nhật bão" })
			.expect(201);
		const penaltiesAfterPause = await penaltiesOf(tripId);

		await expect(decisionService.autoCancel(tripId, new Date())).resolves.toBe("cancelled");
		expect(await tripStatus(tripId)).toBe("cancelled");
		const paused = (await dataSource.query(
			`SELECT "weather_paused_at" AS "pausedAt" FROM "trips" WHERE "id" = $1`,
			[tripId]
		)) as Array<{ pausedAt: Date | null }>;
		expect(paused[0].pausedAt).toBeNull();
		// The Admin pause was the first Admin action after T-24h; the auto-cancel never adds another.
		expect(await penaltiesOf(tripId)).toEqual(penaltiesAfterPause);
	});
});
