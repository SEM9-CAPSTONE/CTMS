import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { Trip } from "../src/modules/trips/entities/trip.entity";
import { TripsRepository } from "../src/modules/trips/repositories/trips.repository";
import {
	TripAutoCancelResult,
	TripAutoCancelService,
} from "../src/modules/trips/services/trip-auto-cancel.service";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

/**
 * CTMS-036. Real Postgres, no mocking -- mirrors
 * bookings.expiry.integration-spec.ts's own fixture style. Deliberately
 * asserts the refund obligation stays `pending` (never `succeeded`): this
 * worker must not execute refunds itself (see trip-auto-cancel.service.ts's
 * own doc comment) -- that is CTMS-035's job via the Admin refunds queue.
 */
describe("Trip auto-cancellation for insufficient participants (real Postgres)", () => {
	let dataSource: DataSource;
	let service: TripAutoCancelService;
	const hostId = randomUUID();
	const camperIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];

	beforeAll(async () => {
		dataSource = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(dataSource);
		const trips = new TripsRepository(Trip, dataSource.createEntityManager());
		service = new TripAutoCancelService(dataSource, trips);
		await dataSource.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused-test-hash', 'host', 'active', 'Auto-cancel host')`,
			[hostId, `auto-cancel-host-${hostId}@example.com`]
		);
	}, 60_000);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		try {
			await dataSource.query("DELETE FROM trip_auto_cancel_outbox_events WHERE trip_id = ANY($1)", [
				tripIds,
			]);
			await dataSource.query(
				"DELETE FROM audit_logs WHERE target_id = ANY($1) OR target_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))",
				[tripIds.concat(bookingIds)]
			);
			await dataSource.query("DELETE FROM trips WHERE id = ANY($1)", [tripIds]);
			await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1)", [routeIds]);
			await dataSource.query("DELETE FROM users WHERE id = ANY($1)", [camperIds.concat(hostId)]);
		} finally {
			await dataSource.destroy();
		}
	});

	async function createCamper(): Promise<string> {
		const id = randomUUID();
		camperIds.push(id);
		await dataSource.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused-test-hash', 'camper', 'active', 'Auto-cancel camper')`,
			[id, `auto-cancel-camper-${id}@example.com`]
		);
		return id;
	}

	async function createTrip(options: {
		capacityMin: number;
		bookingDeadline: string;
	}): Promise<string> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		routeIds.push(routeId);
		tripIds.push(tripId);
		await dataSource.query(
			`INSERT INTO trekking_routes (id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			 VALUES ($1,$2,'Auto-cancel route',ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04),ST_MakePoint(108.25,16.07)),4326)::geography,3500,'moderate',240,'active')`,
			[routeId, hostId]
		);
		await dataSource.query(
			`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			 VALUES ($1,$2,$3,'Auto-cancel trip','day_trip',0,'2099-10-10T01:00:00Z','2099-10-10T10:00:00Z',ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,$4,$5,20,0,1000000,'published')`,
			[tripId, hostId, routeId, options.bookingDeadline, options.capacityMin]
		);
		return tripId;
	}

	async function createBooking(
		tripId: string,
		userId: string,
		options: { numPeople: number; status: string; withSucceededCharge?: boolean }
	): Promise<{ bookingId: string; paymentId: string | null }> {
		const bookingId = randomUUID();
		bookingIds.push(bookingId);
		const totalAmount = 1_000_000 * options.numPeople;
		const holdExpiresAt = options.status === "pending_payment" ? "2099-01-01T00:00:00Z" : null;
		await dataSource.query(
			`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,hold_expires_at,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,'2099-10-10T01:00:00Z','2099-10-10T10:00:00Z',$8,$8)`,
			[
				bookingId,
				tripId,
				userId,
				options.numPeople,
				options.status,
				options.withSucceededCharge ? "paid" : "unpaid",
				holdExpiresAt,
				totalAmount,
			]
		);
		await dataSource.query("UPDATE trips SET seats_taken = seats_taken + $2 WHERE id = $1", [
			tripId,
			options.numPeople,
		]);
		let paymentId: string | null = null;
		if (options.withSucceededCharge) {
			paymentId = randomUUID();
			await dataSource.query(
				`INSERT INTO payments (id,booking_id,amount,type,status,provider_reference)
				 VALUES ($1,$2,$3,'charge','succeeded',$4)`,
				[paymentId, bookingId, totalAmount, `auto-cancel-${bookingId}`]
			);
		}
		return { bookingId, paymentId };
	}

	const PAST_DEADLINE = "2020-01-01T00:00:00Z";
	const FUTURE_DEADLINE = "2099-01-01T00:00:00Z";

	it("does nothing before the booking deadline", async () => {
		const tripId = await createTrip({ capacityMin: 5, bookingDeadline: FUTURE_DEADLINE });
		const camper = await createCamper();
		await createBooking(tripId, camper, { numPeople: 1, status: "confirmed" });

		await expect(service.evaluateTrip(tripId)).resolves.toBe(TripAutoCancelResult.NO_OP);

		expect(await dataSource.query("SELECT status FROM trips WHERE id = $1", [tripId])).toEqual([
			{ status: "published" },
		]);
	});

	it("cancels the Trip, resolves Bookings, releases seats, and creates a PENDING (not succeeded) refund obligation when below capacity_min", async () => {
		const tripId = await createTrip({ capacityMin: 5, bookingDeadline: PAST_DEADLINE });
		const camper = await createCamper();
		const { bookingId, paymentId } = await createBooking(tripId, camper, {
			numPeople: 2,
			status: "confirmed",
			withSucceededCharge: true,
		});

		await expect(service.evaluateTrip(tripId, new Date())).resolves.toBe(
			TripAutoCancelResult.CANCELLED
		);

		expect(
			await dataSource.query("SELECT status, seats_taken FROM trips WHERE id = $1", [tripId])
		).toEqual([{ status: "cancelled", seats_taken: 0 }]);
		expect(
			await dataSource.query("SELECT status FROM bookings WHERE id = $1", [bookingId])
		).toEqual([{ status: "cancelled" }]);
		expect(
			await dataSource.query(
				"SELECT type, status, parent_payment_id, idempotency_key FROM payments WHERE booking_id = $1 AND type = 'refund'",
				[bookingId]
			)
		).toEqual([
			expect.objectContaining({
				type: "refund",
				status: "pending",
				parent_payment_id: paymentId,
				idempotency_key: `ctms-036:trip-cancel:${tripId}:booking:${bookingId}`,
			}),
		]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id = $1 AND action = 'trip.auto_cancelled'",
				[tripId]
			)
		).toEqual([{ count: 1 }]);
		expect(
			await dataSource.query(
				"SELECT recipient_id, booking_id FROM trip_auto_cancel_outbox_events WHERE trip_id = $1",
				[tripId]
			)
		).toEqual([{ recipient_id: camper, booking_id: bookingId }]);
	});

	it("does not cancel and marks participation evaluated when confirmed participants meet capacity_min", async () => {
		const tripId = await createTrip({ capacityMin: 2, bookingDeadline: PAST_DEADLINE });
		const camper = await createCamper();
		await createBooking(tripId, camper, { numPeople: 2, status: "confirmed" });

		await expect(service.evaluateTrip(tripId, new Date())).resolves.toBe(
			TripAutoCancelResult.SUFFICIENT
		);

		expect(
			await dataSource.query(
				"SELECT status, participation_evaluated_at IS NOT NULL AS evaluated FROM trips WHERE id = $1",
				[tripId]
			)
		).toEqual([{ status: "published", evaluated: true }]);

		// The worker's own candidate query must now exclude this Trip.
		expect(await dataSource.query("SELECT id FROM trips WHERE id = $1", [tripId])).toHaveLength(1);
	});

	it("excludes pending_payment Bookings from confirmed participation (BR-107)", async () => {
		const tripId = await createTrip({ capacityMin: 2, bookingDeadline: PAST_DEADLINE });
		const camper = await createCamper();
		// Enough seats to meet capacity_min only if (incorrectly) counted as confirmed.
		await createBooking(tripId, camper, { numPeople: 2, status: "pending_payment" });

		await expect(service.evaluateTrip(tripId, new Date())).resolves.toBe(
			TripAutoCancelResult.CANCELLED
		);
	});

	it("is idempotent and concurrency-safe: concurrent evaluations never double-cancel or double-refund", async () => {
		const tripId = await createTrip({ capacityMin: 5, bookingDeadline: PAST_DEADLINE });
		const camper = await createCamper();
		const { bookingId } = await createBooking(tripId, camper, {
			numPeople: 1,
			status: "confirmed",
			withSucceededCharge: true,
		});

		const results = await Promise.all([
			service.evaluateTrip(tripId, new Date()),
			service.evaluateTrip(tripId, new Date()),
		]);
		await service.evaluateTrip(tripId, new Date());

		expect(results.sort()).toEqual([TripAutoCancelResult.CANCELLED, TripAutoCancelResult.NO_OP]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM payments WHERE booking_id = $1 AND type = 'refund'",
				[bookingId]
			)
		).toEqual([{ count: 1 }]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id = $1 AND action = 'trip.auto_cancelled'",
				[tripId]
			)
		).toEqual([{ count: 1 }]);
	});
});
