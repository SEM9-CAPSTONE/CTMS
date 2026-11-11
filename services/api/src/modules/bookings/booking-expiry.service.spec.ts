import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { BookingExpiryResult, BookingExpiryService } from "./booking-expiry.service";
import type { BookingsRepository } from "./bookings.repository";
import {
	BookingExpiryOutboxEvent,
	BookingExpiryOutboxEventType,
} from "./entities/booking-expiry-outbox-event.entity";
import {
	EquipmentReservation,
	EquipmentReservationStatus,
} from "./entities/equipment-reservation.entity";
import { Payment, PaymentStatus, PaymentType } from "./entities/payment.entity";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";
import type { PaymentsRepository } from "./payments.repository";

const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2030-01-01T00:00:00.000Z");

function eligibleBooking(overrides: Partial<Booking> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: USER_ID,
		numPeople: 2,
		status: BookingStatus.PENDING_PAYMENT,
		paymentStatus: BookingPaymentStatus.UNPAID,
		holdExpiresAt: new Date("2029-12-31T23:59:59.999Z"),
		...overrides,
	});
}

describe("BookingExpiryService", () => {
	let booking: Booking;
	let trip: Trip;
	let payments: Payment[];
	let reservations: EquipmentReservation[];
	let bookingsRepository: {
		findExpiryCandidateIds: jest.Mock;
		findOne: jest.Mock;
		findForUpdate: jest.Mock;
		save: jest.Mock;
	};
	let tripsRepository: { adjustSeatsTaken: jest.Mock };
	let paymentsRepository: { findByBookingForUpdate: jest.Mock };
	let equipmentRepository: { findByBookingForUpdate: jest.Mock; save: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let outboxRepository: { save: jest.Mock };
	let tripRepository: { findOne: jest.Mock };
	let service: BookingExpiryService;

	beforeEach(() => {
		booking = eligibleBooking();
		trip = Object.assign(new Trip(), { id: TRIP_ID, seatsTaken: 5 });
		payments = [];
		reservations = [
			Object.assign(new EquipmentReservation(), {
				id: "reservation-1",
				status: EquipmentReservationStatus.ACTIVE,
				cancelledAt: null,
				cancellationReason: null,
			}),
		];
		bookingsRepository = {
			findExpiryCandidateIds: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockImplementation(async () => ({ id: BOOKING_ID, tripId: TRIP_ID })),
			findForUpdate: jest.fn().mockImplementation(async () => booking),
			save: jest.fn().mockImplementation(async (value: Booking) => value),
		};
		tripsRepository = { adjustSeatsTaken: jest.fn().mockResolvedValue(undefined) };
		paymentsRepository = {
			findByBookingForUpdate: jest.fn().mockImplementation(async () => payments),
		};
		equipmentRepository = {
			findByBookingForUpdate: jest.fn().mockImplementation(async () => reservations),
			save: jest.fn().mockImplementation(async (value) => value),
		};
		auditRepository = { save: jest.fn().mockResolvedValue(undefined) };
		outboxRepository = { save: jest.fn().mockResolvedValue(undefined) };
		tripRepository = { findOne: jest.fn().mockImplementation(async () => trip) };

		const repositories = new Map<object, object>([
			[bookingsRepository, bookingsRepository],
			[tripsRepository, tripsRepository],
			[paymentsRepository, paymentsRepository],
			[equipmentRepository, equipmentRepository],
		]);
		const manager = {
			query: jest.fn().mockResolvedValue([{ evaluatedAt: NOW }]),
			withRepository: jest.fn((repository: object) => repositories.get(repository)),
			getRepository: jest.fn((entity: unknown) => {
				if (entity === Trip) return tripRepository;
				if (entity === AuditLog) return auditRepository;
				if (entity === BookingExpiryOutboxEvent) return outboxRepository;
				throw new Error(`Unexpected repository: ${String(entity)}`);
			}),
		} as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn(async (callback: (transactionManager: EntityManager) => unknown) =>
				callback(manager)
			),
		} as unknown as DataSource;
		service = new BookingExpiryService(
			dataSource,
			bookingsRepository as unknown as BookingsRepository,
			tripsRepository as unknown as TripsRepository,
			paymentsRepository as unknown as PaymentsRepository,
			equipmentRepository as unknown as EquipmentReservationsRepository
		);
	});

	it("expires an overdue unpaid hold and releases seats and active equipment once", async () => {
		await expect(service.expireBooking(BOOKING_ID, NOW)).resolves.toBe(BookingExpiryResult.EXPIRED);

		expect(booking.status).toBe(BookingStatus.EXPIRED);
		expect(tripsRepository.adjustSeatsTaken).toHaveBeenCalledWith(TRIP_ID, -2);
		expect(reservations[0]).toMatchObject({
			status: EquipmentReservationStatus.CANCELLED,
			cancelledAt: NOW,
			cancellationReason: "payment_hold_expired",
		});
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: null,
				action: "booking.expired",
				after: expect.objectContaining({ evaluatedAt: NOW.toISOString(), releasedSeatCount: 2 }),
			})
		);
		expect(outboxRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: BookingExpiryOutboxEventType.BOOKING_EXPIRED,
				bookingId: BOOKING_ID,
				payload: expect.objectContaining({ expiredAt: NOW.toISOString() }),
			})
		);
	});

	it.each([
		["exact boundary", { holdExpiresAt: NOW }],
		["future hold", { holdExpiresAt: new Date("2030-01-01T00:00:00.001Z") }],
		["confirmed", { status: BookingStatus.CONFIRMED }],
		["pending reconfirmation", { status: BookingStatus.PENDING_RECONFIRMATION }],
		["cancelled", { status: BookingStatus.CANCELLED }],
		["expired", { status: BookingStatus.EXPIRED }],
		["completed", { status: BookingStatus.COMPLETED }],
		["paid", { paymentStatus: BookingPaymentStatus.PAID }],
	])("does nothing for %s", async (_name, overrides) => {
		booking = eligibleBooking(overrides);
		await expect(service.expireBooking(BOOKING_ID, NOW)).resolves.toBe(BookingExpiryResult.NO_OP);
		expect(bookingsRepository.save).not.toHaveBeenCalled();
		expect(tripsRepository.adjustSeatsTaken).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
		expect(outboxRepository.save).not.toHaveBeenCalled();
	});

	it("does nothing when a succeeded charge exists", async () => {
		payments = [
			Object.assign(new Payment(), {
				id: "charge-1",
				type: PaymentType.CHARGE,
				status: PaymentStatus.SUCCEEDED,
			}),
		];
		await expect(service.expireBooking(BOOKING_ID, NOW)).resolves.toBe(BookingExpiryResult.NO_OP);
		expect(bookingsRepository.save).not.toHaveBeenCalled();
	});

	it.each([PaymentStatus.PENDING, PaymentStatus.FAILED])(
		"expires without mutating a %s charge",
		async (status) => {
			const charge = Object.assign(new Payment(), {
				id: "charge-1",
				type: PaymentType.CHARGE,
				status,
			});
			payments = [charge];
			await expect(service.expireBooking(BOOKING_ID, NOW)).resolves.toBe(
				BookingExpiryResult.EXPIRED
			);
			expect(charge.status).toBe(status);
		}
	);

	it("does not modify member rows", async () => {
		const member = { id: "member-1", memberStatus: "registered" };
		await service.expireBooking(BOOKING_ID, NOW);
		expect(member).toEqual({ id: "member-1", memberStatus: "registered" });
	});

	it("revalidates Trip identity before mutation", async () => {
		booking.tripId = "44444444-4444-4444-8444-444444444444";
		await expect(service.expireBooking(BOOKING_ID, NOW)).resolves.toBe(BookingExpiryResult.NO_OP);
		expect(bookingsRepository.save).not.toHaveBeenCalled();
		expect(tripsRepository.adjustSeatsTaken).not.toHaveBeenCalled();
	});

	it("fails before mutation when reserved capacity is inconsistent", async () => {
		trip.seatsTaken = 1;
		await expect(service.expireBooking(BOOKING_ID, NOW)).rejects.toThrow(
			"inconsistent reserved capacity"
		);
		expect(bookingsRepository.save).not.toHaveBeenCalled();
		expect(equipmentRepository.save).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("continues processing candidates after one transaction failure", async () => {
		bookingsRepository.findExpiryCandidateIds.mockResolvedValue(["booking-1", "booking-2"]);
		const expire = jest
			.spyOn(service, "expireBooking")
			.mockRejectedValueOnce(new Error("first failed"))
			.mockResolvedValueOnce(BookingExpiryResult.EXPIRED);

		await expect(service.expireDueBookings(10)).resolves.toBeUndefined();
		expect(expire).toHaveBeenCalledTimes(2);
	});
});
