import { randomUUID } from "node:crypto";
import type { WebhookData } from "@payos/node";
import { DataSource } from "typeorm";
import { BookingsRepository } from "../src/modules/bookings/bookings.repository";
import { Payment } from "../src/modules/bookings/entities/payment.entity";
import { PaymentsRepository } from "../src/modules/bookings/payments.repository";
import { PaymentsService } from "../src/modules/bookings/payments.service";
import { Booking } from "../src/modules/profiles/entities/booking.entity";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Payment callback for a cancelled Booking (real Postgres)", () => {
	let dataSource: DataSource;
	let service: PaymentsService;
	const userId = randomUUID();
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingId = randomUUID();
	const paymentId = randomUUID();
	const orderCode = Date.now();

	beforeAll(async () => {
		dataSource = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(dataSource);
		service = new PaymentsService(
			new PaymentsRepository(Payment, dataSource.createEntityManager()),
			new BookingsRepository(Booking, dataSource.createEntityManager()),
			dataSource
		);
		await dataSource.transaction(async (manager) => {
			await manager.query(
				`INSERT INTO users (id, email, password_hash, role, status, full_name)
				 VALUES ($1, $2, 'unused-test-hash', 'camper', 'active', 'Callback test')`,
				[userId, `callback-${userId}@example.com`]
			);
			await manager.query(
				`INSERT INTO trekking_routes (
					id, host_id, name, route_geom, length_meters, difficulty,
					expected_duration_minutes, status
				) VALUES (
					$1, $2, 'Callback test route',
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
					$1, $2, $3, 'Callback test trip', 'day_trip', 0,
					'2035-10-10T01:00:00Z', '2035-10-10T10:00:00Z',
					ST_SetSRID(ST_MakePoint(108.22, 16.04), 4326)::geography,
					'2035-10-09T01:00:00Z', 1, 5, 0, 1000000, 'published'
				)`,
				[tripId, userId, routeId]
			);
			await manager.query(
				`INSERT INTO bookings (id, trip_id, user_id, num_people, status, payment_status, base_price, total_amount)
				 VALUES ($1, $2, $3, 1, 'cancelled', 'unpaid', 1000000, 1000000)`,
				[bookingId, tripId, userId]
			);
			await manager.query(
				`INSERT INTO payments (id, booking_id, amount, type, status, provider_reference)
				 VALUES ($1, $2, 1000000, 'charge', 'pending', $3)`,
				[paymentId, bookingId, String(orderCode)]
			);
		});
	}, 60000);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		try {
			await dataSource.transaction(async (manager) => {
				await manager.query("DELETE FROM audit_logs WHERE target_id = $1", [paymentId]);
				await manager.query("DELETE FROM bookings WHERE id = $1", [bookingId]);
				await manager.query("DELETE FROM trips WHERE id = $1", [tripId]);
				await manager.query("DELETE FROM trekking_routes WHERE id = $1", [routeId]);
				await manager.query("DELETE FROM users WHERE id = $1", [userId]);
			});
		} finally {
			await dataSource.destroy();
		}
	});

	it("records concurrent/retried successful callbacks once without restoring cancelled participation", async () => {
		const webhook: WebhookData = {
			orderCode,
			amount: 1000000,
			description: "Callback test",
			accountNumber: "9704",
			reference: `test-${paymentId}`,
			transactionDateTime: "2026-10-04T00:00:00Z",
			currency: "VND",
			paymentLinkId: "test-link",
			code: "00",
			desc: "success",
		};
		await Promise.all([service.handlePayOSWebhook(webhook), service.handlePayOSWebhook(webhook)]);
		await service.handlePayOSWebhook(webhook);

		expect(
			await dataSource.query("SELECT status, payment_status FROM bookings WHERE id = $1", [
				bookingId,
			])
		).toEqual([{ status: "cancelled", payment_status: "paid" }]);
		expect(
			await dataSource.query("SELECT status, type, amount FROM payments WHERE booking_id = $1", [
				bookingId,
			])
		).toEqual([{ status: "succeeded", type: "charge", amount: "1000000.00" }]);
		expect(
			await dataSource.query("SELECT status FROM payment_transactions WHERE payment_id = $1", [
				paymentId,
			])
		).toEqual([{ status: "succeeded" }]);
		const audits = await dataSource.query(
			'SELECT action, "before", "after" FROM audit_logs WHERE target_id = $1',
			[paymentId]
		);
		expect(audits).toEqual([
			expect.objectContaining({
				action: "booking.payment_received",
				before: expect.objectContaining({ bookingStatus: "cancelled", paymentStatus: "pending" }),
				after: expect.objectContaining({ bookingStatus: "cancelled", paymentStatus: "succeeded" }),
			}),
		]);
	});
});
