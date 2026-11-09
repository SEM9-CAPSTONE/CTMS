import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { EventsGateway } from "../src/modules/realtime/events.gateway";
import { TripsService } from "../src/modules/trips/services/trips.service";
import { TripWeatherDecisionAlertsService } from "../src/modules/trips/weather-decisions/trip-weather-decision-alerts.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 08:00–17:00 Vietnam time, `days` days from now, so a day Trip stays on one business date. */
function dayTripWindow(days: number): { startsAt: string; endsAt: string } {
	const start = new Date(Date.now() + days * DAY_MS);
	start.setUTCHours(1, 0, 0, 0);
	return {
		startsAt: start.toISOString(),
		endsAt: new Date(start.getTime() + 9 * HOUR_MS).toISOString(),
	};
}

describe("Trip weather decisions near departure (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let alerts: TripWeatherDecisionAlertsService;
	let tripsService: TripsService;
	let emitSpy: jest.SpyInstance;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let ruleId: string;
	let createdRuleId: string | null = null;

	beforeAll(async () => {
		emitSpy = jest.spyOn(EventsGateway.prototype, "emitTripWeatherDecisionRequired");
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
		alerts = moduleRef.get(TripWeatherDecisionAlertsService);
		tripsService = moduleRef.get(TripsService);
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

	beforeEach(() => emitSpy.mockClear());

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			const bookingIds = `SELECT "id" FROM "bookings" WHERE "trip_id" = ANY($1)`;
			await dataSource.query(`DELETE FROM "payments" WHERE "booking_id" IN (${bookingIds})`, [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [tripIds]);
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
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			if (createdRuleId) {
				await dataSource.query('DELETE FROM "weather_risk_rules" WHERE "id" = $1', [createdRuleId]);
			}
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
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
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, 'Weather decision user')`,
			[id, `weather-decision-${role}-${id}@example.com`, role, UserStatus.ACTIVE]
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
		risk: "red" | "green" | null = "red"
	): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Weather decision route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2208, 16.0471), ST_MakePoint(108.2508, 16.0671)), 4326)::geography,
				3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Trip quyết định thời tiết', 'day_trip', 0, $4, $5,
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
		if (risk) await addForecast(tripId, risk);
		return tripId;
	}

	async function addForecast(tripId: string, risk: "red" | "green"): Promise<void> {
		await dataSource.query(
			`INSERT INTO "trip_weather_forecasts" ("id", "trip_id", "route_id", "status", "risk_level",
			   "composite_score", "trip_starts_at", "trip_ends_at", "forecast_from", "forecast_to",
			   "worst_reading", "criteria_scores", "rule_version_id", "created_by")
			 SELECT $1, "id", "route_id", 'available', $3, $4, "starts_at", "ends_at", "starts_at", "ends_at",
			   '{}'::jsonb, '{}'::jsonb, $5, "host_id"
			 FROM "trips" WHERE "id" = $2`,
			[randomUUID(), tripId, risk, risk === "red" ? 2.5 : 0.2, ruleId]
		);
	}

	/** A paid, confirmed booking of 500 000đ with its succeeded charge. */
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
	const refunds = (bookingId: string) =>
		dataSource.query(
			`SELECT "amount"::text AS "amount", "status" FROM "payments" WHERE "booking_id" = $1 AND "type" = 'refund'`,
			[bookingId]
		) as Promise<Array<{ amount: string; status: string }>>;
	const tripRow = (tripId: string) =>
		dataSource
			.query(
				`SELECT "status", "weather_paused_at" AS "pausedAt", "starts_at" AS "startsAt" FROM "trips" WHERE "id" = $1`,
				[tripId]
			)
			.then((rows: Array<{ status: string; pausedAt: Date | null; startsAt: Date }>) => rows[0]);
	const alertsFor = (account: Account) =>
		api()
			.get("/api/me/weather-decision-alerts")
			.set("Authorization", `Bearer ${account.accessToken}`)
			.expect(200)
			.then(
				(response) =>
					response.body as {
						items: Array<{
							id: string;
							tripId: string;
							milestone: string;
							urgency: string;
							message: string;
						}>;
						unreadCount: number;
					}
			);

	it("Host keeps a Red Trip: the Admin is told at once, sees it in the interventions and can cancel with a 100% refund", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const camper = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host, new Date(Date.now() + 40 * HOUR_MS));
		const bookingId = await bookPaid(camper, tripId);

		await api()
			.post(`/api/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "keep", reason: "Porter quen tuyến" })
			.expect(422);
		const kept = await api()
			.post(`/api/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({
				decision: "keep",
				reason: "Porter quen tuyến",
				safetyPlan: "Quay đầu trước 14h nếu mưa",
			})
			.expect(201);
		expect(kept.body).toMatchObject({
			decision: "keep",
			deciderRole: "host",
			riskLevel: "red",
			late: false,
		});

		const adminAlerts = (await alertsFor(admin)).items.filter((item) => item.tripId === tripId);
		expect(adminAlerts).toEqual([
			expect.objectContaining({ milestone: "admin_kept", urgency: "normal" }),
		]);
		expect(emitSpy).toHaveBeenCalledWith(
			[admin.id],
			expect.objectContaining({ tripId, milestone: "admin_kept" })
		);

		const interventions = await api()
			.get("/api/admin/weather-interventions")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(interventions.body).toContainEqual(
			expect.objectContaining({
				tripId,
				reason: "host_kept",
				hostSafetyPlan: "Quay đầu trước 14h nếu mưa",
			})
		);
		await api()
			.get("/api/admin/weather-interventions")
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(403);

		await api()
			.post(`/api/admin/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision: "cancel", reason: "Cảnh báo lũ quét" })
			.expect(201);
		expect((await tripRow(tripId)).status).toBe("cancelled");
		expect(await refunds(bookingId)).toEqual([{ amount: "500000.00", status: "pending" }]);

		const log = await api()
			.get(`/api/trips/${tripId}/weather-decisions`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(200);
		expect(
			log.body.decisions.map(
				(d: { decision: string; deciderRole: string }) => `${d.deciderRole}:${d.decision}`
			)
		).toEqual(["admin:cancel", "host:keep"]);
		const after = await api()
			.get("/api/admin/weather-interventions")
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(after.body.map((item: { tripId: string }) => item.tripId)).not.toContain(tripId);
	});

	it("Host does not answer: T-48h Host reminder, then T-24h and T-12h Admin escalations, each sent once", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const now = new Date();
		const tripId = await createTrip(host, new Date(now.getTime() + 20 * HOUR_MS));

		await alerts.sendDueAlerts(now, 500);
		await alerts.sendDueAlerts(now, 500);
		const hostAlerts = (await alertsFor(host)).items.filter((item) => item.tripId === tripId);
		expect(hostAlerts.map((item) => item.milestone)).toEqual(["host_t48"]);
		let adminAlerts = (await alertsFor(admin)).items.filter((item) => item.tripId === tripId);
		expect(adminAlerts.map((item) => item.milestone)).toEqual(["admin_t24"]);

		await alerts.sendDueAlerts(new Date(now.getTime() + 9 * HOUR_MS), 500);
		const inbox = await alertsFor(admin);
		adminAlerts = inbox.items.filter((item) => item.tripId === tripId);
		expect(adminAlerts.map((item) => `${item.milestone}:${item.urgency}`)).toEqual([
			"admin_t12:urgent",
			"admin_t24:normal",
		]);
		expect(adminAlerts[0].message).toMatch(/^Khẩn:/);

		const read = await api()
			.patch(`/api/me/weather-decision-alerts/${adminAlerts[0].id}/read`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(read.body.readAt).not.toBeNull();
		expect((await alertsFor(admin)).unreadCount).toBe(inbox.unreadCount - 1);
		await api()
			.patch(`/api/me/weather-decision-alerts/${adminAlerts[0].id}/read`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.expect(404);

		// A late Host decision is accepted but flagged, and stops the reminders.
		const late = await api()
			.post(`/api/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "cancel", reason: "Mưa lớn" })
			.expect(201);
		expect(late.body).toMatchObject({ decision: "cancel", late: true });
	});

	it("refuses decisions outside the last 3 days, without a Red forecast, or by another Host", async () => {
		const host = await createAccount(UserRole.HOST);
		const otherHost = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const far = await createTrip(host, new Date(Date.now() + 5 * DAY_MS));
		const green = await createTrip(host, new Date(Date.now() + 30 * HOUR_MS), "green");
		const red = await createTrip(host, new Date(Date.now() + 30 * HOUR_MS));
		const body = { decision: "cancel", reason: "Mưa" };

		await api()
			.post(`/api/trips/${far}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(body)
			.expect(409);
		await api()
			.post(`/api/trips/${green}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send(body)
			.expect(409);
		await api()
			.post(`/api/trips/${red}/weather-decision`)
			.set("Authorization", `Bearer ${otherHost.accessToken}`)
			.send(body)
			.expect(403);
		await api()
			.post(`/api/admin/trips/${far}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision: "pause", reason: "x" })
			.expect(409);
		await api()
			.get(`/api/trips/${red}/weather-decisions`)
			.set("Authorization", `Bearer ${otherHost.accessToken}`)
			.expect(404);
		await api()
			.post(`/api/trips/${red}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "drop", reason: "x" })
			.expect(422);
	});

	it("Admin pauses a Red Trip: new bookings are refused until the Admin resumes it", async () => {
		const host = await createAccount(UserRole.HOST);
		const admin = await createAccount(UserRole.ADMIN);
		const tripId = await createTrip(host, new Date(Date.now() + 30 * HOUR_MS));

		await api()
			.post(`/api/admin/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision: "pause", reason: "Chờ cập nhật bão" })
			.expect(201);
		expect((await tripRow(tripId)).pausedAt).not.toBeNull();
		await expect(
			dataSource.transaction((manager) => tripsService.reserveSeats(tripId, 1, manager))
		).rejects.toThrow("paused");
		// After an Admin acted, the Host can no longer decide for this schedule.
		await api()
			.post(`/api/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "cancel", reason: "Mưa" })
			.expect(409);

		const log = await api()
			.get(`/api/trips/${tripId}/weather-decisions`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.expect(200);
		expect(log.body).toMatchObject({
			weatherPauseReason: "Chờ cập nhật bão",
			withinDecisionWindow: true,
		});

		await addForecast(tripId, "green");
		await api()
			.post(`/api/admin/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${admin.accessToken}`)
			.send({ decision: "resume", reason: "Bão đã tan" })
			.expect(201);
		expect((await tripRow(tripId)).pausedAt).toBeNull();
		await dataSource.transaction((manager) => tripsService.reserveSeats(tripId, 1, manager));
	});

	it("weather reschedule: a Camper may keep the new date or decline with a 100% refund; ordinary reschedules are excluded", async () => {
		const host = await createAccount(UserRole.HOST);
		const keeper = await createAccount(UserRole.CAMPER);
		const decliner = await createAccount(UserRole.CAMPER);
		const tripId = await createTrip(host, new Date(Date.now() + 30 * HOUR_MS));
		const keepBooking = await bookPaid(keeper, tripId);
		const declineBooking = await bookPaid(decliner, tripId);
		const newWindow = dayTripWindow(10);

		await api()
			.post(`/api/trips/${tripId}/weather-decision`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ decision: "reschedule", reason: "Bão", ...newWindow })
			.expect(201);
		expect(new Date((await tripRow(tripId)).startsAt).toISOString()).toBe(newWindow.startsAt);

		await api()
			.post(`/api/bookings/${keepBooking}/weather-reschedule-response`)
			.set("Authorization", `Bearer ${decliner.accessToken}`)
			.send({ accept: true })
			.expect(404);
		const accepted = await api()
			.post(`/api/bookings/${keepBooking}/weather-reschedule-response`)
			.set("Authorization", `Bearer ${keeper.accessToken}`)
			.send({ accept: true })
			.expect(200);
		expect(accepted.body).toEqual({
			bookingId: keepBooking,
			status: "confirmed",
			refundsCreated: 0,
		});

		const declined = await api()
			.post(`/api/bookings/${declineBooking}/weather-reschedule-response`)
			.set("Authorization", `Bearer ${decliner.accessToken}`)
			.send({ accept: false })
			.expect(200);
		expect(declined.body).toEqual({
			bookingId: declineBooking,
			status: "cancelled",
			refundsCreated: 1,
		});
		expect(await refunds(declineBooking)).toEqual([{ amount: "500000.00", status: "pending" }]);
		await api()
			.post(`/api/bookings/${declineBooking}/weather-reschedule-response`)
			.set("Authorization", `Bearer ${decliner.accessToken}`)
			.send({ accept: true })
			.expect(409);

		// An ordinary Host reschedule does not open the full-refund decline.
		const ordinaryTrip = await createTrip(host, new Date(Date.now() + 6 * DAY_MS), null);
		const ordinaryBooking = await bookPaid(keeper, ordinaryTrip);
		await tripsService.reschedule(host.id, ordinaryTrip, dayTripWindow(12));
		await api()
			.post(`/api/bookings/${ordinaryBooking}/weather-reschedule-response`)
			.set("Authorization", `Bearer ${keeper.accessToken}`)
			.send({ accept: false })
			.expect(409);
	});
});
