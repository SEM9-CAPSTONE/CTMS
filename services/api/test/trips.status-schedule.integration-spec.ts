import { randomUUID } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { Trip, TripStatus } from "../src/modules/trips/entities/trip.entity";
import { TripsRepository } from "../src/modules/trips/repositories/trips.repository";
import { TripStatusScheduleService } from "../src/modules/trips/services/trip-status-schedule.service";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Trip status follows the schedule (real Postgres)", () => {
	let dataSource: DataSource;
	let repository: TripsRepository;
	const hostId = randomUUID();
	const routeId = randomUUID();
	const tripIds: string[] = [];

	beforeAll(async () => {
		dataSource = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(dataSource);
		repository = new TripsRepository(Trip, dataSource.createEntityManager());
		await dataSource.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused-test-hash', 'host', 'active', 'Status schedule host')`,
			[hostId, `status-schedule-host-${hostId}@example.com`]
		);
		await dataSource.query(
			`INSERT INTO trekking_routes (id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			 VALUES ($1,$2,'Status schedule route',ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04),ST_MakePoint(108.25,16.07)),4326)::geography,3500,'moderate',240,'active')`,
			[routeId, hostId]
		);
	}, 60_000);

	afterEach(async () => {
		await dataSource.query("DELETE FROM audit_logs WHERE target_id = ANY($1)", [tripIds]);
		await dataSource.query("DELETE FROM trips WHERE id = ANY($1)", [tripIds]);
		tripIds.length = 0;
	});

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		try {
			await dataSource.query("DELETE FROM trekking_routes WHERE id = $1", [routeId]);
			await dataSource.query("DELETE FROM users WHERE id = $1", [hostId]);
		} finally {
			await dataSource.destroy();
		}
	});

	/** Offsets are hours relative to now; `evaluated` marks participation already evaluated. */
	async function createTrip(
		status: TripStatus,
		startOffsetHours: number,
		endOffsetHours: number,
		evaluated = true
	): Promise<string> {
		const tripId = randomUUID();
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status,participation_evaluated_at)
			 VALUES ($1,$2,$3,'Status schedule trip','day_trip',0,
				now() + ($4::int * interval '1 hour'), now() + ($5::int * interval '1 hour'),
				ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,
				now() + ($4::int * interval '1 hour') - interval '1 day',1,20,0,0,$6,
				CASE WHEN $7::boolean THEN now() ELSE NULL END)`,
			[tripId, hostId, routeId, startOffsetHours, endOffsetHours, status, evaluated]
		);
		return tripId;
	}

	async function statusOf(tripId: string): Promise<string> {
		const [row] = await dataSource.query("SELECT status FROM trips WHERE id = $1", [tripId]);
		return row.status;
	}

	function service(autoCancelEnabled: boolean) {
		const config = {
			get: (key: string) =>
				key === "TRIP_AUTO_CANCEL_WORKER_ENABLED" ? String(autoCancelEnabled) : undefined,
		} as unknown as ConfigService;
		return new TripStatusScheduleService(repository, config);
	}

	it("starts, finishes and leaves Trips alone according to their schedule", async () => {
		const started = await createTrip(TripStatus.PUBLISHED, -1, 5);
		const finishedFromPublished = await createTrip(TripStatus.PUBLISHED, -10, -2);
		const finishedFromOngoing = await createTrip(TripStatus.ONGOING, -10, -1);
		const upcoming = await createTrip(TripStatus.PUBLISHED, 24, 30);
		const cancelled = await createTrip(TripStatus.CANCELLED, -10, -1);
		const draft = await createTrip(TripStatus.DRAFT, -1, 5);

		await service(true).advanceDueTrips(1_000);

		expect(await statusOf(started)).toBe(TripStatus.ONGOING);
		expect(await statusOf(finishedFromPublished)).toBe(TripStatus.COMPLETED);
		expect(await statusOf(finishedFromOngoing)).toBe(TripStatus.COMPLETED);
		expect(await statusOf(upcoming)).toBe(TripStatus.PUBLISHED);
		expect(await statusOf(cancelled)).toBe(TripStatus.CANCELLED);
		expect(await statusOf(draft)).toBe(TripStatus.DRAFT);

		const logs = await dataSource.query(
			`SELECT target_id AS "tripId", before, after FROM audit_logs
			 WHERE action = 'trip.status_advanced' AND target_id = ANY($1) ORDER BY target_id`,
			[tripIds]
		);
		expect(logs).toHaveLength(3);
		expect(logs).toEqual(
			expect.arrayContaining([
				{
					tripId: started,
					before: { status: "published" },
					after: { status: "ongoing" },
				},
				{
					tripId: finishedFromOngoing,
					before: { status: "ongoing" },
					after: { status: "completed" },
				},
			])
		);
	});

	it("is idempotent across ticks", async () => {
		const started = await createTrip(TripStatus.PUBLISHED, -1, 5);
		await service(true).advanceDueTrips(1_000);
		await service(true).advanceDueTrips(1_000);
		expect(await statusOf(started)).toBe(TripStatus.ONGOING);
		const [{ count }] = await dataSource.query(
			"SELECT count(*)::int AS count FROM audit_logs WHERE target_id = $1",
			[started]
		);
		expect(count).toBe(1);
	});

	it("waits for auto-cancel to evaluate participation only when auto-cancel is enabled", async () => {
		const unevaluated = await createTrip(TripStatus.PUBLISHED, -1, 5, false);
		await service(true).advanceDueTrips(1_000);
		expect(await statusOf(unevaluated)).toBe(TripStatus.PUBLISHED);
		await service(false).advanceDueTrips(1_000);
		expect(await statusOf(unevaluated)).toBe(TripStatus.ONGOING);
	});
});
