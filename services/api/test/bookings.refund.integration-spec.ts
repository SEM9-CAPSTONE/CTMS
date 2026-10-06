import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { BookingsRepository } from "../src/modules/bookings/bookings.repository";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
} from "../src/modules/bookings/entities/payment.entity";
import { PaymentsRepository } from "../src/modules/bookings/payments.repository";
import { RefundOrigin } from "../src/modules/bookings/refund-policy";
import { RefundsService } from "../src/modules/bookings/refunds.service";
import { Booking } from "../src/modules/profiles/entities/booking.entity";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-035 Process Refund Integration (real Postgres)", () => {
	let dataSource: DataSource;
	let service: RefundsService;

	const userId = randomUUID();
	const adminId = randomUUID();
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingId = randomUUID();
	const chargeId = randomUUID();

	beforeAll(async () => {
		dataSource = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(dataSource);

		service = new RefundsService(
			dataSource,
			new PaymentsRepository(Payment, dataSource.createEntityManager()),
			new BookingsRepository(Booking, dataSource.createEntityManager())
		);

		await dataSource.transaction(async (manager) => {
			await manager.query(
				`INSERT INTO users (id, email, password_hash, role, status, full_name)
				 VALUES ($1, $2, 'unused-test-hash', 'camper', 'active', 'Refund test camper')`,
				[userId, `camper-${userId}@example.com`]
			);
			await manager.query(
				`INSERT INTO users (id, email, password_hash, role, status, full_name)
				 VALUES ($1, $2, 'unused-test-hash', 'admin', 'active', 'Refund test admin')`,
				[adminId, `admin-${adminId}@example.com`]
			);
			await manager.query(
				`INSERT INTO trekking_routes (
					id, host_id, name, route_geom, length_meters, difficulty,
					expected_duration_minutes, status
				) VALUES (
					$1, $2, 'Refund test route',
					ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.04), ST_MakePoint(108.25, 16.07)), 4326)::geography,
					3500, 'moderate', 240, 'active'
				)`,
				[routeId, userId]
			);
			await manager.query(
				`INSERT INTO trips (
					id, host_id, route_id, title, trip_type, duration_nights,
					starts_at, ends_at, meeting_point, booking_deadline,
					capacity_min, capacity_max, seats_taken, price_per_person, status
				) VALUES (
					$1, $2, $3, 'Refund test trip', 'day_trip', 0,
					'2035-10-10T01:00:00Z', '2035-10-10T10:00:00Z',
					ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
					'2035-10-09T01:00:00Z', 1, 5, 0, 1000000, 'published'
				)`,
				[tripId, userId, routeId]
			);
			await manager.query(
				`INSERT INTO bookings (
					id, trip_id, user_id, num_people, status, payment_status,
					base_price, total_amount, cancelled_at, trip_starts_at_snapshot
				) VALUES (
					$1, $2, $3, 1, 'cancelled', 'paid',
					1000000, 1000000, '2035-10-08T01:00:00Z', '2035-10-10T01:00:00Z'
				)`,
				[bookingId, tripId, userId]
			);
			await manager.query(
				`INSERT INTO payments (id, booking_id, amount, type, status, provider_reference)
				 VALUES ($1, $2, 1000000, 'charge', 'succeeded', 'order-ref-001')`,
				[chargeId, bookingId]
			);
		});
	}, 60000);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		try {
			await dataSource.transaction(async (manager) => {
				await manager.query(
					"DELETE FROM audit_logs WHERE target_id IN (SELECT id FROM payments WHERE booking_id = $1)",
					[bookingId]
				);
				await manager.query(
					"DELETE FROM payment_transactions WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = $1)",
					[bookingId]
				);
				await manager.query("DELETE FROM payments WHERE booking_id = $1", [bookingId]);
				await manager.query("DELETE FROM bookings WHERE id = $1", [bookingId]);
				await manager.query("DELETE FROM trips WHERE id = $1", [tripId]);
				await manager.query("DELETE FROM trekking_routes WHERE id = $1", [routeId]);
				await manager.query("DELETE FROM users WHERE id IN ($1, $2)", [userId, adminId]);
			});
		} finally {
			await dataSource.destroy();
		}
	});

	it("executes valid partial refund, links parent charge, and adjusts settlement base (PB AC-1, PB AC-2, PB AC-6)", async () => {
		const key = `test-refund-${randomUUID()}`;
		const res = await service.processRefund(
			adminId,
			bookingId,
			key,
			{
				amount: "400000.00",
				origin: RefundOrigin.CAMPER_CANCELLATION,
				reason: "camper_cancelled_before_trip",
			},
			{
				mockProvider: true,
				processingTime: new Date("2035-10-08T02:00:00Z"), // within 24h of cancelled_at
			}
		);

		expect(res.status).toBe(PaymentStatus.SUCCEEDED);
		expect(res.amount).toBe("400000.00");
		expect(res.parentPaymentId).toBe(chargeId);

		// Verify PaymentTransaction created in database
		const txns = await dataSource.getRepository(PaymentTransaction).find({
			where: { paymentId: res.refundId },
		});
		expect(txns).toHaveLength(1);
		expect(txns[0].status).toBe("succeeded");

		// Verify Settlement Status reflects reduced Held Funds
		const settlementStatus = await service.getSettlementStatus(tripId);
		expect(settlementStatus.isBlocked).toBe(false);
		expect(settlementStatus.totalCharges).toBe("1000000.00");
		expect(settlementStatus.totalSucceededRefunds).toBe("400000.00");
		expect(settlementStatus.heldFunds).toBe("600000.00");
		expect(settlementStatus.settlementBase).toBe("600000.00");
	});

	it("rejects over-refunding when requested amount exceeds remaining charge (PB AC-4, BR-105)", async () => {
		const key = `test-over-refund-${randomUUID()}`;
		// Already refunded 400,000; remaining is 600,000. Requesting 700,000 must fail.
		await expect(
			service.processRefund(
				adminId,
				bookingId,
				key,
				{
					amount: "700000.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
				},
				{
					mockProvider: true,
					processingTime: new Date("2035-10-08T02:00:00Z"),
				}
			)
		).rejects.toThrow("exceeds remaining refundable charge amount 600000.00");
	});

	it("replays idempotently when retried with same key and payload (PB AC-5, BR-178)", async () => {
		const key = `test-idempotent-${randomUUID()}`;
		const first = await service.processRefund(
			adminId,
			bookingId,
			key,
			{
				amount: "100000.00",
				origin: RefundOrigin.CAMPER_CANCELLATION,
			},
			{
				mockProvider: true,
				processingTime: new Date("2035-10-08T02:00:00Z"),
			}
		);

		const second = await service.processRefund(
			adminId,
			bookingId,
			key,
			{
				amount: "100000.00",
				origin: RefundOrigin.CAMPER_CANCELLATION,
			},
			{
				mockProvider: true,
				processingTime: new Date("2035-10-08T02:00:00Z"),
			}
		);

		expect(second.refundId).toBe(first.refundId);
		expect(second.amount).toBe(first.amount);
		expect(second.status).toBe(first.status);
	});
});
