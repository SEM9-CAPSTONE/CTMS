import { randomUUID } from "node:crypto";
import type { WebhookData } from "@payos/node";
import { DataSource } from "typeorm";
import { BookingExpiryService } from "../src/modules/bookings/booking-expiry.service";
import { BookingsRepository } from "../src/modules/bookings/bookings.repository";
import { EquipmentReservation } from "../src/modules/bookings/entities/equipment-reservation.entity";
import { Payment } from "../src/modules/bookings/entities/payment.entity";
import { EquipmentReservationsRepository } from "../src/modules/bookings/equipment-reservations.repository";
import { PaymentsRepository } from "../src/modules/bookings/payments.repository";
import { PaymentsService } from "../src/modules/bookings/payments.service";
import { Booking } from "../src/modules/profiles/entities/booking.entity";
import { Trip } from "../src/modules/trips/entities/trip.entity";
import { TripsRepository } from "../src/modules/trips/repositories/trips.repository";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Fixture {
	bookingId: string;
	tripId: string;
	paymentId: string;
	reservationId: string;
	memberId: string;
	orderCode: number;
}

describe("Automatic Booking expiry (real Postgres)", () => {
	let dataSource: DataSource;
	let expiryService: BookingExpiryService;
	let paymentsService: PaymentsService;
	const userId = randomUUID();
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];
	const equipmentIds: string[] = [];

	beforeAll(async () => {
		dataSource = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(dataSource);
		const bookings = new BookingsRepository(Booking, dataSource.createEntityManager());
		const trips = new TripsRepository(Trip, dataSource.createEntityManager());
		const payments = new PaymentsRepository(Payment, dataSource.createEntityManager());
		const equipment = new EquipmentReservationsRepository(
			EquipmentReservation,
			dataSource.createEntityManager()
		);
		expiryService = new BookingExpiryService(dataSource, bookings, trips, payments, equipment);
		paymentsService = new PaymentsService(payments, bookings, dataSource);
		await dataSource.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused-test-hash', 'camper', 'active', 'Expiry test')`,
			[userId, `expiry-${userId}@example.com`]
		);
	}, 60_000);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		try {
			await dataSource.query(
				"DELETE FROM booking_expiry_outbox_events WHERE booking_id = ANY($1)",
				[bookingIds]
			);
			await dataSource.query(
				"DELETE FROM audit_logs WHERE target_id = ANY($1) OR target_id IN (SELECT id FROM payments WHERE booking_id = ANY($1))",
				[bookingIds]
			);
			await dataSource.query("DELETE FROM trips WHERE id = ANY($1)", [tripIds]);
			await dataSource.query("DELETE FROM equipment_catalog_items WHERE id = ANY($1)", [
				equipmentIds,
			]);
			await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1)", [routeIds]);
			await dataSource.query("DELETE FROM users WHERE id = $1", [userId]);
		} finally {
			await dataSource.destroy();
		}
	});

	async function fixture(
		options: { seatsTaken?: number; withPendingCharge?: boolean } = {}
	): Promise<Fixture> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		const bookingId = randomUUID();
		const paymentId = randomUUID();
		const equipmentId = randomUUID();
		const bookingItemId = randomUUID();
		const reservationId = randomUUID();
		const memberId = randomUUID();
		const orderCode = 700_000_000 + tripIds.length;
		routeIds.push(routeId);
		tripIds.push(tripId);
		bookingIds.push(bookingId);
		equipmentIds.push(equipmentId);

		await dataSource.transaction(async (manager) => {
			await manager.query(
				`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
				 VALUES ($1,$2,'Expiry route',ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04),ST_MakePoint(108.25,16.07)),4326)::geography,3500,'moderate',240,'active')`,
				[routeId, userId]
			);
			await manager.query(
				`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
				 VALUES ($1,$2,$3,'Expiry trip','day_trip',0,'2099-10-10T01:00:00Z','2099-10-10T10:00:00Z',ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,'2099-10-09T01:00:00Z',1,10,$4,1000000,'published')`,
				[tripId, userId, routeId, options.seatsTaken ?? 2]
			);
			await manager.query(
				`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,hold_expires_at,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount)
				 VALUES ($1,$2,$3,2,'pending_payment','unpaid','2020-01-01T00:00:00Z','2099-10-10T01:00:00Z','2099-10-10T10:00:00Z',1000000,1000000)`,
				[bookingId, tripId, userId]
			);
			await manager.query(
				`INSERT INTO booking_members (id,booking_id,user_id,is_primary,member_status)
				 VALUES ($1,$2,$3,true,'registered')`,
				[memberId, bookingId, userId]
			);
			await manager.query(
				`INSERT INTO equipment_catalog_items (id,host_id,name,category,quantity_total,rental_price_per_day,status)
				 VALUES ($1,$2,'Expiry tent','tent',10,100000,'active')`,
				[equipmentId, userId]
			);
			await manager.query(
				`INSERT INTO booking_items (id,booking_id,item_type,equipment_catalog_item_id,quantity,unit_price,rental_days,total_price)
				 VALUES ($1,$2,'equipment',$3,1,100000,1,100000)`,
				[bookingItemId, bookingId, equipmentId]
			);
			await manager.query(
				`INSERT INTO equipment_reservations (id,booking_item_id,equipment_catalog_item_id,quantity,rental_start_date,rental_end_date,status)
				 VALUES ($1,$2,$3,1,'2099-10-10','2099-10-10','active')`,
				[reservationId, bookingItemId, equipmentId]
			);
			if (options.withPendingCharge) {
				await manager.query(
					`INSERT INTO payments (id,booking_id,amount,type,status,provider_reference)
					 VALUES ($1,$2,1000000,'charge','pending',$3)`,
					[paymentId, bookingId, String(orderCode)]
				);
			}
		});
		return { bookingId, tripId, paymentId, reservationId, memberId, orderCode };
	}

	function webhook(f: Fixture): WebhookData {
		return {
			orderCode: f.orderCode,
			amount: 1000000,
			description: "Expiry callback test",
			accountNumber: "9704",
			reference: `expiry-${f.paymentId}`,
			transactionDateTime: "2026-10-05T00:00:00Z",
			currency: "VND",
			paymentLinkId: `link-${f.paymentId}`,
			code: "00",
			desc: "success",
		};
	}

	it("expires atomically, preserves members and pending charge, and replays without duplicate effects", async () => {
		const f = await fixture({ withPendingCharge: true });
		await Promise.all([
			expiryService.expireBooking(f.bookingId),
			expiryService.expireBooking(f.bookingId),
		]);
		await expiryService.expireBooking(f.bookingId);

		expect(
			await dataSource.query(
				`SELECT b.status,b.payment_status,t.seats_taken,
				 (SELECT status FROM equipment_reservations WHERE id=$2) AS equipment_status,
				 (SELECT member_status FROM booking_members WHERE id=$3) AS member_status,
				 (SELECT status FROM payments WHERE id=$4) AS charge_status
				 FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE b.id=$1`,
				[f.bookingId, f.reservationId, f.memberId, f.paymentId]
			)
		).toEqual([
			{
				status: "expired",
				payment_status: "unpaid",
				seats_taken: 0,
				equipment_status: "cancelled",
				member_status: "registered",
				charge_status: "pending",
			},
		]);
		expect(
			await dataSource.query(
				`SELECT
				 (SELECT COUNT(*)::int FROM audit_logs WHERE target_id=$1 AND action='booking.expired') AS audit_count,
				 (SELECT COUNT(*)::int FROM booking_expiry_outbox_events WHERE booking_id=$1 AND event_type='booking.expired') AS outbox_count`,
				[f.bookingId]
			)
		).toEqual([{ audit_count: 1, outbox_count: 1 }]);
	});

	it("rolls back Booking, capacity, equipment and audit when outbox uniqueness rejects the transaction", async () => {
		const f = await fixture();
		await dataSource.query(
			`INSERT INTO booking_expiry_outbox_events (event_type,booking_id,recipient_id,trip_id,payload)
			 VALUES ('booking.expired',$1,$2,$3,$4)`,
			[
				f.bookingId,
				userId,
				f.tripId,
				{
					bookingId: f.bookingId,
					recipientId: userId,
					tripId: f.tripId,
					expiredAt: "existing",
					holdExpiresAt: "existing",
				},
			]
		);
		await expect(expiryService.expireBooking(f.bookingId)).rejects.toMatchObject({ code: "23505" });

		expect(
			await dataSource.query(
				`SELECT b.status,t.seats_taken,(SELECT status FROM equipment_reservations WHERE id=$2) AS equipment_status
				 FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE b.id=$1`,
				[f.bookingId, f.reservationId]
			)
		).toEqual([{ status: "pending_payment", seats_taken: 2, equipment_status: "active" }]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='booking.expired'",
				[f.bookingId]
			)
		).toEqual([{ count: 0 }]);
	});

	it("payment committed first blocks expiry", async () => {
		const f = await fixture({ withPendingCharge: true });
		await paymentsService.handlePayOSWebhook(webhook(f));
		await expiryService.expireBooking(f.bookingId);

		expect(
			await dataSource.query(
				"SELECT b.status,b.payment_status,t.seats_taken FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE b.id=$1",
				[f.bookingId]
			)
		).toEqual([{ status: "confirmed", payment_status: "paid", seats_taken: 2 }]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM booking_expiry_outbox_events WHERE booking_id=$1",
				[f.bookingId]
			)
		).toEqual([{ count: 0 }]);
	});

	it("expiry committed first preserves expired + paid and deduplicates refund and audit on callback replay", async () => {
		const f = await fixture({ withPendingCharge: true });
		await expiryService.expireBooking(f.bookingId);
		await Promise.all([
			paymentsService.handlePayOSWebhook(webhook(f)),
			paymentsService.handlePayOSWebhook(webhook(f)),
		]);
		await paymentsService.handlePayOSWebhook(webhook(f));

		expect(
			await dataSource.query("SELECT status,payment_status FROM bookings WHERE id=$1", [
				f.bookingId,
			])
		).toEqual([{ status: "expired", payment_status: "paid" }]);
		expect(
			await dataSource.query(
				`SELECT type,status,amount,parent_payment_id,idempotency_key
				 FROM payments WHERE booking_id=$1 ORDER BY type ASC`,
				[f.bookingId]
			)
		).toEqual([
			expect.objectContaining({ type: "charge", status: "succeeded", amount: "1000000.00" }),
			expect.objectContaining({
				type: "refund",
				status: "pending",
				amount: "1000000.00",
				parent_payment_id: f.paymentId,
				idempotency_key: `ctms-172:late-expiry-refund:${f.paymentId}`,
			}),
		]);
		expect(
			await dataSource.query(
				"SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='booking.payment_received_after_expiry'",
				[f.paymentId]
			)
		).toEqual([{ count: 1 }]);
		await expect(
			dataSource.query(
				`INSERT INTO payments (booking_id,amount,type,status,parent_payment_id,idempotency_key,request_fingerprint)
				 VALUES ($1,1000000,'refund','pending',$2,$3,$4)`,
				[f.bookingId, f.paymentId, `ctms-172:late-expiry-refund:${f.paymentId}`, "0".repeat(64)]
			)
		).rejects.toMatchObject({ code: "23505" });
	});
});
