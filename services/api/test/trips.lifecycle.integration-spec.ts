import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { SettlementsService } from "../src/modules/bookings/settlements.service";
import { PackageActivationService } from "../src/modules/offline-packages/package-activation.service";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { TripLifecycleRepository } from "../src/modules/trips/repositories/trip-lifecycle.repository";
import { TripsRepository } from "../src/modules/trips/repositories/trips.repository";
import { TripLifecycleService } from "../src/modules/trips/services/trip-lifecycle.service";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Porter Trip lifecycle (HTTP and real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let tripId: string;
	const hostId = randomUUID();
	const porterId = randomUUID();
	const outsiderId = randomUUID();
	const routeId = randomUUID();
	const bookingId = randomUUID();
	const tripIds: string[] = [];

	function token(role = "porter", id = porterId): string {
		return jwt.sign({ sub: id, roles: [role], status: "active" });
	}
	function action(name: string, auth = token()) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/lifecycle/${name}`)
			.set("Authorization", `Bearer ${auth}`);
	}
	async function state() {
		const rows: Array<{
			status: string;
			actual_started_at: Date | null;
			actual_ended_at: Date | null;
			started_by_id: string | null;
			ended_by_id: string | null;
		}> = await db.query(
			"SELECT status,actual_started_at,actual_ended_at,started_by_id,ended_by_id FROM trips WHERE id=$1",
			[tripId]
		);
		return rows[0];
	}

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
		);
		await app.init();
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		await assertSafeTestDatabase(db);
		for (const [id, role, name] of [
			[hostId, "host", "Trần Minh Đức"],
			[porterId, "porter", "Nguyễn Minh Sơn"],
			[outsiderId, "porter", "Lê Hoàng Nam"],
		]) {
			await db.query(
				`INSERT INTO users(id,email,password_hash,role,status,full_name)
			 VALUES($1,$2,'unused',$3,'active',$4)`,
				[id, `${id}@example.com`, role, name]
			);
		}
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Đường rừng Sơn Trà',ST_GeogFromText('LINESTRING(108.22 16.1,108.25 16.12)'),3500,'moderate',240,'active')`,
			[routeId, hostId]
		);
	}, 60_000);

	beforeEach(async () => {
		tripId = randomUUID();
		tripIds.push(tripId);
		await db.query(
			`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,
		 meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES($1,$2,$3,'Khám phá rừng Sơn Trà','day_trip',0,now()-interval '1 hour',now()+interval '4 hours',
		 ST_GeogFromText('POINT(108.22 16.1)'),now()-interval '1 day',1,12,1,0,'published')`,
			[tripId, hostId, routeId]
		);
		await db.query("INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned')", [
			tripId,
			porterId,
		]);
		await db.query(
			`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,total_amount)
		 VALUES($1,$2,$3,1,'confirmed','not_required',0)`,
			[bookingId, tripId, hostId]
		);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (!db?.isInitialized) return;
		await db.query("UPDATE users SET role='porter' WHERE id=$1", [porterId]);
		await db.query("UPDATE trekking_routes SET status='active' WHERE id=$1", [routeId]);
		await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
		await db.query("DELETE FROM audit_logs WHERE target_id=$1", [tripId]);
		await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
	});

	afterAll(async () => {
		if (db?.isInitialized) {
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [[hostId, porterId, outsiderId]]);
		}
		await app?.close();
	});

	it("exposes server-validated actions without modifying the Trip", async () => {
		const before = await state();
		const result = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/lifecycle`)
			.set("Authorization", `Bearer ${token()}`)
			.expect(200);
		expect(result.body).toMatchObject({
			canStart: true,
			canEnd: false,
			actualStartedAt: null,
			startBlockedReason: null,
		});
		expect(result.headers["cache-control"]).toBe("private, no-store");
		expect(await state()).toEqual(before);
	});

	it("starts and ends exactly once under concurrent retries and preserves bookings", async () => {
		const starts = await Promise.all([action("start"), action("start"), action("start")]);
		expect(starts.map((result) => result.status)).toEqual([200, 200, 200]);
		const started = await state();
		expect(started).toMatchObject({
			status: "ongoing",
			started_by_id: porterId,
			actual_ended_at: null,
		});
		expect(started.actual_started_at).toBeInstanceOf(Date);
		expect(
			starts.every(
				(response) => response.body.actualStartedAt === started.actual_started_at?.toISOString()
			)
		).toBe(true);
		const ends = await Promise.all([action("end"), action("end")]);
		expect(ends.map((result) => result.status)).toEqual([200, 200]);
		const ended = await state();
		expect(ended).toMatchObject({
			status: "completed",
			ended_by_id: porterId,
			actual_started_at: started.actual_started_at,
		});
		expect(ended.actual_ended_at).toBeInstanceOf(Date);
		const logs = await db.query(
			"SELECT action,actor_id FROM audit_logs WHERE target_id=$1 ORDER BY created_at",
			[tripId]
		);
		expect(logs).toEqual([
			{ action: "trip.started", actor_id: porterId },
			{ action: "trip.ended", actor_id: porterId },
		]);
		const [booking] = await db.query(
			"SELECT status,total_amount,completed_at FROM bookings WHERE id=$1",
			[bookingId]
		);
		expect(booking).toMatchObject({
			status: "confirmed",
			total_amount: "0.00",
			completed_at: null,
		});
		await action("start").expect(409);
	});

	it.each(["host", "camper", "admin"])("rejects %s on all lifecycle endpoints", async (role) => {
		// Authentication reloads the authoritative role instead of trusting JWT role claims.
		await db.query("UPDATE users SET role=$2 WHERE id=$1", [porterId, role]);
		await action("start", token(role)).expect(403);
		await action("end", token(role)).expect(403);
		await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/lifecycle`)
			.set("Authorization", `Bearer ${token(role)}`)
			.expect(403);
	});
	it("requires authentication and validates the Trip identifier", async () => {
		await request(app.getHttpServer()).post(`/api/trips/${tripId}/lifecycle/start`).expect(401);
		await request(app.getHttpServer())
			.post("/api/trips/invalid/lifecycle/start")
			.set("Authorization", `Bearer ${token()}`)
			.expect(400);
	});
	it.each(["unassigned", "pending_reconfirmation"])(
		"rejects an assignment in %s state",
		async (status) => {
			await db.query("UPDATE trip_porters SET status=$2 WHERE trip_id=$1", [tripId, status]);
			await action("start").expect(404);
			await action("end").expect(404);
		}
	);
	it("rejects another Porter and a nonexistent Trip", async () => {
		await action("start", token("porter", outsiderId)).expect(404);
		await request(app.getHttpServer())
			.post(`/api/trips/${randomUUID()}/lifecycle/start`)
			.set("Authorization", `Bearer ${token()}`)
			.expect(404);
	});
	it.each(["draft", "pending_approval", "rejected", "cancelled", "completed"])(
		"cannot start a %s Trip",
		async (status) => {
			await db.query("UPDATE trips SET status=$2 WHERE id=$1", [tripId, status]);
			await action("start").expect(409);
			expect((await state()).actual_started_at).toBeNull();
		}
	);
	it("cannot end a Trip that has not started", async () => {
		await action("end").expect(409);
	});

	it("keeps complaint and settlement waiting periods after a delayed actual return", async () => {
		await action("start").expect(200);
		await db.query(
			"UPDATE trips SET booking_deadline=now()-interval '6 days',starts_at=now()-interval '5 days',ends_at=now()-interval '4 days' WHERE id=$1",
			[tripId]
		);
		await action("end").expect(200);
		const evaluation = await app.get(SettlementsService).evaluateTripSettlement(tripId);
		expect(evaluation.isHoldPeriodSatisfied).toBe(false);
		expect(evaluation.isComplaintWindowSatisfied).toBe(false);
	});
	it.each([
		["starts_at=now()+interval '1 hour'", "TRIP_START_TOO_EARLY"],
		["ends_at=now()-interval '1 minute'", "TRIP_START_SCHEDULE_ENDED"],
		["weather_paused_at=now()", "TRIP_WEATHER_PAUSED"],
		["capacity_min=2", "TRIP_INSUFFICIENT_PARTICIPANTS"],
	])("blocks departure when %s", async (change, code) => {
		await db.query(`UPDATE trips SET ${change} WHERE id=$1`, [tripId]);
		const result = await action("start").expect(409);
		expect(result.body.code).toBe(code);
		expect((await state()).status).toBe("published");
	});
	it("rejects a closed route", async () => {
		await db.query("UPDATE trekking_routes SET status='closed' WHERE id=$1", [routeId]);
		expect((await action("start").expect(409)).body.code).toBe("TRIP_ROUTE_UNAVAILABLE");
	});
	it("excludes unconfirmed bookings from participation", async () => {
		await db.query("UPDATE bookings SET status='pending_reconfirmation' WHERE id=$1", [bookingId]);
		expect((await action("start").expect(409)).body.code).toBe("TRIP_INSUFFICIENT_PARTICIPANTS");
	});
	it("cannot bypass a blocked package by retrying", async () => {
		const check = jest
			.spyOn(app.get(PackageActivationService), "assertDepartureReady")
			.mockResolvedValue({ ready: false, reasonCode: "PACKAGE_SOURCE_EXPIRED" });
		for (let attempt = 0; attempt < 2; attempt++) {
			expect((await action("start").expect(409)).body.code).toBe("PACKAGE_SOURCE_EXPIRED");
		}
		expect(check).toHaveBeenCalledTimes(2);
		expect(await state()).toMatchObject({ status: "published", actual_started_at: null });
	});
	it("rolls back state, actual time and audit together on persistence failure", async () => {
		const repository = app.get(TripLifecycleRepository);
		const record = repository.recordTransition.bind(repository);
		jest.spyOn(repository, "recordTransition").mockImplementation(async (...args) => {
			await record(...args);
			throw new Error("Simulated persistence failure");
		});
		await expect(
			app.get(TripLifecycleService).transition(porterId, tripId, TripStatus.ONGOING)
		).rejects.toThrow("persistence failure");
		expect(await state()).toMatchObject({
			status: "published",
			actual_started_at: null,
			started_by_id: null,
		});
		expect(await db.query("SELECT id FROM audit_logs WHERE target_id=$1", [tripId])).toHaveLength(
			0
		);
	});
	it.each([false, true])(
		"schedule worker with package gate=%s leaves assigned Trips for the Porter",
		async (gate) => {
			await db.query(
				"UPDATE trips SET starts_at=now()-interval '4 hours',ends_at=now()-interval '1 hour' WHERE id=$1",
				[tripId]
			);
			const repository = app.get(TripsRepository);
			const check = gate
				? (manager: Parameters<PackageActivationService["assertDepartureReady"]>[0], id: string) =>
						app.get(PackageActivationService).assertDepartureReady(manager, id)
				: undefined;
			await repository.advanceTripStatusesByTime(TripStatus.COMPLETED, 1000, false);
			expect((await state()).status).toBe("published");
			await db.query("UPDATE trips SET ends_at=now()+interval '1 hour' WHERE id=$1", [tripId]);
			await repository.advanceTripStatusesByTime(TripStatus.ONGOING, 1000, false, check);
			expect((await state()).status).toBe("published");
			await action("start").expect(200);
			await db.query("UPDATE trips SET ends_at=now()-interval '1 minute' WHERE id=$1", [tripId]);
			await repository.advanceTripStatusesByTime(TripStatus.COMPLETED, 1000, false);
			expect((await state()).status).toBe("ongoing");
			await action("end").expect(200);
		}
	);
});
